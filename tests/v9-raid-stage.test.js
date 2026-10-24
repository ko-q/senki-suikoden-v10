import test from "node:test";
import assert from "node:assert/strict";
import { Character, CharacterManager } from "../src/domain/character.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
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
import { BattleLogRecorder } from "../src/services/battle-log-recorder.js";

const source = V9_OPENING_STAGE_SOURCE[2];
// Canonical names/stats are not inferred; these values are test inputs only.
const characters = new CharacterManager(source.units.filter((u) => !u.mobCharacter).map((u) => new Character({
  id: u.characterId, name: `Test ${u.characterId}`, shortName: "T", martial: 50, command: 50,
  intelligence: 50, charisma: 50, source: "test_fixture" })));
const complete = "birthday-convoy_raid_complete", reinforcement = "birthday-convoy_reinforcement";
function stage(overrides = {}) {
  const definition = { ...createV9OpeningStageDefinition(source.id, characters), ...overrides };
  return new StageFactory({ definitions: [definition], characterManager: characters,
    terrainCatalog: createV9CompatibleTerrainCatalog() }).create(source.id);
}
function kill(runtime, id) {
  const unit = runtime.getUnit(id);
  unit.applyDamage(unit.maxTroops);
  unit.setReadyForPhase(false);
  runtime.map.removeUnit(unit);
}
function clearConvoy(runtime) {
  for (const unit of source.units.filter((u) => u.army === "ENEMY" && !u.reserve)) kill(runtime, unit.id);
}
function resolve(runtime, trigger = "AFTER_OPERATION") {
  return runtime.eventManager.resolveChain({ stage: runtime, trigger });
}

test("raid defines 16 initial units, 15 detached reserves and an inactive convoy cart", () => {
  const runtime = stage();
  assert.equal(runtime.getUnits().length, 31);
  assert.deepEqual(runtime.aiConfig.adviserUnits.map((u) => u.id), ["raid_adviser"]);
  assert.equal(runtime.armyManager.enemyArmy.getUnits().length, 8);
  assert.equal(runtime.armyManager.playerArmy.getUnits().length, 8);
  for (const reserve of source.units.filter((u) => u.reserve)) {
    assert.equal(runtime.map.getPosition(runtime.getUnit(reserve.id)), null);
    assert.equal(runtime.armyManager.getArmy(runtime.getUnit(reserve.id)), null);
  }
  assert.equal(runtime.getUnit("convoy_cart").actionState, "FINISHED");
  assert.equal(runtime.unitControlRules[0].canAct(runtime.eventManager), false);
  assert.equal(runtime.dialogueManager.get("birthday-convoy_arrival").speeches[0].actionLabel, "官軍増援");
  assert.equal(runtime.validateRuntime(), true);
});

test("the cart alone does not complete the raid, and early clearance allows escape before reinforcements", () => {
  const runtime = stage();
  kill(runtime, "convoy_cart");
  assert.equal(resolve(runtime).completedEvents.length, 0);
  runtime.map.moveUnit(runtime.getUnit("chao_gai"), { x: 3, y: 0 });
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  clearConvoy(runtime);
  assert.deepEqual(resolve(runtime).completedEvents.map((e) => e.id), [complete]);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, "birthday-convoy_escape");
  assert.equal(runtime.armyManager.enemyArmy.getUnits().length, 8);
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseStartDefeat(runtime), null);
});

test("turn five reinforcement waits for convoy clearance and spawns exactly once", () => {
  const runtime = stage();
  runtime.setTurnAndPhase(5, "PLAYER");
  assert.equal(resolve(runtime, "PHASE_START").completedEvents.length, 0);
  clearConvoy(runtime);
  const result = resolve(runtime, "UNIT_DEFEATED");
  assert.deepEqual(result.completedEvents.map((e) => e.id), [complete, reinforcement]);
  assert.equal(result.presentationRequests.length, 1);
  assert.equal(runtime.armyManager.enemyArmy.getUnits().length, 23);
  assert.equal(resolve(runtime).completedEvents.length, 0);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  for (const unit of source.units.filter((u) => u.reserve)) kill(runtime, unit.id);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, "birthday-convoy_annihilation");
  assert.equal(runtime.validateRuntime(), true);
});

test("early clearance waits for turn five player start, never turn five enemy phase", () => {
  const runtime = stage();
  runtime.setTurnAndPhase(4, "PLAYER");
  clearConvoy(runtime); resolve(runtime);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  runtime.setTurnAndPhase(5, "ENEMY");
  assert.equal(resolve(runtime, "PHASE_START").completedEvents.length, 0);
  assert.equal(resolve(runtime).completedEvents.length, 0);
  runtime.setTurnAndPhase(5, "PLAYER");
  assert.deepEqual(resolve(runtime, "PHASE_START").completedEvents.map((e) => e.id), [reinforcement]);
});

test("raid failure is checked at turn six player start and disabled once the convoy is cleared", () => {
  const runtime = stage();
  runtime.setTurnAndPhase(5, "PLAYER");
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseEndDefeat(runtime), null);
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseStartDefeat(runtime), null);
  runtime.setTurnAndPhase(6, "PLAYER");
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseStartDefeat(runtime).id, "birthday-convoy_raid_deadline");
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
  clearConvoy(runtime); resolve(runtime);
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseStartDefeat(runtime), null);
  runtime.setTurnAndPhase(15, "PLAYER");
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseEndDefeat(runtime).id, "birthday-convoy_turn_limit");
});

test("blocked reinforcement origins use nearby cells without occupying the same cell", () => {
  const runtime = stage();
  runtime.map.moveUnit(runtime.getUnit("chao_gai"), { x: 7, y: 15 });
  clearConvoy(runtime);
  runtime.setTurnAndPhase(5, "PLAYER"); resolve(runtime);
  assert.equal(runtime.map.getCellAt(7, 15).occupant.id, "chao_gai");
  assert.equal(runtime.map.getCellAt(7, 14).occupant.id, "raid_captain");
  assert.equal(runtime.validateRuntime(), true);
});

test("controller permits turn five enemy phase and ends the uncleared raid on turn six", { timeout: 10000 }, async () => {
  // Prevent combat only in this boundary fixture to isolate the deadline checkpoint.
  const runtime = stage({ unitControlRules: source.units.map((u) => ({ unitId: u.id, alwaysInactive: true })) });
  const battleRandom = new BattleRandom(17), movementService = new MovementService();
  const combatService = new CombatService(), tacticService = new TacticService(), statusService = new StatusService();
  const aiService = new AIService({ battleRandom, movementService, combatService, tacticService });
  const phases = [];
  const controller = new BattleController({ stage: runtime, battleRandom, movementService, combatService,
    tacticService, statusService, aiService, presentationPort: { async present(request) {
      if (request.type === "PHASE") phases.push(request);
    } } });
  const completion = controller.startNewBattle();
  try {
    for (let n = 0; controller.flowState !== BattleFlowState.IDLE && n < 100; n++) await new Promise(setImmediate);
    assert.equal(controller.flowState, BattleFlowState.IDLE);
    for (let n = 0; n < 5; n++) assert.equal(await controller.endPlayerTurn(), true);
    const result = await completion;
    assert.equal(result.outcome, "DEFEAT");
    assert.equal(result.turn, 6);
    assert.equal(result.objectiveId, "birthday-convoy_raid_deadline");
    assert.equal(runtime.phase, "PLAYER");
    assert.deepEqual(controller.getDiagnostics(), []);
    assert.equal(phases.length, 11);
  } finally { controller.dispose(); }
});

test("save and load preserve raid completion and never repeat the reinforcement", () => {
  for (const turn of [4, 5]) {
    const definition = createV9OpeningStageDefinition(source.id, characters);
    const stageFactory = new StageFactory({ definitions: [definition], characterManager: characters,
      terrainCatalog: createV9CompatibleTerrainCatalog() });
    const runtime = stageFactory.create(source.id), battleRandom = new BattleRandom(17);
    runtime.setTurnAndPhase(turn, "PLAYER");
    clearConvoy(runtime); resolve(runtime);
    new BattleLogRecorder(runtime).event(runtime.eventManager.get(complete));
    assert.deepEqual(runtime.battleLog.getEntries().map((entry) => entry.text), source.raid.completionMessages);
    const service = new SaveService({ stageFactory, repository: new SaveRepository({ storage: new MemoryStorage() }),
      codec: new SaveCodec(), migrator: new SaveMigrator(), writerId: "raid_test" });
    const saved = service.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL,
      battle: createBattleSaveData(runtime, battleRandom) });
    assert.equal(saved.ok, true);
    const inspection = service.inspectSlot("manual_01", SaveKind.MANUAL);
    const prepared = service.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard: inspection.guard });
    const loaded = prepared.stage;
    assert.deepEqual(loaded.battleLog.getEntries().map((entry) => entry.text), source.raid.completionMessages);
    assert.deepEqual(loaded.eventManager.get(complete).logMessages, source.raid.completionMessages);
    assert.deepEqual(loaded.eventManager.getCompletedEventIds(), runtime.eventManager.getCompletedEventIds());
    assert.equal(loaded.objectiveManager.evaluatePlayerPhaseStartDefeat(loaded), null);
    loaded.setTurnAndPhase(5, "PLAYER");
    assert.equal(resolve(loaded, "PHASE_START").completedEvents.length, turn === 4 ? 1 : 0);
    assert.equal(loaded.armyManager.enemyArmy.getUnits().length, 23);
    assert.equal(resolve(loaded).completedEvents.length, 0);
    assert.equal(loaded.validateRuntime(), true);
  }
});

test("after reinforcement, only Chao Gai entering the flag ends a loaded raid despite surviving pursuers", async () => {
  // Boundary setup: place one actor beside the flag after the mission transition.
  // This isolates the final escape command; it is not a chapter playthrough.
  for (const actorId of ["ruan_xiaoer", "chao_gai"]) {
    const definition = createV9OpeningStageDefinition(source.id, characters);
    const stageFactory = new StageFactory({ definitions: [definition], characterManager: characters,
      terrainCatalog: createV9CompatibleTerrainCatalog() });
    const initial = stageFactory.create(source.id), random = new BattleRandom(17);
    clearConvoy(initial);
    initial.setTurnAndPhase(5, "PLAYER");
    resolve(initial, "PHASE_START");
    initial.map.moveUnit(initial.getUnit(actorId), { x: 2, y: 0 });
    const saves = new SaveService({ stageFactory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "raid_escape_boundary" });
    assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: createBattleSaveData(initial, random) }).ok, true);
    const inspection = saves.inspectSlot("manual_01", SaveKind.MANUAL);
    const prepared = saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard: inspection.guard });
    const loaded = prepared.stage, battleRandom = new BattleRandom(17), requests = [];
    battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage: loaded, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } } });
    const completion = controller.resumeLoadedBattle(); completion.catch(() => {});
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      const actor = loaded.getUnit(actorId), path = controller.getCandidatePaths(actor, { x: 3, y: 0 })[0];
      assert.ok(path);
      assert.equal(await controller.executeWait(actor, path, "SOUTH"), true);
      assert.equal(loaded.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 15);
      if (actorId === "chao_gai") {
        const result = await completion;
        assert.equal(result.outcome, "VICTORY");
        assert.equal(result.objectiveId, "birthday-convoy_escape");
        assert.equal(actor.facing, "EAST");
        assert.equal(requests.at(-2).type, "BATTLE_RESULT");
        assert.equal(requests.at(-1).dialogue, loaded.victoryDialogue);
        assert.equal(loaded.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      } else {
        assert.equal(controller.getBattleResult(), null);
        assert.equal(requests.some(request => request.type === "BATTLE_RESULT"), false);
      }
      assert.equal(requests.some(request => request.type === "MISSION_BRIEFING" || request.dialogue === loaded.introDialogue
        || request.dialogue === loaded.dialogueManager.get("birthday-convoy_arrival")), false);
      assert.equal(loaded.validateRuntime(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
    } finally {
      controller.dispose();
      if (actorId !== "chao_gai") await assert.rejects(completion, { name: "AbortError" });
    }
  }
});
