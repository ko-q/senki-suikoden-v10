import test from "node:test";
import assert from "node:assert/strict";
import { Character, CharacterManager } from "../src/domain/character.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { UnitAbility as A } from "../src/domain/unit-ability.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { generateHiddenTraps, findTriggerableHiddenTrap, resolveHiddenTrap } from "../src/services/hidden-trap-rules.js";
import { BattleController, BattleFlowState } from "../src/orchestration/battle-controller.js";
import { MovementService } from "../src/services/movement-service.js";
import { CombatService } from "../src/services/combat-service.js";
import { TacticService } from "../src/services/tactic-service.js";
import { StatusService } from "../src/services/status-service.js";
import { AIService } from "../src/services/ai-service.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { SaveService } from "../src/services/save-service.js";
import { SaveCodec, SaveKind } from "../src/persistence/save-codec.js";
import { SaveMigrator } from "../src/persistence/save-migrator.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { MemoryStorage } from "../test-support/memory-storage.js";

const source = V9_OPENING_STAGE_SOURCE[5], betrayalId = `${source.id}_betrayal`;
// Explicitly synthetic named-character inputs, never registered in the app.
const characters = new CharacterManager(source.units.filter((u) => !u.mobCharacter).map((u) => new Character({
  id: u.characterId, name: `Test ${u.characterId}`, shortName: "T", martial: 50, command: 50,
  intelligence: 50, charisma: 50, source: "test_fixture" })));
function definition() { return createV9OpeningStageDefinition(source.id, characters); }
function factory(def = definition()) {
  return new StageFactory({ definitions: [def], characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog() });
}
function stage() { return factory().create(source.id); }
function resolve(runtime) { return runtime.eventManager.resolveChain({ stage: runtime, trigger: "PHASE_START" }); }
function traps(runtime, random = new BattleRandom(19)) {
  for (const trap of generateHiddenTraps(runtime, random)) runtime.addHiddenTrap(trap);
  return random;
}

test("manor preserves 80 units, eight waiting infiltrators and explicit unit overrides", () => {
  const runtime = stage();
  assert.equal(runtime.validateRuntime(), true);
  assert.equal(runtime.getUnits().length, 80);
  assert.equal(runtime.armyManager.playerArmy.getUnits().length, 20);
  assert.equal(runtime.armyManager.enemyArmy.getUnits().length, 60);
  assert.equal(runtime.getUnit("hu_female_adviser").maxTroops, 190);
  assert.equal(runtime.aiConfig.cautiousElementalUnits.length, 4);
  for (const unit of runtime.aiConfig.cautiousElementalUnits) {
    assert.equal(unit.maxUses.strategy, 1);
    assert.ok(unit.hasAbility(A.ELEMENTAL_TACTIC_DAMAGE_75_PERCENT));
    assert.ok(unit.hasAbility(A.FIRE_TACTIC) || unit.hasAbility(A.WATER_TACTIC));
  }
  for (const rule of runtime.unitControlRules) {
    assert.equal(rule.actionLabel, "潜入待機");
    assert.equal(rule.unit.actionState, "FINISHED");
    assert.equal(rule.canAct(runtime.eventManager), false);
  }
  assert.equal(runtime.unitControlRules.length, 8);
});

test("turn four player betrayal preserves order and troops while confusing remaining enemies once", () => {
  const runtime = stage(), order = runtime.unitOrder.map((u) => u.id);
  runtime.setTurnAndPhase(3, "PLAYER");
  assert.equal(resolve(runtime).completedEvents.length, 0);
  runtime.setTurnAndPhase(4, "ENEMY");
  assert.equal(resolve(runtime).completedEvents.length, 0);
  runtime.getUnit("zhu_chaofeng").setStatus("CONFUSED", 2);
  runtime.getUnit("zhu_chaofeng").setStatus("ILLUSION", 2);
  const sun = runtime.getUnit("sun_li_zhujia"), troopsBefore = sun.troops;
  sun.applyDamage(7);
  runtime.setTurnAndPhase(4, "PLAYER");
  const result = resolve(runtime);
  assert.deepEqual(result.completedEvents.map((e) => e.id), [betrayalId]);
  assert.equal(result.presentationRequests[0].dialogue.speeches.length, 3);
  assert.equal(runtime.armyManager.playerArmy.getUnits().length, 28);
  assert.equal(runtime.armyManager.enemyArmy.getUnits().length, 52);
  assert.equal(sun.troops, troopsBefore - 7);
  assert.equal(sun.facing, "NORTH");
  assert.equal(sun.getStatusTurns("CONFUSED"), 0);
  for (const enemy of runtime.armyManager.enemyArmy.getUnits()) assert.ok(enemy.getStatusTurns("CONFUSED") >= 1);
  assert.equal(runtime.getUnit("zhu_chaofeng").getStatusTurns("CONFUSED"), 2);
  assert.equal(runtime.getUnit("zhu_chaofeng").getStatusTurns("ILLUSION"), 2);
  assert.deepEqual(runtime.unitOrder.map((u) => u.id), order);
  assert.equal(resolve(runtime).completedEvents.length, 0);
  assert.ok(runtime.unitControlRules.every((r) => r.canAct(runtime.eventManager)));
});

test("a defeated infiltrator stays defeated and never joins or revives", () => {
  const runtime = stage(), unit = runtime.getUnit("sun_li_zhujia");
  unit.applyDamage(unit.maxTroops); unit.setReadyForPhase(false); runtime.map.removeUnit(unit);
  runtime.setTurnAndPhase(4, "PLAYER"); resolve(runtime);
  assert.equal(runtime.armyManager.playerArmy.getUnits().length, 27);
  assert.equal(runtime.armyManager.enemyArmy.has(unit), true);
  assert.equal(unit.troops, 0);
  assert.equal(runtime.map.getPosition(unit), null);
  assert.equal(runtime.validateRuntime(), true);
});

test("three source zones produce four traps using exactly four RNG draws", () => {
  const runtime = stage(), random = new BattleRandom(19), expected = new BattleRandom(19);
  assert.deepEqual(runtime.hiddenTrapDefinitions.map((d) => d.count), [1, 2, 1]);
  traps(runtime, random);
  for (let n = 0; n < 4; n++) expected.next();
  assert.deepEqual(random.exportState(), expected.exportState());
  assert.equal(runtime.getHiddenTraps().length, 4);
  assert.deepEqual({ ...runtime.getHiddenTraps()[0].position }, { x: 7, y: 7 });
  assert.equal(new Set(runtime.getHiddenTraps().map((t) => t.position.toKey())).size, 4);
  assert.ok(runtime.getHiddenTraps().every((t) => t.kind === "normal" && t.triggerAffiliations.join() === "PLAYER"));
});

test("joined infiltrators avoid manor traps while ordinary players take 20 damage and confusion", () => {
  const runtime = stage(); traps(runtime);
  runtime.setTurnAndPhase(4, "PLAYER"); resolve(runtime);
  const trap = runtime.getHiddenTraps()[0], sun = runtime.getUnit("sun_li_zhujia");
  const origin = runtime.map.getPosition(sun);
  runtime.map.moveUnit(sun, trap.position);
  assert.equal(findTriggerableHiddenTrap(runtime, sun), null);
  assert.equal(trap.active, true);
  runtime.map.moveUnit(sun, origin);
  const ordinary = runtime.getUnit("song_jiang_zhujia"), before = ordinary.troops;
  runtime.map.moveUnit(ordinary, trap.position);
  assert.equal(findTriggerableHiddenTrap(runtime, ordinary), trap);
  assert.equal(resolveHiddenTrap(runtime, ordinary, trap).damage, 20);
  assert.equal(ordinary.troops, before - 20);
  assert.equal(ordinary.getStatusTurns("CONFUSED"), 1);
  assert.equal(trap.active, false);
});

test("controller unlocks infiltrators on turn four and keeps traps stable across turns", { timeout: 10000 }, async () => {
  const def = definition();
  // Hold normal enemies only in this timing fixture so combat cannot obscure the event boundary.
  const extraRules = source.units.filter((u) => u.army === "ENEMY" && !source.betrayal.unitIds.includes(u.id))
    .map((u) => ({ unitId: u.id, alwaysInactive: true }));
  const runtime = factory({ ...def, unitControlRules: [...def.unitControlRules, ...extraRules] }).create(source.id);
  const battleRandom = new BattleRandom(19), movementService = new MovementService(), combatService = new CombatService();
  const tacticService = new TacticService(), statusService = new StatusService();
  const aiService = new AIService({ battleRandom, movementService, combatService, tacticService });
  const battle = new BattleController({ stage: runtime, battleRandom, movementService, combatService, tacticService, statusService, aiService });
  const completion = battle.startNewBattle();
  try {
    for (let n = 0; battle.flowState !== BattleFlowState.IDLE && n < 100; n++) await new Promise(setImmediate);
    assert.equal(battle.flowState, BattleFlowState.IDLE);
    const before = JSON.stringify(runtime.getHiddenTraps());
    for (let n = 0; n < 3; n++) assert.equal(await battle.endPlayerTurn(), true);
    assert.equal(runtime.turn, 4);
    for (const id of source.betrayal.unitIds) assert.equal(runtime.getUnit(id).actionState, "READY");
    assert.equal(JSON.stringify(runtime.getHiddenTraps()), before);
    assert.deepEqual(battle.getDiagnostics(), []);
  } finally { battle.dispose(); await completion.catch(() => {}); }
});

test("save/load preserves betrayal, troop counts, trap activation and RNG state", () => {
  for (const turn of [3, 4]) {
    const stageFactory = factory(), runtime = stageFactory.create(source.id);
    const random = traps(runtime);
    runtime.getHiddenTraps()[1].deactivate();
    runtime.setTurnAndPhase(turn, "PLAYER"); resolve(runtime);
    for (const unit of runtime.getUnits()) unit.setReadyForPhase(runtime.armyManager.playerArmy.has(unit));
    const service = new SaveService({ stageFactory, repository: new SaveRepository({ storage: new MemoryStorage() }),
      codec: new SaveCodec(), migrator: new SaveMigrator(), writerId: "manor_test" });
    const battle = createBattleSaveData(runtime, random);
    assert.equal(service.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle }).ok, true);
    const guard = service.inspectSlot("manual_01", SaveKind.MANUAL).guard;
    const prepared = service.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard });
    const loaded = prepared.stage;
    assert.deepEqual(prepared.randomState, random.exportState());
    assert.deepEqual(loaded.getHiddenTraps(), runtime.getHiddenTraps());
    assert.equal(loaded.armyManager.playerArmy.getUnits().length, turn === 3 ? 20 : 28);
    loaded.setTurnAndPhase(4, "PLAYER");
    assert.equal(resolve(loaded).completedEvents.length, turn === 3 ? 1 : 0);
    assert.equal(loaded.armyManager.playerArmy.getUnits().length, 28);
    assert.equal(loaded.validateRuntime(), true);
  }
});
