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
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { playSorceryVictory } from "../test-support/sorcery-victory-route.js";

const id = "gaotang-prefecture";
const living = army => army.getUnits().filter(unit => unit.hasTroops());
function createFactory() {
  const characters = createV9CharacterManager();
  return new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] });
}
function createRuntime(stage, prepared = null) {
  const battleRandom = new BattleRandom(1), requests = [];
  if (prepared) battleRandom.importState(prepared.randomState);
  const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
  const controller = new BattleController({ stage, battleRandom, movementService, combatService, tacticService,
    statusService: new StatusService(), aiService: new AIService({ battleRandom, movementService, combatService, tacticService }),
    presentationPort: { async present(request) { requests.push(request); } } });
  return { stage, battleRandom, requests, controller };
}
async function ready(controller) {
  for (let n = 0; n < 200 && !controller.isStableForSave(); n++) await new Promise(setImmediate);
  assert.equal(controller.isStableForSave(), true);
}
function saveAndPrepare(saves, controller) {
  assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
  const guard = saves.inspectSlot("manual_01", SaveKind.MANUAL).guard;
  return saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard });
}

test("seventh chapter wins from its original formation, with identical saves through illusion, both sorcerers' defeat and the final attack", async () => {
  const factory = createFactory(), checkpoints = new Map();
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "sorcery_victory" });
  const run = async (checkpoint = null) => {
    const prepared = checkpoint?.prepared;
    const { stage, battleRandom, requests, controller } = createRuntime(prepared?.stage ?? factory.create(id), prepared);
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle(); completion.catch(() => {});
    try {
      await ready(controller);
      await playSorceryVictory(controller, { fromTurn: checkpoint?.turn ?? 1, fromCommand: checkpoint?.commandIndex ?? 0,
        onCheckpoint(_, cursor) {
          if (prepared || controller.getBattleResult()) return;
          const candidates = [
            ["illusion", living(stage.armyManager.playerArmy).some(unit => unit.getStatusTurns("ILLUSION") > 0)],
            ["suppressor_defeated", !stage.getUnit("gongsun_sheng_gaotang").hasTroops()],
            ["wide_illusion", stage.battleLog.getEntries().some(entry => entry.text.includes("高廉の広域幻術"))],
            ["gao_defeated", !stage.getUnit("gao_lian").hasTroops() && living(stage.armyManager.enemyArmy).length > 0],
            ["final_attack", cursor.turn === 18 && cursor.commandIndex === 0]
          ];
          for (const [name, reached] of candidates) if (reached && !checkpoints.has(name)) {
            assert.equal(controller.getBattleResult(), null);
            assert.equal(controller.isStableForSave(), true, JSON.stringify({ name, ...cursor,
              units: stage.getUnits().filter(unit => !unit.hasTroops() && unit.actionState !== "FINISHED").map(unit => [unit.id, unit.actionState]) }));
            checkpoints.set(name, { ...cursor, prepared: saveAndPrepare(saves, controller) });
          }
        }
      });
      assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_annihilation`, turn: 18, phase: "PLAYER" });
      assert.equal(stage.getUnit("song_jiang_gaotang").troops, 149);
      assert.equal(living(stage.armyManager.enemyArmy).length, 0);
      assert.equal(living(stage.armyManager.playerArmy).length, 5);
      assert.deepEqual(stage.getHiddenTraps().map(trap => trap.active), [true, false, true, true]);
      assert.equal(stage.eventManager.isCompleted(`${id}_spell_warning`), false);
      const trapLogs = stage.battleLog.getEntries().filter(entry => entry.type === "TRAP");
      assert.equal(trapLogs.length, 1); assert.equal(trapLogs[0].turn, 6);
      assert.deepEqual(trapLogs[0].unitIds, ["sun_li_gaotang"]);
      const logs = stage.battleLog.getEntries();
      assert.equal(logs.filter(entry => entry.text.includes("高廉の広域幻術")).length, 3);
      assert.equal(logs.some(entry => entry.text.includes("同士討ち")), true);
      assert.equal(logs.filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.filter(request => request.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      assert.equal(stage.victoryDialogue.speeches.some(speech => speech.speaker?.name === "柴進"), true);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.equal(stage.validateRuntime(), true); assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  assert.deepEqual([...checkpoints.keys()].sort(), ["final_attack", "gao_defeated", "illusion", "suppressor_defeated", "wide_illusion"]);
  for (const [name, checkpoint] of checkpoints) assert.deepEqual(await run(checkpoint), original, name);
});

test("original seventh chapter preserves spell damage and its one-time warning across the next phase and three saves", async () => {
  const factory = createFactory(), checkpoints = new Map();
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "sorcery_traps" });
  const run = async (checkpoint = null) => {
    const prepared = checkpoint?.prepared;
    const { stage, battleRandom, requests, controller } = createRuntime(prepared?.stage ?? factory.create(id), prepared);
    const completion = prepared ? controller.resumeLoadedBattle() : controller.startNewBattle(); completion.catch(() => {});
    try {
      await ready(controller);
      const commands = [
        async () => {
          for (const [unitId, x, y] of [["shi_xiu_gaotang", 5, 16], ["li_kui_gaotang", 3, 16],
            ["sun_li_gaotang", 6, 15], ["zhang_shun_gaotang", 6, 16]]) {
            const unit = stage.getUnit(unitId), path = controller.getCandidatePaths(unit, { x, y })[0];
            assert.ok(path); assert.equal(await controller.executeWait(unit, path, "NORTH"), true);
          }
          const unit = stage.getUnit("gongsun_sheng_gaotang"), path = controller.getCandidatePaths(unit, { x: 4, y: 15 })[0];
          assert.ok(path); assert.equal(await controller.executeWait(unit, path, "NORTH"), true);
        },
        async () => {
          const unit = stage.getUnit("dai_zong_gaotang"), path = controller.getCandidatePaths(unit, { x: 7, y: 14 })[0];
          assert.ok(path); const before = unit.troops;
          assert.equal(await controller.executeImmediateMove(unit, path), true);
          assert.equal(unit.troops, before - 10); assert.equal(unit.getStatusTurns("ILLUSION"), 1);
          assert.equal(unit.actionState, "FINISHED"); assert.equal(stage.map.getPosition(unit).toKey(), "7,14");
          assert.equal(stage.eventManager.isCompleted(`${id}_spell_warning`), true);
        },
        async () => { assert.equal(await controller.endPlayerTurn(), true); assert.equal(stage.turn, 2); }
      ];
      for (let index = checkpoint?.nextCommand ?? 0; index < commands.length; index++) {
        await commands[index]();
        assert.equal(controller.isStableForSave(), true); assert.equal(stage.validateRuntime(), true);
        if (!prepared) checkpoints.set(index, { nextCommand: index + 1, prepared: saveAndPrepare(saves, controller) });
      }
      assert.equal(stage.getHiddenTraps().filter(trap => trap.kind === "spell" && !trap.active).length, 1);
      assert.equal(stage.eventManager.getCompletedEventIds().filter(event => event === `${id}_spell_warning`).length, 1);
      assert.equal(requests.filter(request => request.dialogue === stage.dialogueManager.get(`${id}_warning`)).length,
        (checkpoint?.nextCommand ?? 0) <= 1 ? 1 : 0);
      const logs = stage.battleLog.getEntries().filter(entry => entry.type === "TRAP");
      assert.equal(logs.length, 1); assert.match(logs[0].text, /妖術罠.*10ダメージ.*幻術1T/);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  for (const checkpoint of checkpoints.values()) assert.deepEqual(await run(checkpoint), original);
});
