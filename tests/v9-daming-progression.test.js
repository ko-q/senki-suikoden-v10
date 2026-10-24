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
import { playDamingEscape } from "../test-support/daming-escape-route.js";

const id = "daming-prison-break";
const living = army => army.getUnits().filter(unit => unit.hasTroops());

test("eighth chapter escapes both prisoners from the original formation and reproduces pursuit, river crossing and first arrival saves", async () => {
  const characters = createV9CharacterManager();
  const factory = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] });
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "daming_escape" });
  const checkpoints = new Map();
  const run = async (checkpoint = null) => {
    const prepared = checkpoint?.prepared, stage = prepared?.stage ?? factory.create(id);
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
      if (!prepared) {
        assert.equal(living(stage.armyManager.playerArmy).length, 19);
        assert.equal(living(stage.armyManager.enemyArmy).length, 38);
      }
      await playDamingEscape(controller, { fromTurn: checkpoint?.turn ?? 1, fromCommand: checkpoint?.commandIndex ?? 0,
        onCheckpoint(_, cursor) {
          const key = `${cursor.turn}:${cursor.commandIndex}`;
          if (prepared || checkpoints.has(key) || !["1:8", "3:0", "5:2", "6:1"].includes(key)) return;
          assert.equal(controller.getBattleResult(), null);
          assert.equal(controller.isStableForSave(), true);
          if (key === "6:1") {
            assert.equal(stage.map.getPosition(stage.getUnit("lu_junyi_daming")).toKey(), "3,14");
            assert.equal(stage.map.getPosition(stage.getUnit("shi_xiu_daming")).toKey(), "4,12");
            assert.equal(stage.getUnit("lu_junyi_daming").actionState, "FINISHED");
            assert.equal(stage.getUnit("shi_xiu_daming").actionState, "READY");
          }
          assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: controller.createSaveSnapshot() }).ok, true);
          const guard = saves.inspectSlot("manual_01", SaveKind.MANUAL).guard;
          checkpoints.set(key, { ...cursor, prepared: saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard }) });
        }
      });
      assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_escape`, turn: 6, phase: "PLAYER" });
      assert.equal(stage.getUnit("lu_junyi_daming").troops, 95);
      assert.equal(stage.getUnit("shi_xiu_daming").troops, 97);
      assert.equal(stage.getUnit("wu_yong_daming").troops, 145);
      assert.equal(living(stage.armyManager.playerArmy).length, 14);
      assert.equal(living(stage.armyManager.enemyArmy).length, 20);
      assert.equal(stage.map.getPosition(stage.getUnit("lu_junyi_daming")).toKey(), "3,14");
      assert.equal(stage.map.getPosition(stage.getUnit("shi_xiu_daming")).toKey(), "4,15");
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.filter(request => request.type === "BATTLE_RESULT").length, 1);
      assert.equal(requests.at(-1).dialogue, stage.victoryDialogue);
      if (prepared) assert.equal(requests.some(request => request.dialogue === stage.introDialogue || request.type === "MISSION_BRIEFING"), false);
      assert.equal(stage.validateRuntime(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
      return createBattleSaveData(stage, battleRandom);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  };
  const original = await run();
  assert.deepEqual([...checkpoints.keys()], ["1:8", "3:0", "5:2", "6:1"]);
  for (const [name, checkpoint] of checkpoints) assert.deepEqual(await run(checkpoint), original, name);
});
