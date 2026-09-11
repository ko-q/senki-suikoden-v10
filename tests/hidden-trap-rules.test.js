import test from "node:test";
import assert from "node:assert/strict";

import { Affiliation } from "../src/domain/army.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { HiddenTrap, HiddenTrapKind } from "../src/domain/hidden-trap.js";
import { Position } from "../src/domain/position.js";
import { UnitAbility } from "../src/domain/unit-ability.js";
import { UnitStatus } from "../src/domain/unit.js";
import {
  findTriggerableHiddenTrap,
  generateHiddenTraps,
  resolveHiddenTrap
} from "../src/services/hidden-trap-rules.js";
import { createStage } from "../test-support/fixtures.js";

test("Hidden Trap generation matches the v9 candidate order and seeded splice selection", () => {
  const stage = createStage({
    id: "trap_generation_test",
    hiddenTrapDefinitions: [
      {
        id: "front_trap",
        kind: HiddenTrapKind.NORMAL,
        candidatePositions: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 2, y: 0 }
        ],
        count: 2,
        triggerAffiliations: [Affiliation.PLAYER]
      }
    ]
  });
  const random = new BattleRandom(1);

  const traps = generateHiddenTraps(stage, random);

  assert.deepEqual(traps.map((trap) => trap.id), ["front_trap_1", "front_trap_2"]);
  assert.deepEqual(traps.map((trap) => trap.position), [
    new Position(0, 0),
    new Position(1, 0)
  ]);
  assert.equal(stage.getHiddenTraps().length, 0);
});

test("Normal Trap applies v9 damage and confusion but leaves Map cleanup to Controller", () => {
  const stage = createStage({ id: "normal_trap_test" });
  const player = stage.getUnit("normal_trap_test_player");
  const trap = new HiddenTrap({
    id: "normal_trap",
    kind: HiddenTrapKind.NORMAL,
    position: { x: 1, y: 1 },
    triggerAffiliations: [Affiliation.PLAYER]
  });
  stage.addHiddenTrap(trap);
  player.restoreTroops(10);
  stage.map.moveUnit(player, trap.position);

  assert.equal(findTriggerableHiddenTrap(stage, player), trap);
  const result = resolveHiddenTrap(stage, player, trap);

  assert.equal(result.damage, 20);
  assert.equal(result.defeated, true);
  assert.equal(result.statusChange, null);
  assert.equal(result.interruptMovement, true);
  assert.equal(trap.active, false);
  assert.equal(stage.map.getPosition(player).equals(trap.position), true);
});

test("Spell Trap is consumed and neutralized by the v9 illusion-user ability", () => {
  const stage = createStage({
    id: "spell_trap_test",
    playerAbilities: [UnitAbility.ILLUSION]
  });
  const player = stage.getUnit("spell_trap_test_player");
  const trap = new HiddenTrap({
    id: "spell_trap",
    kind: HiddenTrapKind.SPELL,
    position: { x: 1, y: 1 },
    triggerAffiliations: [Affiliation.PLAYER]
  });
  stage.addHiddenTrap(trap);
  stage.map.moveUnit(player, trap.position);

  const result = resolveHiddenTrap(stage, player, trap);

  assert.equal(result.neutralized, true);
  assert.equal(result.damage, 0);
  assert.equal(player.troops, player.maxTroops);
  assert.equal(player.getStatusTurns(UnitStatus.ILLUSION), 0);
  assert.equal(trap.active, false);
});

test("Trap awareness and current affiliation both preserve a non-triggered Trap", () => {
  const awareStage = createStage({
    id: "trap_awareness_test",
    playerAbilities: [UnitAbility.HIDDEN_TRAP_AWARENESS]
  });
  const awarePlayer = awareStage.getUnit("trap_awareness_test_player");
  const awareTrap = new HiddenTrap({
    id: "aware_trap",
    kind: HiddenTrapKind.NORMAL,
    position: { x: 1, y: 1 },
    triggerAffiliations: [Affiliation.PLAYER]
  });
  awareStage.addHiddenTrap(awareTrap);
  awareStage.map.moveUnit(awarePlayer, awareTrap.position);

  assert.equal(findTriggerableHiddenTrap(awareStage, awarePlayer), null);
  assert.equal(awareTrap.active, true);

  const enemyStage = createStage({ id: "trap_affiliation_test" });
  const enemy = enemyStage.getUnit("trap_affiliation_test_enemy");
  const playerOnlyTrap = new HiddenTrap({
    id: "player_only_trap",
    kind: HiddenTrapKind.NORMAL,
    position: { x: 1, y: 1 },
    triggerAffiliations: [Affiliation.PLAYER]
  });
  enemyStage.addHiddenTrap(playerOnlyTrap);
  enemyStage.map.moveUnit(enemy, playerOnlyTrap.position);

  assert.equal(findTriggerableHiddenTrap(enemyStage, enemy), null);
  assert.equal(playerOnlyTrap.active, true);
});

test("A surviving Spell Trap target receives exactly one illusion turn", () => {
  const stage = createStage({ id: "spell_trap_status_test" });
  const player = stage.getUnit("spell_trap_status_test_player");
  const trap = new HiddenTrap({
    id: "status_spell_trap",
    kind: HiddenTrapKind.SPELL,
    position: { x: 1, y: 1 },
    triggerAffiliations: [Affiliation.PLAYER]
  });
  stage.addHiddenTrap(trap);
  stage.map.moveUnit(player, trap.position);

  const result = resolveHiddenTrap(stage, player, trap);

  assert.equal(result.damage, 10);
  assert.equal(result.neutralized, false);
  assert.deepEqual(result.statusChange, {
    type: UnitStatus.ILLUSION,
    beforeTurns: 0,
    afterTurns: 1
  });
  assert.equal(player.getStatusTurns(UnitStatus.ILLUSION), 1);
});
