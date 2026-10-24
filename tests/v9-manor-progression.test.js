import test from "node:test";
import assert from "node:assert/strict";
import { createV9CharacterManager } from "../src/definitions/v9-characters.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { SaveKind } from "../src/persistence/save-codec.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { SaveService } from "../src/services/save-service.js";
import { MemoryStorage } from "../test-support/memory-storage.js";
import { BattleRandom, BattleController, MovementService, CombatService, TacticService, StatusService, AIService } from "../src/index.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { MANOR_VICTORY_ROUTE, playManorVictory } from "../test-support/manor-victory-route.js";

test("sixth chapter wins in eighteen turns identically after saves around betrayal and the final attack", async () => {
  const id = "zhu-family-manor", characters = createV9CharacterManager();
  const factory = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] });
  const source = V9_OPENING_STAGE_SOURCE.find(stage => stage.id === id);
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "manor_victory" });
  const checkpoints = new Map([[`3:${MANOR_VICTORY_ROUTE[2].length}`, null], ["4:0", null], ["5:0", null], ["18:1", null]]);
  const run = async (prepared = null, fromTurn = 1, fromCommand = 0) => {
    const stage = prepared?.stage ?? factory.create(id), battleRandom = new BattleRandom(1), requests = [];
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
      await playManorVictory(controller, { fromTurn, fromCommand, onCheckpoint(_, { turn, commandIndex }) {
        const key = `${turn}:${commandIndex}`;
        if (!checkpoints.has(key)) return;
        assert.equal(controller.getBattleResult(), null);
        assert.equal(controller.isStableForSave(), true);
        assert.equal(stage.eventManager.isCompleted(`${id}_betrayal`), turn >= 4);
        if (turn <= 4) {
          for (const unitId of source.betrayal.unitIds) {
            const unit = stage.getUnit(unitId);
            assert.equal(stage.armyManager.getAffiliation(unit), turn === 3 ? "ENEMY" : "PLAYER");
            assert.equal(unit.actionState, turn === 3 ? "FINISHED" : "READY");
            assert.equal(unit.troops, unit.maxTroops);
          }
          if (turn === 4) {
            const enemies = stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops());
            assert.equal(enemies.length, 44);
            assert.equal(enemies.every(unit => unit.getStatusTurns("CONFUSED") >= 1), true);
            const log = stage.battleLog.getEntries().filter(entry => entry.text.includes("内応に動揺"));
            assert.equal(log.length, 1);
            assert.deepEqual(new Set(log[0].unitIds), new Set(enemies.map(unit => unit.id)));
          }
        }
        if (turn === 18) {
          assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 1);
          assert.equal(stage.getUnit("song_jiang_zhujia").troops, 71);
        }
        if (!prepared) {
          assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
          const guard = saves.inspectSlot("manual_01", SaveKind.MANUAL).guard;
          checkpoints.set(key, saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard }));
        }
      } });
      assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_annihilation`, turn: 18, phase: "PLAYER" });
      assert.equal(stage.getUnit("song_jiang_zhujia").troops, 71);
      assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 0);
      assert.equal(stage.armyManager.playerArmy.getUnits().filter(unit => unit.hasTroops()).length, 7);
      assert.equal(stage.armyManager.playerArmy.getUnits().length, 28, "betrayal must not duplicate members");
      assert.equal(stage.getHiddenTraps().every(trap => trap.active), true);
      assert.equal(requests.filter(request => request.dialogue === stage.dialogueManager.get(`${id}_arrival`)).length, fromTurn < 4 ? 1 : 0);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.text.includes("内応に動揺")).length, 1);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.filter(request => request.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.at(-2).type, "BATTLE_RESULT"); assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.equal(recoveryClears, 1);
      assert.equal(stage.validateRuntime(), true); assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  for (const [key, prepared] of checkpoints) {
    const [turn, command] = key.split(":").map(Number);
    assert.deepEqual(await run(prepared, turn, command), original, `resume ${key}`);
  }
});

test("unmodified sixth chapter preserves its trap encounter and turn-four betrayal across three save boundaries", async () => {
  const id = "zhu-family-manor", characters = createV9CharacterManager();
  const factory = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] });
  const source = V9_OPENING_STAGE_SOURCE.find(stage => stage.id === id);
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "manor_progression" });
  const checkpoints = new Map([[1, "manual_01"], [3, "manual_02"], [4, "manual_03"]]);
  const snapshots = new Map();
  const run = async (prepared = null) => {
    const stage = prepared?.stage ?? factory.create(id), battleRandom = new BattleRandom(1), requests = [], recovery = [];
    if (prepared) battleRandom.importState(prepared.randomState);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
      presentationPort: { async present(request) { requests.push(request); } },
      checkpointPort: { requestRecoverySave(snapshot) { recovery.push(snapshot); }, requestRecoveryClear() {} } });
    const startingTurn = stage.turn;
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle(); completion.catch(() => {});
    const checkpoint = () => {
      assert.equal(controller.isStableForSave(), true);
      assert.equal(stage.validateRuntime(), true);
      assert.equal(controller.getBattleResult(), null);
      if (!prepared && checkpoints.has(stage.turn)) {
        const battle = controller.createSaveSnapshot(); snapshots.set(stage.turn, battle);
        assert.equal(saves.saveBattle({ slotId: checkpoints.get(stage.turn), saveKind: SaveKind.MANUAL, battle }).ok, true);
      }
    };
    try {
      for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
      assert.equal(controller.isStableForSave(), true);
      if (prepared) {
        assert.deepEqual(controller.createSaveSnapshot(), snapshots.get(startingTurn));
        assert.equal(requests.some(request => request.type === "DIALOGUE" || request.type === "MISSION_BRIEFING"), false);
      } else {
        assert.equal(stage.getUnits().length, 80);
        const actor = stage.getUnit("wang_ying_zhujia"), troops = actor.troops, random = battleRandom.exportState();
        const path = controller.getCandidatePaths(actor, { x: 3, y: 14 })[0];
        assert.equal(controller.canExecuteImmediateMove(actor, path), true);
        assert.equal(await controller.executeImmediateMove(actor, path), true);
        assert.equal(stage.map.getPosition(actor).toKey(), "3,14");
        assert.equal(actor.troops, troops - 20);
        assert.equal(actor.getStatusTurns("CONFUSED"), 1);
        assert.equal(actor.actionState, "FINISHED");
        assert.equal(actor.facing, "NORTH");
        assert.deepEqual(battleRandom.exportState(), random);
        assert.deepEqual(recovery.at(-1), controller.createSaveSnapshot());
      }
      checkpoint();
      while (stage.turn < 4) {
        for (const unitId of source.betrayal.unitIds) {
          assert.equal(stage.armyManager.getAffiliation(stage.getUnit(unitId)), "ENEMY");
          assert.equal(stage.getUnit(unitId).actionState, "FINISHED");
        }
        // Public wait/turn commands only: the enemy AI remains active and casualties are real.
        for (const unit of stage.armyManager.playerArmy.getUnits()) {
          if (unit.hasTroops() && unit.actionState === "READY") assert.equal(await controller.executeWait(unit, [], unit.facing), true);
        }
        assert.equal(await controller.endPlayerTurn(), true);
        checkpoint();
      }
      assert.equal(stage.eventManager.isCompleted(`${id}_betrayal`), true);
      for (const unitId of source.betrayal.unitIds) {
        const unit = stage.getUnit(unitId);
        assert.equal(stage.armyManager.getAffiliation(unit), "PLAYER");
        assert.equal(unit.actionState, "READY"); assert.equal(unit.facing, "NORTH");
        assert.equal(unit.troops, unit.maxTroops);
      }
      const enemies = stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops());
      assert.equal(enemies.length, 52);
      assert.equal(enemies.every(unit => unit.getStatusTurns("CONFUSED") === 1), true);
      const confusionLog = stage.battleLog.getEntries().filter(entry => entry.type === "EVENT" && entry.text.includes("内応に動揺"));
      assert.equal(confusionLog.length, 1);
      assert.deepEqual(new Set(confusionLog[0].unitIds), new Set(enemies.map(unit => unit.id)));
      const mobCount = enemies.filter(unit => stage.mobCharacters.includes(unit.character)).length;
      assert.equal(confusionLog[0].text, `敵軍は内応に動揺。固有人物${52 - mobCount}隊・モブ${mobCount}隊が撹乱状態となった。`);
      assert.equal(stage.getHiddenTraps().filter(trap => !trap.active).length, 1);
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "TRAP").length, 1);
      assert.equal(requests.filter(request => request.dialogue === stage.dialogueManager.get(`${id}_arrival`)).length,
        prepared && startingTurn === 4 ? 0 : 1);
      const aware = stage.getUnit("zou_yuan_zhujia"), path = controller.getCandidatePaths(aware, { x: 2, y: 10 })[0];
      const trap = stage.getHiddenTraps().find(trap => trap.position.toKey() === "2,10");
      assert.equal(trap.active, true);
      assert.equal(controller.canExecuteImmediateMove(aware, path), false);
      assert.equal(await controller.executeWait(aware, path, "NORTH"), true);
      assert.equal(stage.map.getPosition(aware).toKey(), "2,10");
      assert.equal(aware.troops, aware.maxTroops); assert.equal(aware.getStatusTurns("CONFUSED"), 0);
      assert.equal(trap.active, true);
      assert.deepEqual(controller.getDiagnostics(), []);
      return controller.createSaveSnapshot();
    } finally { controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); }
  };
  const uninterrupted = await run();
  for (const [turn, slotId] of checkpoints) {
    const guard = saves.inspectSlot(slotId, SaveKind.MANUAL).guard;
    const prepared = saves.prepareLoad({ slotId, saveKind: SaveKind.MANUAL, guard });
    assert.equal(prepared.stage.turn, turn);
    assert.deepEqual(await run(prepared), uninterrupted);
  }
});
