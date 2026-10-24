import test from "node:test";
import assert from "node:assert/strict";
import { Character, CharacterManager } from "../src/domain/character.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { resolveStageMapAsset } from "../src/presentation/battle-map-view.js";
import { BattleController, BattleFlowState } from "../src/orchestration/battle-controller.js";
import { BattleRandom } from "../src/domain/battle-random.js";
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

const fourth = V9_OPENING_STAGE_SOURCE[3], fifth = V9_OPENING_STAGE_SOURCE[4];
// Synthetic values and water entry are test inputs only; no canonical data is inferred.
const ids = new Set([fourth, fifth].flatMap((d) => d.units.filter((u) => !u.mobCharacter).map((u) => u.characterId)));
const characters = new CharacterManager([...ids].map((id) => new Character({ id, name: `Test ${id}`,
  shortName: "T", martial: 50, command: 50, intelligence: 50, charisma: 50,
  combatSkills: ["水中戦"], source: "test_fixture" })));
const rescueId = `${fifth.id}_rescue`;
function definition(source) { return createV9OpeningStageDefinition(source.id, characters); }
function factory(def) {
  return new StageFactory({ definitions: [def], characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog() });
}
function stage(source = fifth) { return factory(definition(source)).create(source.id); }
function resolve(runtime, trigger = "PHASE_START") {
  return runtime.eventManager.resolveChain({ stage: runtime, trigger });
}
function kill(runtime, unit) {
  unit.applyDamage(unit.maxTroops); unit.setReadyForPhase(false); runtime.map.removeUnit(unit);
}
function controller(runtime) {
  const battleRandom = new BattleRandom(18), movementService = new MovementService();
  const combatService = new CombatService(), tacticService = new TacticService(), statusService = new StatusService();
  const aiService = new AIService({ battleRandom, movementService, combatService, tacticService });
  return new BattleController({ stage: runtime, battleRandom, movementService, combatService, tacticService, statusService, aiService });
}
async function idle(battle) {
  for (let n = 0; battle.flowState !== BattleFlowState.IDLE && n < 100; n++) await new Promise(setImmediate);
  assert.equal(battle.flowState, BattleFlowState.IDLE);
}

test("chapter four preserves expanded terrain and final positions without adding a reinforcement", () => {
  const runtime = stage(fourth);
  assert.equal(runtime.getUnits().length, 12);
  assert.equal(runtime.map.height, 16);
  assert.equal(resolveStageMapAsset(runtime).id, "chapter_4");
  assert.equal(runtime.eventManager.getAll().length, 0);
  assert.equal(runtime.map.getCellAt(6, 15).occupant.id, "qin_ming");
  assert.equal(runtime.map.getCellAt(7, 14).occupant.id, "huang_xin");
  assert.equal(runtime.map.getCellAt(5, 11).occupant.id, "qingzhou6");
  assert.equal(runtime.getUnit("qingzhou6").facing, "NORTH");
  runtime.map.moveUnit(runtime.getUnit("song_jiang"), { x: 3, y: 0 });
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, `${fourth.id}_escape`);
  kill(runtime, runtime.getUnit("song_jiang"));
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime).id, `${fourth.id}_leader_defeat`);
});

test("chapter five preserves 42 initial units, seven detached rescuers and ordered deployment", () => {
  const runtime = stage();
  assert.equal(runtime.getUnits().length, 49);
  assert.equal(runtime.armyManager.playerArmy.getUnits().length, 8);
  assert.equal(runtime.armyManager.enemyArmy.getUnits().length, 34);
  assert.equal(runtime.unitOrder[0].id, "song_jiang_jiangzhou");
  assert.equal(runtime.unitOrder[42].id, "chao_gai_jiangzhou");
  assert.equal(runtime.map.getPosition(runtime.getUnit("chao_gai_jiangzhou")), null);
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
  assert.equal(resolveStageMapAsset(runtime).id, "chapter_5");
  assert.equal(runtime.map.getCellAt(0, 1).occupant.id, "li_jun_jiangzhou");
  assert.equal(runtime.map.getCellAt(5, 13).occupant.id, "jiangzhou_soldier6");
  assert.deepEqual(runtime.aiConfig.adviserUnits.map((u) => u.id), ["jiangzhou_adviser2", "jiangzhou_adviser"]);
  assert.equal(runtime.validateRuntime(), true);
});

test("rescue occurs once at turn two player start and uses the source preferred positions", () => {
  const runtime = stage();
  assert.equal(resolve(runtime).completedEvents.length, 0);
  runtime.setTurnAndPhase(2, "ENEMY");
  assert.equal(resolve(runtime).completedEvents.length, 0);
  runtime.setTurnAndPhase(2, "PLAYER");
  assert.equal(resolve(runtime, "AFTER_OPERATION").completedEvents.length, 0);
  const result = resolve(runtime);
  assert.deepEqual(result.completedEvents.map((e) => e.id), [rescueId]);
  assert.equal(result.presentationRequests[0].dialogue.speeches.length, 6);
  assert.equal(result.presentationRequests[0].dialogue.speeches[0].actionLabel, "味方救援");
  assert.equal(runtime.armyManager.playerArmy.getUnits().length, 15);
  for (const reserve of fifth.units.filter((u) => u.reserve)) {
    assert.equal(runtime.map.getCellAt(reserve.position.x, reserve.position.y).occupant.id, reserve.id);
  }
  assert.equal(resolve(runtime).completedEvents.length, 0);
  assert.equal(runtime.validateRuntime(), true);
});

test("Song Jiang and Chao Gai must both enter the radius-one escape zone", () => {
  const runtime = stage();
  runtime.map.moveUnit(runtime.getUnit("song_jiang_jiangzhou"), { x: 3, y: 0 });
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  runtime.setTurnAndPhase(2, "PLAYER"); resolve(runtime);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  runtime.map.moveUnit(runtime.getUnit("chao_gai_jiangzhou"), { x: 4, y: 1 });
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  runtime.map.moveUnit(runtime.getUnit("chao_gai_jiangzhou"), { x: 4, y: 0 });
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, `${fifth.id}_escape`);
  kill(runtime, runtime.getUnit("chao_gai_jiangzhou"));
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime).id, `${fifth.id}_chao_gai_jiangzhou_defeat`);
});

test("annihilation is allowed before rescue; Dai Zong and Li Kui are not required survivors", () => {
  for (const source of [fourth, fifth]) {
    const runtime = stage(source);
    if (source === fifth) {
      kill(runtime, runtime.getUnit("dai_zong")); kill(runtime, runtime.getUnit("li_kui"));
      assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
    }
    for (const enemy of runtime.armyManager.enemyArmy.getUnits()) kill(runtime, enemy);
    assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, `${source.id}_annihilation`);
  }
});

test("failure to deploy required Chao Gai counts as defeat only after the rescue event", () => {
  const def = definition(fifth);
  const occupied = new Set(def.units.filter((u) => u.position).map((u) => `${u.position.x},${u.position.y}`));
  const blockers = [];
  for (let y = 0; y < 16; y++) for (let x = 0; x < 8; x++) {
    if (Math.abs(x) + Math.abs(y - 9) <= 4 && !occupied.has(`${x},${y}`)) {
      blockers.push({ id: `test_blocker_${x}_${y}`, characterId: "song_jiang", army: "ENEMY",
        position: { x, y }, maxTroops: 1, move: 0, abilities: ["water_terrain_affinity"] });
    }
  }
  const runtime = factory({ ...def, units: [...def.units, ...blockers] }).create(fifth.id);
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
  runtime.setTurnAndPhase(2, "PLAYER"); resolve(runtime);
  assert.equal(runtime.getUnit("chao_gai_jiangzhou").hasTroops(), true);
  assert.equal(runtime.map.getPosition(runtime.getUnit("chao_gai_jiangzhou")), null);
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime).id, `${fifth.id}_chao_gai_jiangzhou_defeat`);
  assert.equal(runtime.validateRuntime(), true);
});

test("the real controller activates all seven rescuers in their arrival turn", { timeout: 10000 }, async () => {
  // Keep the synthetic leader alive through the real enemy AI to isolate arrival readiness.
  const def = definition(fifth);
  const runtime = factory({ ...def, units: def.units.map((unit) => unit.id === "song_jiang_jiangzhou"
    ? { ...unit, maxTroops: 5000 } : unit) }).create(fifth.id);
  const battle = controller(runtime);
  const completion = battle.startNewBattle();
  try {
    await idle(battle);
    assert.equal(await battle.endPlayerTurn(), true);
    assert.equal(battle.getBattleResult(), null);
    assert.equal(runtime.turn, 2);
    assert.equal(runtime.phase, "PLAYER");
    for (const unit of fifth.units.filter((u) => u.reserve)) assert.equal(runtime.getUnit(unit.id).actionState, "READY");
    assert.equal(runtime.validateRuntime(), true);
    assert.deepEqual(battle.getDiagnostics(), []);
  } finally { battle.dispose(); await completion.catch(() => {}); }
});

test("save/load before and after rescue preserves membership and avoids duplicate deployment", () => {
  for (const turn of [1, 2]) {
    const stageFactory = factory(definition(fifth)), runtime = stageFactory.create(fifth.id);
    runtime.setTurnAndPhase(turn, "PLAYER"); resolve(runtime);
    for (const unit of runtime.getUnits()) unit.setReadyForPhase(runtime.armyManager.playerArmy.has(unit)
      && runtime.map.getPosition(unit) !== null);
    const service = new SaveService({ stageFactory, repository: new SaveRepository({ storage: new MemoryStorage() }),
      codec: new SaveCodec(), migrator: new SaveMigrator(), writerId: "rescue_test" });
    const saved = service.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL,
      battle: createBattleSaveData(runtime, new BattleRandom(18)) });
    assert.equal(saved.ok, true);
    const inspection = service.inspectSlot("manual_01", SaveKind.MANUAL);
    const loaded = service.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard: inspection.guard }).stage;
    assert.equal(loaded.armyManager.playerArmy.getUnits().length, turn === 1 ? 8 : 15);
    loaded.setTurnAndPhase(2, "PLAYER");
    assert.equal(resolve(loaded).completedEvents.length, turn === 1 ? 1 : 0);
    assert.equal(loaded.armyManager.playerArmy.getUnits().length, 15);
    assert.equal(resolve(loaded).completedEvents.length, 0);
  }
});
