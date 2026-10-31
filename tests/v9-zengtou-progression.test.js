import test from "node:test";
import assert from "node:assert/strict";
import { createV9CharacterManager } from "../src/definitions/v9-characters.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { SaveKind } from "../src/persistence/save-codec.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { SaveService } from "../src/services/save-service.js";
import { MemoryStorage } from "../test-support/memory-storage.js";
import { BattleRandom, BattleController, MovementService, CombatService, TacticService, StatusService, AIService } from "../src/index.js";
import { ZENGTOU_EVENT_ROUTE, playZengtouEvents } from "../test-support/zengtou-event-route.js";
import { ZENGTOU_VICTORY_ROUTE, playZengtouVictory } from "../test-support/zengtou-victory-route.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";

const id = "zengtou-fortress";
const rescuers = ["guan_sheng_zengtou", "xu_ning_zengtou", "shan_tinggui_zengtou", "wei_dingguo_zengtou"];

test("ninth chapter wins from the original formation and reproduces six saves through relief, elemental attacks, defection and the final blow", async () => {
  const characters = createV9CharacterManager();
  const factory = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] });
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "zengtou_victory" });
  const checkpoints = new Map();
  const checkpointKeys = [`1:${ZENGTOU_VICTORY_ROUTE[0].length}`, "2:0", "4:16", `5:${ZENGTOU_VICTORY_ROUTE[4].length}`, "6:0", "14:3"];
  const run = async (checkpoint = null) => {
    const prepared = checkpoint?.prepared, stage = prepared?.stage ?? factory.create(id), battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    let recoveryClears = 0;
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } },
      checkpointPort: { requestRecoverySave() {}, requestRecoveryClear() { recoveryClears++; } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle(); completion.catch(() => {});
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      await playZengtouVictory(controller, { fromTurn: checkpoint?.turn ?? 1, fromCommand: checkpoint?.commandIndex ?? 0,
        onCheckpoint(_, cursor) {
          const key = `${cursor.turn}:${cursor.commandIndex}`;
          if (!checkpointKeys.includes(key)) return;
          assert.equal(controller.getBattleResult(), null);
          assert.equal(controller.isStableForSave(), true);
          assert.equal(stage.eventManager.isCompleted(`${id}_relief`), cursor.turn >= 2);
          assert.equal(stage.eventManager.isCompleted(`${id}_defection`), cursor.turn >= 6);
          assert.equal(stage.getUnit("qin_ming_zengtou").hasTroops(), cursor.turn === 1);
          assert.equal(stage.armyManager.getAffiliation(stage.getUnit("yu_baosi")), cursor.turn < 6 ? "ENEMY" : "PLAYER");
          if (key === "2:0") for (const unitId of rescuers) {
            assert.equal(stage.getUnit(unitId).troops, stage.getUnit(unitId).maxTroops);
            assert.equal(stage.getUnit(unitId).actionState, "READY");
          }
          if (key === "4:16") {
            assert.equal(stage.getUnit("shan_tinggui_zengtou").remainingUses.strategy, 0);
            assert.equal(stage.getUnit("wei_dingguo_zengtou").remainingUses.strategy, 1);
          }
          if (key === "6:0") assert.equal(stage.getUnit("yu_baosi").actionState, "READY");
          if (key === "14:3") {
            assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 1);
            assert.equal(stage.getUnit("zeng_mi").hasTroops(), true);
            assert.equal(stage.getUnit("xiang_chong_zengtou").actionState, "READY");
          }
          if (prepared || checkpoints.has(key)) return;
          assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
          const guard = saves.inspectSlot("manual_01", SaveKind.MANUAL).guard;
          checkpoints.set(key, { ...cursor, prepared: saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard }) });
        }
      });
      assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_annihilation`, turn: 14, phase: "PLAYER" });
      assert.equal(stage.getUnit("song_jiang_zengtou").troops, 149);
      assert.equal(stage.getUnit("lu_junyi_zengtou").troops, 41);
      assert.equal(stage.armyManager.playerArmy.getUnits().filter(unit => unit.hasTroops()).length, 11);
      assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 0);
      assert.equal(stage.armyManager.playerArmy.getUnits().length, 36);
      const expectedDialogues = [
        ...((checkpoint?.turn ?? 1) < 2 ? [`${id}_relief`] : []),
        ...((checkpoint?.turn ?? 1) < 6 ? [`${id}_defection`] : []), stage.victoryDialogue.id
      ];
      // Tactic reactions are interleaved; the chapter event sequence remains unchanged.
      assert.deepEqual(requests.filter(request => request.type === "DIALOGUE" && request.dialogue !== stage.introDialogue
        && request.dialogue.id !== "tactic_success")
        .map(request => request.dialogue.id), expectedDialogues);
      assert.equal(requests.filter(request => request.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.at(-2).type, "BATTLE_RESULT");
      assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(recoveryClears, 1);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.equal(stage.validateRuntime(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  assert.deepEqual([...checkpoints.keys()], checkpointKeys);
  for (const [name, checkpoint] of checkpoints) assert.deepEqual(await run(checkpoint), original, name);
});

test("ninth chapter preserves simultaneous defection and relief across saves before, after and during their first actions", async () => {
  const characters = createV9CharacterManager();
  const factory = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] });
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "zengtou_events" });
  const checkpoints = new Map();
  const run = async (checkpoint = null) => {
    const prepared = checkpoint?.prepared, stage = prepared?.stage ?? factory.create(id), battleRandom = new BattleRandom(1), requests = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } } });
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle(); completion.catch(() => {});
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      if (!prepared) {
        assert.equal(stage.getUnits().length, 95);
        assert.equal(stage.armyManager.playerArmy.getUnits().length, 31);
        assert.equal(stage.armyManager.enemyArmy.getUnits().length, 60);
      }
      await playZengtouEvents(controller, { fromTurn: checkpoint?.turn ?? 1, fromCommand: checkpoint?.commandIndex ?? 0,
        onCheckpoint(_, cursor) {
          const key = `${cursor.turn}:${cursor.commandIndex}`;
          if (![ `5:${ZENGTOU_EVENT_ROUTE[4].length}`, "6:0", "6:5", `6:${ZENGTOU_EVENT_ROUTE[5].length}` ].includes(key)) return;
          assert.equal(controller.getBattleResult(), null);
          assert.equal(controller.isStableForSave(), true);
          const yu = stage.getUnit("yu_baosi");
          assert.equal(stage.armyManager.getAffiliation(yu), cursor.turn === 5 ? "ENEMY" : "PLAYER");
          assert.equal(stage.getUnit("qin_ming_zengtou").hasTroops(), cursor.turn === 5);
          assert.deepEqual(stage.eventManager.getCompletedEventIds(), cursor.turn === 5 ? [] : [`${id}_defection`, `${id}_relief`]);
          if (key === "6:0") {
            assert.equal(yu.troops, 130);
            assert.equal(yu.actionState, "READY");
            assert.equal(stage.map.getPosition(yu).toKey(), "3,10");
            assert.equal(yu.facing, "SOUTH");
            for (const [index, unitId] of rescuers.entries()) {
              const unit = stage.getUnit(unitId);
              assert.equal(stage.armyManager.getAffiliation(unit), "PLAYER");
              assert.equal(unit.troops, unit.maxTroops);
              assert.equal(unit.actionState, "READY");
              assert.equal(stage.map.getPosition(unit).toKey(), ["0,18", "7,18", "0,19", "7,19"][index]);
            }
          }
          if (prepared || checkpoints.has(key)) return;
          assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
          const guard = saves.inspectSlot("manual_01", SaveKind.MANUAL).guard;
          checkpoints.set(key, { ...cursor, prepared: saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard }) });
        }
      });
      assert.equal(stage.turn, 6);
      assert.equal(stage.phase, "PLAYER");
      assert.equal(controller.getBattleResult(), null, "this route verifies events, not victory");
      assert.equal(stage.armyManager.playerArmy.getUnits().length, 36, "one defector and four rescuers join exactly once");
      for (const unitId of ["yu_baosi", ...rescuers]) assert.equal(stage.getUnit(unitId).actionState, "FINISHED");
      const eventDialogues = requests.filter(request => request.type === "DIALOGUE" && request.dialogue !== stage.introDialogue
        && request.dialogue.id !== "tactic_success");
      assert.deepEqual(eventDialogues.map(request => request.dialogue.id), checkpoint?.turn === 6 ? [] : [`${id}_defection`, `${id}_relief`]);
      const eventLogs = stage.battleLog.getEntries().filter(entry => entry.type === "EVENT");
      assert.equal(eventLogs.filter(entry => entry.text.includes("郁保四が寝返った")).length, 1);
      assert.equal(eventLogs.filter(entry => entry.unitIds.includes("guan_sheng_zengtou")).length, 1);
      assert.equal(requests.some(request => request.type === "BATTLE_RESULT"), false);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.equal(stage.validateRuntime(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
      return controller.createSaveSnapshot();
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  assert.equal(checkpoints.size, 4);
  for (const [name, checkpoint] of checkpoints) assert.deepEqual(await run(checkpoint), original, name);
});
