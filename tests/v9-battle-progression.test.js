import { playOpeningEscape } from "../test-support/opening-escape-route.js";
import { playSecondChapter } from "../test-support/second-chapter-route.js";
import { playConvoyRaid } from "../test-support/convoy-raid-route.js";
import { playConvoyEscape } from "../test-support/convoy-escape-route.js";
import { playQingfengEscape } from "../test-support/qingfeng-escape-route.js";
import { JIANGZHOU_ESCAPE_ROUTE, playJiangzhouEscape } from "../test-support/jiangzhou-escape-route.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { SaveKind } from "../src/persistence/save-codec.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { SaveService } from "../src/services/save-service.js";
import { MemoryStorage } from "../test-support/memory-storage.js";
import test from "node:test";
import assert from "node:assert/strict";
import { createV9CharacterManager } from "../src/definitions/v9-characters.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { createActionQueryContext } from "../src/core/action-query-context.js";
import { createActionRequest } from "../src/core/action-request.js";
import { BattleController, MovementService, CombatService, TacticService, StatusService, AIService } from "../src/index.js";

const characters = createV9CharacterManager();
const factory = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
  definitions: V9_OPENING_STAGE_SOURCE.map((source) => createV9OpeningStageDefinition(source.id, characters)) });

test("real convoy clearance activates escape and saved turn four spawns the same reinforcements once", async () => {
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "raid_route" });
  const runtimes = [];
  const start = async (prepared = null) => {
    const stage = prepared?.stage ?? factory.create("birthday-convoy"), battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle();
    completion.catch(() => {});
    const runtime = { stage, battleRandom, controller, completion, requests };
    runtimes.push(runtime);
    for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
    assert.equal(controller.isStableForSave(), true);
    return runtime;
  };
  const saveAndPrepare = (runtime) => {
    assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL,
      battle: runtime.controller.createSaveSnapshot() }).ok, true);
    const inspection = saves.inspectSlot("manual_01", SaveKind.MANUAL);
    return saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard: inspection.guard });
  };
  const completeId = "birthday-convoy_raid_complete", reinforcementId = "birthday-convoy_reinforcement";
  try {
    const original = await start();
    await playConvoyRaid(original.controller);
    assert.equal(original.stage.turn, 4);
    assert.equal(original.stage.getUnit("chao_gai").troops, 146);
    assert.equal(original.stage.eventManager.isCompleted(completeId), true);
    assert.equal(original.stage.eventManager.isCompleted(reinforcementId), false);
    assert.equal(original.stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 0);
    assert.equal(original.controller.getBattleResult(), null, "clearing the convoy alone must not end this chapter");
    const restored = await start(saveAndPrepare(original));
    for (const runtime of [original, restored]) {
      assert.equal(await runtime.controller.endPlayerTurn(), true);
      assert.equal(runtime.stage.turn, 5);
      assert.equal(runtime.stage.phase, "PLAYER");
      assert.equal(runtime.stage.eventManager.isCompleted(reinforcementId), true);
      const enemies = runtime.stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops());
      assert.equal(enemies.length, 15);
      assert.equal(new Set(enemies.map(unit => runtime.stage.map.getPosition(unit).toKey())).size, 15);
      assert.equal(runtime.requests.filter(request => request.dialogue === runtime.stage.dialogueManager.get("birthday-convoy_arrival")).length, 1);
      assert.equal(runtime.stage.battleLog.getEntries().filter(entry => entry.text.includes("生辰綱を奪取した")).length, 1);
      assert.equal(runtime.controller.getBattleResult(), null);
      assert.equal(runtime.stage.validateRuntime(), true);
      assert.deepEqual(runtime.controller.getDiagnostics(), []);
    }
    assert.deepEqual(restored.controller.createSaveSnapshot(), original.controller.createSaveSnapshot());
    const afterArrival = await start(saveAndPrepare(original));
    assert.deepEqual(afterArrival.controller.createSaveSnapshot(), original.controller.createSaveSnapshot());
    assert.equal(afterArrival.requests.some(request => request.type === "DIALOGUE" || request.type === "MISSION_BRIEFING"), false);
  } finally {
    for (const runtime of runtimes) {
      runtime.controller.dispose();
      await assert.rejects(runtime.completion, { name: "AbortError" });
    }
  }
});

test("unmodified third chapter escapes in twelve turns identically after saves before and after pursuit arrival", async () => {
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "convoy_escape" });
  const checkpoints = new Map([[5, "manual_01"], [6, "manual_02"]]);
  const run = async (prepared = null, fromTurn = 1) => {
    const stage = prepared?.stage ?? factory.create("birthday-convoy"), battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle();
    completion.catch(() => {});
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      await playConvoyEscape(controller, { fromTurn, onCheckpoint() {
        if (stage.turn === 5) {
          assert.equal(stage.getUnit("escort5").troops, 12);
          assert.equal(stage.eventManager.isCompleted("birthday-convoy_raid_complete"), false);
          assert.equal(stage.eventManager.isCompleted("birthday-convoy_reinforcement"), false);
        }
        if (stage.turn === 6) {
          assert.equal(stage.eventManager.isCompleted("birthday-convoy_reinforcement"), true);
          assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 15);
        }
        if (!prepared && checkpoints.has(stage.turn)) assert.equal(saves.saveBattle({
          slotId: checkpoints.get(stage.turn), saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
      } });
      const result = await completion;
      assert.equal(result.outcome, "VICTORY"); assert.equal(result.turn, 12);
      assert.equal(result.objectiveId, "birthday-convoy_escape");
      assert.equal(stage.getUnit("chao_gai").troops, 19);
      assert.equal(stage.map.getPosition(stage.getUnit("chao_gai")).toKey(), "3,0");
      assert.equal(stage.getUnit("chao_gai").facing, "EAST");
      assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 13);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.text.includes("生辰綱を奪取した")).length, 1);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.filter(request => request.dialogue === stage.dialogueManager.get("birthday-convoy_arrival")).length, fromTurn > 5 ? 0 : 1);
      assert.equal(requests.at(-2).type, "BATTLE_RESULT");
      assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); }
  };
  const uninterrupted = await run();
  for (const [turn, slotId] of checkpoints) {
    const inspection = saves.inspectSlot(slotId, SaveKind.MANUAL);
    const prepared = saves.prepareLoad({ slotId, saveKind: SaveKind.MANUAL, guard: inspection.guard });
    assert.deepEqual(await run(prepared, turn), uninterrupted);
  }
});

test("fourth chapter escapes with pursuers alive and preserves the outcome across two save checkpoints", async () => {
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "qingfeng_route" });
  const checkpoints = new Map([[3, "manual_01"], [6, "manual_02"]]);
  const run = async (prepared = null, fromTurn = 1) => {
    const stage = prepared?.stage ?? factory.create("qingfeng-fort"), battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    let recoveryClears = 0;
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } },
      checkpointPort: { requestRecoverySave() {}, requestRecoveryClear() { recoveryClears++; } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle();
    completion.catch(() => {});
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      await playQingfengEscape(controller, { fromTurn, onCheckpoint() {
        if (stage.turn === 3) {
          assert.equal(stage.getUnit("qingzhou3").getStatusTurns("CONFUSED"), 1);
          assert.equal(stage.getUnit("qingzhou6").getStatusTurns("CONFUSED"), 1);
          assert.equal(stage.getUnit("song_jiang").troops, 149);
        }
        if (stage.turn === 6) {
          assert.equal(stage.armyManager.playerArmy.getUnits().filter(unit => unit.hasTroops()).length, 1);
          assert.equal(stage.getUnit("song_jiang").troops, 116);
          assert.equal(controller.getBattleResult(), null);
        }
        if (!prepared && checkpoints.has(stage.turn)) assert.equal(saves.saveBattle({
          slotId: checkpoints.get(stage.turn), saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
      } });
      assert.deepEqual(await completion, { stageId: "qingfeng-fort", outcome: "VICTORY", objectiveId: "qingfeng-fort_escape", turn: 6, phase: "PLAYER" });
      const leader = stage.getUnit("song_jiang");
      assert.equal(leader.troops, 116);
      assert.equal(stage.map.getPosition(leader).toKey(), "3,0");
      assert.equal(leader.facing, "NORTH");
      assert.equal(leader.actionState, "MOVED", "escape must not require a wait command");
      assert.deepEqual(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).map(unit => unit.id),
        ["qin_ming", "huang_xin", "qingzhou2", "qingzhou3"]);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.filter(request => request.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.at(-2).type, "BATTLE_RESULT");
      assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      assert.equal(recoveryClears, 1);
      assert.equal(requests.filter(request => request.dialogue === stage.introDialogue).length, prepared ? 0 : 1);
      assert.equal(requests.filter(request => request.type === "MISSION_BRIEFING").length, prepared ? 0 : 1);
      assert.equal(stage.validateRuntime(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); }
  };
  const original = await run();
  for (const [turn, slotId] of checkpoints) {
    const inspection = saves.inspectSlot(slotId, SaveKind.MANUAL);
    const prepared = saves.prepareLoad({ slotId, saveKind: SaveKind.MANUAL, guard: inspection.guard });
    assert.deepEqual(await run(prepared, turn), original, `turn ${turn} reload must preserve units, status, uses, RNG and logs`);
  }
});

test("fifth chapter rescue and two-person escape remain identical across arrival and partial-escape saves", async () => {
  const id = "jiangzhou-execution-ground", rescueId = `${id}_rescue`;
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "jiangzhou_route" });
  const checkpoints = new Map([
    [`1:${JIANGZHOU_ESCAPE_ROUTE[0].length}`, null], ["2:0", null], ["5:5", null], ["7:0", null]
  ]);
  const run = async (prepared = null, fromTurn = 1, fromCommand = 0) => {
    const stage = prepared?.stage ?? factory.create(id), battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    let recoveryClears = 0;
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } },
      checkpointPort: { requestRecoverySave() {}, requestRecoveryClear() { recoveryClears++; } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle();
    completion.catch(() => {});
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      await playJiangzhouEscape(controller, { fromTurn, fromCommand, onCheckpoint(_, { turn, commandIndex }) {
        const key = `${turn}:${commandIndex}`;
        if (!checkpoints.has(key)) return;
        assert.equal(controller.getBattleResult(), null);
        assert.equal(controller.isStableForSave(), true);
        assert.equal(stage.eventManager.isCompleted(rescueId), turn >= 2);
        const chao = stage.getUnit("chao_gai_jiangzhou"), song = stage.getUnit("song_jiang_jiangzhou");
        if (turn === 1) {
          assert.equal(stage.map.getPosition(chao), null);
          assert.equal(stage.armyManager.playerArmy.getUnits().length, 8);
        }
        if (turn === 2) {
          assert.equal(song.troops, 63);
          const rescuers = V9_OPENING_STAGE_SOURCE.find(source => source.id === id).units.filter(unit => unit.reserve);
          assert.equal(rescuers.length, 7);
          for (const definition of rescuers) {
            const unit = stage.getUnit(definition.id);
            assert.deepEqual({ ...stage.map.getPosition(unit) }, definition.position);
            assert.equal(unit.actionState, "READY");
          }
        }
        if (turn === 5) {
          assert.equal(stage.map.getPosition(chao).toKey(), "3,1");
          assert.equal(chao.actionState, "FINISHED");
          assert.equal(stage.map.getPosition(song).toKey(), "3,5");
          assert.equal(song.actionState, "FINISHED");
        }
        if (turn === 7) {
          assert.equal(stage.map.getPosition(chao).toKey(), "4,0");
          assert.equal(stage.map.getPosition(song).toKey(), "3,2");
          assert.equal(song.troops, 10);
        }
        if (!prepared) {
          assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
          const inspection = saves.inspectSlot("manual_01", SaveKind.MANUAL);
          checkpoints.set(key, saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard: inspection.guard }));
        }
      } });
      assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_escape`, turn: 7, phase: "PLAYER" });
      const song = stage.getUnit("song_jiang_jiangzhou"), chao = stage.getUnit("chao_gai_jiangzhou");
      assert.equal(song.troops, 10); assert.equal(chao.troops, 146);
      assert.equal(stage.map.getPosition(song).toKey(), "3,0");
      assert.equal(stage.map.getPosition(chao).toKey(), "4,0");
      assert.equal(song.facing, "NORTH"); assert.equal(song.actionState, "MOVED");
      assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 28);
      assert.equal(stage.armyManager.playerArmy.getUnits().length, 15, "rescue must not duplicate army members");
      const arrival = stage.dialogueManager.get(`${id}_arrival`);
      assert.equal(requests.filter(request => request.dialogue === arrival).length, fromTurn < 2 ? 1 : 0);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "EVENT" && entry.unitIds.includes(chao.id)).length, 1);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.filter(request => request.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.at(-2).type, "BATTLE_RESULT");
      assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      assert.equal(requests.filter(request => request.dialogue === stage.introDialogue).length, prepared ? 0 : 1);
      assert.equal(requests.filter(request => request.type === "MISSION_BRIEFING").length, prepared ? 0 : 1);
      assert.equal(recoveryClears, 1);
      assert.equal(stage.validateRuntime(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  for (const [key, prepared] of checkpoints) {
    const [turn, command] = key.split(":").map(Number);
    assert.deepEqual(await run(prepared, turn, command), original, `checkpoint ${key} must preserve units, events, status, uses, RNG and logs`);
  }
});

test("unmodified second chapter wins in eight turns, identically after a mid-battle save and load", async () => {
  const service = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "second_route" });
  const run = async (prepared = null) => {
    const stage = prepared?.stage ?? factory.create("wild-boar-forest"), battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle();
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      await playSecondChapter(controller, { fromTurn: prepared ? 5 : 1, onCheckpoint(state) {
        assert.equal(state.validateRuntime(), true);
        if (!prepared && state.turn === 5) {
          assert.equal(service.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL,
            battle: createBattleSaveData(state, battleRandom) }).ok, true);
        }
      } });
      const result = await completion;
      assert.equal(result.outcome, "VICTORY"); assert.equal(result.turn, 8);
      assert.equal(result.objectiveId, "wild-boar-forest_annihilation");
      assert.equal(stage.getUnit("lin_chong").troops, 32); assert.equal(stage.getUnit("lu_zhishen").troops, 3);
      assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 0);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.at(-2).type, "BATTLE_RESULT"); assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); }
  };
  const uninterrupted = await run();
  const inspection = service.inspectSlot("manual_01", SaveKind.MANUAL);
  const prepared = service.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard: inspection.guard });
  assert.deepEqual(await run(prepared), uninterrupted);
});

// A defensive smoke playthrough, not a strategy/balance or manual UI acceptance test.
for (const source of V9_OPENING_STAGE_SOURCE) test(`real chapter ${source.id} reaches a battle result through public commands`, { timeout: 120000 }, async (t) => {
  const stage = factory.create(source.id), random = new BattleRandom(734);
  const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
  const controller = new BattleController({ stage, battleRandom: random, movementService, combatService, tacticService,
    statusService: new StatusService(), aiService: new AIService({ battleRandom: random, movementService, combatService, tacticService }) });
  const completion = controller.startNewBattle();
  try {
    for (let attempt = 0; attempt < 200 && !controller.isStableForSave() && !controller.getBattleResult(); attempt++) await new Promise((resolve) => setImmediate(resolve));
    let commands = 0;
    while (!controller.getBattleResult() && stage.turn <= source.turnLimit) {
      assert.equal(controller.flowState, "IDLE", `${source.id}: initialization/phase must finish`);
      for (const unit of stage.unitOrder) {
        if (controller.getBattleResult()) break;
        if (!stage.armyManager.playerArmy.has(unit) || !unit.hasTroops() || !stage.map.getPosition(unit) || unit.actionState !== "READY") continue;
        const query = createActionQueryContext(unit, stage.map.getPosition(unit));
        const actions = controller.getAvailableActions(query);
        if (actions.length) {
          const type = actions[0], target = controller.getActionTargets(query, type)[0];
          assert.equal(await controller.executeAction(createActionRequest(type, unit, target), []), true);
          if (unit.actionState === "TACTIC_COMMITTED" && !controller.getBattleResult()) assert.equal(await controller.finalizeTacticFacing(unit, unit.facing), true);
        } else assert.equal(await controller.executeWait(unit, [], unit.facing), true);
        assert.ok(++commands < 2000, "bounded progression");
      }
      if (!controller.getBattleResult()) assert.equal(await controller.endPlayerTurn(), true);
      assert.equal(stage.validateRuntime(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
    }
    const result = await completion;
    assert.ok(["VICTORY", "DEFEAT"].includes(result.outcome));
    assert.equal(stage.battleLog.getEntries().filter((entry) => entry.type === "BATTLE_RESULT").length, 1);
    t.diagnostic(`${source.title}: ${result.outcome}, turn ${stage.turn}, ${commands} commands, ${stage.battleLog.getEntries().length} log entries`);
  } finally { controller.dispose(); }
});


test("unmodified first chapter escapes in six turns identically after four saves and presents victory before closing dialogue", async () => {
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "opening_escape" });
  const checkpoints = new Map();
  const run = async (checkpoint = null) => {
    const prepared = checkpoint?.prepared, stage = prepared?.stage ?? factory.create("shaohuashan-road");
    const battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle(); completion.catch(() => {});
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      await playOpeningEscape(controller, { fromTurn: checkpoint?.turn ?? 1, fromCommand: checkpoint?.commandIndex ?? 0,
        onCheckpoint(_, cursor) {
          assert.equal(stage.validateRuntime(), true);
          const key = `${cursor.turn}:${cursor.commandIndex}`;
          if (prepared || checkpoints.has(key) || !["1:1", "3:0", "5:1", "6:0"].includes(key)) return;
          assert.equal(controller.getBattleResult(), null);
          assert.equal(controller.isStableForSave(), true);
          assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
          const guard = saves.inspectSlot("manual_01", SaveKind.MANUAL).guard;
          checkpoints.set(key, { ...cursor, prepared: saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard }) });
        }
      });
      assert.deepEqual(await completion, { stageId: "shaohuashan-road", outcome: "VICTORY",
        objectiveId: "shaohuashan-road_escape", turn: 6, phase: "PLAYER" });
      assert.equal(stage.getUnit("shi_jin").troops, 55);
      assert.equal(stage.map.getPosition(stage.getUnit("shi_jin")).toKey(), "3,0");
      assert.equal(requests.at(-2).type, "BATTLE_RESULT");
      assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      assert.equal(requests.filter(request => request.type === "BATTLE_RESULT").length, 1);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  assert.deepEqual([...checkpoints.keys()], ["1:1", "3:0", "5:1", "6:0"]);
  for (const [name, checkpoint] of checkpoints) assert.deepEqual(await run(checkpoint), original, name);
});
