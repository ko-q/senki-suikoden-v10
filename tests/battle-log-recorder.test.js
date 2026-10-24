import test from "node:test";
import assert from "node:assert/strict";
import { BattleLogRecorder } from "../src/services/battle-log-recorder.js";
import { CombatService } from "../src/services/combat-service.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import { createServiceStage } from "../test-support/service-fixtures.js";
import { resolveHiddenTrap } from "../src/services/hidden-trap-rules.js";
import { HiddenTrap } from "../src/domain/hidden-trap.js";

test("trap logs distinguish spell damage, neutralization and fatal damage without changing the outcome", () => {
  for (const [kind, immune, maxTroops] of [["normal", false, 100], ["spell", false, 100], ["spell", true, 100], ["spell", false, 5]]) {
    const stage = createServiceStage({ units: [
      { id: "actor", army: "PLAYER", position: { x: 0, y: 0 }, maxTroops, abilities: immune ? [UnitAbility.ILLUSION] : [] },
      { id: "enemy", position: { x: 4, y: 0 } }
    ] });
    stage.addHiddenTrap(new HiddenTrap({ id: "trap", kind, position: { x: 0, y: 0 }, triggerAffiliations: ["PLAYER"] }));
    const unit = stage.getUnit("actor"), result = resolveHiddenTrap(stage, unit, stage.getHiddenTraps()[0]);
    const troops = unit.troops, statuses = JSON.stringify(unit.statusEffects);
    new BattleLogRecorder(stage).trap(result);
    const logs = stage.battleLog.getEntries();
    assert.equal(logs[0].type, "TRAP");
    assert.deepEqual(logs[0].unitIds, [unit.id]);
    if (kind === "spell") assert.match(logs[0].text, /妖術罠/);
    else assert.doesNotMatch(logs[0].text, /妖術/);
    if (immune) {
      assert.match(logs[0].text, /無効化/); assert.match(logs[0].text, /消滅/);
      assert.doesNotMatch(logs[0].text, /ダメージ|幻術1/);
    } else {
      assert.match(logs[0].text, new RegExp(`${kind === "spell" ? 10 : 20}ダメージ`));
      if (maxTroops > 10) assert.match(logs[0].text, kind === "spell" ? /幻術1T/ : /撹乱1T/);
      else { assert.doesNotMatch(logs[0].text, /幻術1T/); assert.equal(logs[1].type, "DEFEATED"); }
    }
    assert.equal(unit.troops, troops); assert.equal(JSON.stringify(unit.statusEffects), statuses);
    assert.equal(result.trap.active, false);
  }
});

test("committed melee logs explain facing, forest and high-ground modifiers", () => {
  const stage = createServiceStage({ map: [["hill", "forest"]], units: [
    { id: "actor", army: "PLAYER", position: { x: 0, y: 0 } },
    { id: "target", position: { x: 1, y: 0 }, facing: "EAST", maxTroops: 500, abilities: [UnitAbility.SHIELD_COMBAT] }
  ] });
  const actor = stage.getUnit("actor"), target = stage.getUnit("target"), random = new BattleRandom(1);
  const result = new CombatService().execute({ type: "NORMAL_ATTACK", actor, target }, stage, random);
  const state = random.exportState(), troops = target.troops;
  // Log from the committed calculation, even if a later effect changes the facing.
  target.setFacing("WEST");
  new BattleLogRecorder(stage).action(actor, "NORMAL_ATTACK", result);
  assert.match(stage.battleLog.getEntries()[0].text, /ダメージ［盾牌・背面／森防御／高所攻撃］/);
  assert.equal(target.troops, troops); assert.deepEqual(random.exportState(), state);
});

test("projectile logs preserve the committed facing and distinguish shield defense", () => {
  for (const shield of [false, true]) {
    const stage = createServiceStage({ units: [
      { id: "actor", army: "PLAYER", position: { x: 0, y: 0 }, abilities: [UnitAbility.BOW_ATTACK], maxUses: { [UnitUse.PROJECTILE]: 3 } },
      { id: "target", position: { x: 2, y: 0 }, facing: "EAST", maxTroops: 500, abilities: shield ? [UnitAbility.SHIELD_COMBAT] : [] }
    ] });
    const actor = stage.getUnit("actor"), target = stage.getUnit("target");
    const result = new CombatService().execute({ type: "BOW_ATTACK", actor, target }, stage, new BattleRandom(1));
    target.setFacing("WEST"); new BattleLogRecorder(stage).action(actor, "BOW_ATTACK", result);
    assert.match(stage.battleLog.getEntries()[0].text, shield ? /（盾牌防御）/ : /（背面）/);
    assert.match(stage.battleLog.getEntries()[0].text, /残り2\/3回/);
  }
});

test("melee logs distinguish swamp penalties and chain cavalry defense", () => {
  for (const terrain of ["swamp", "road"]) {
    const stage = createServiceStage({ map: [[terrain, terrain]], units: [
      { id: "actor", army: "PLAYER", position: { x: 0, y: 0 }, abilities: [UnitAbility.CHAIN_CAVALRY] },
      { id: "target", position: { x: 1, y: 0 }, maxTroops: 500, abilities: [UnitAbility.CHAIN_CAVALRY] }
    ] });
    const actor = stage.getUnit("actor"), target = stage.getUnit("target");
    const result = new CombatService().execute({ type: "NORMAL_ATTACK", actor, target }, stage, new BattleRandom(1));
    new BattleLogRecorder(stage).action(actor, "NORMAL_ATTACK", result);
    assert.match(stage.battleLog.getEntries()[0].text, terrain === "swamp" ? /湿地・連環馬不利／湿地・連環馬不利/ : /連環馬防御/);
  }
});
