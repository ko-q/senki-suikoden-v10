import test from "node:test";
import assert from "node:assert/strict";
import { Character, CharacterManager } from "../src/domain/character.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { resolveStageMapAsset } from "../src/presentation/battle-map-view.js";
import { BattleController, BattleFlowState } from "../src/orchestration/battle-controller.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { AIService } from "../src/services/ai-service.js";
import { MovementService } from "../src/services/movement-service.js";
import { CombatService } from "../src/services/combat-service.js";
import { TacticService } from "../src/services/tactic-service.js";
import { StatusService } from "../src/services/status-service.js";

// Synthetic values are exclusively test inputs, never the production character catalog.
const characters = new CharacterManager(V9_OPENING_STAGE_SOURCE.slice(0, 2).flatMap((source) => source.units)
  .filter((unit) => !unit.mobCharacter).map((unit) => new Character({ id: unit.characterId,
    name: `Test ${unit.characterId}`, shortName: "T", martial: 50, command: 50,
    intelligence: 50, charisma: 50, source: "test_fixture" })));
function stage(chapter) {
  const definition = createV9OpeningStageDefinition(V9_OPENING_STAGE_SOURCE[chapter - 1].id, characters);
  return new StageFactory({ definitions: [definition], characterManager: characters,
    terrainCatalog: createV9CompatibleTerrainCatalog() }).create(definition.id);
}

test("opening chapters preserve final placement, dialogue references and source mob stats", () => {
  for (const chapter of [1, 2]) {
    const runtime = stage(chapter);
    assert.equal(runtime.validateRuntime(), true);
    assert.equal(runtime.getUnits().length, chapter === 1 ? 12 : 9);
    assert.equal(resolveStageMapAsset(runtime).id, `chapter_${chapter}`);
    for (const unit of V9_OPENING_STAGE_SOURCE[chapter - 1].units) {
      assert.equal(runtime.map.getCellAt(unit.position.x, unit.position.y).occupant.id, unit.id);
    }
    assert.ok(runtime.introDialogue && runtime.victoryDialogue);
    assert.equal(runtime.eventManager.getAll().length, 0);
    assert.deepEqual(runtime.aiConfig.adviserUnits.map((u) => u.id), [chapter === 1 ? "strategist1" : "kaifeng_adviser"]);
  }
  const first = stage(1);
  assert.equal(first.map.getCellAt(6, 15).occupant.id, "captain1");
  assert.equal(first.getUnit("captain1").character.command, 48);
  assert.equal(first.getUnit("captain1").maxTroops, 270);
  assert.equal(first.getUnit("strategist1").character.intelligence, 88);
  assert.equal(first.getUnit("strategist1").maxUses.strategy, 6);
});

test("chapter one allows leader escape or annihilation and loses on leader defeat", () => {
  const runtime = stage(1);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  runtime.map.moveUnit(runtime.getUnit("shi_jin"), { x: 3, y: 0 });
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, "shaohuashan-road_escape");
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
  runtime.getUnit("shi_jin").applyDamage(1000);
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime).id, "shaohuashan-road_leader_defeat");
  const annihilation = stage(1);
  for (const enemy of annihilation.armyManager.enemyArmy.getUnits()) enemy.applyDamage(1000);
  assert.equal(annihilation.objectiveManager.evaluateVictory(annihilation).id, "shaohuashan-road_annihilation");
});

test("chapter two requires every enemy and protects Lin Chong rather than every ally", () => {
  const runtime = stage(2);
  runtime.getUnit("lu_zhishen").applyDamage(1000);
  runtime.getUnit("dong_chao").applyDamage(1000);
  runtime.getUnit("xue_ba").applyDamage(1000);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
  for (const enemy of runtime.armyManager.enemyArmy.getUnits()) enemy.applyDamage(1000);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, "wild-boar-forest_annihilation");
  runtime.getUnit("lin_chong").applyDamage(1000);
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime).id, "wild-boar-forest_leader_defeat");
});

test("both chapters allow turn 15 actions but expire at that player phase end", () => {
  for (const chapter of [1, 2]) {
    const runtime = stage(chapter);
    runtime.setTurnAndPhase(14, "PLAYER");
    assert.equal(runtime.objectiveManager.evaluatePlayerPhaseEndDefeat(runtime), null);
    runtime.setTurnAndPhase(15, "PLAYER");
    assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
    assert.ok(runtime.objectiveManager.evaluatePlayerPhaseEndDefeat(runtime));
  }
});

test("missing named data fails explicitly and chapter assembly is detached and immutable", () => {
  assert.throws(() => createV9OpeningStageDefinition("shaohuashan-road", new CharacterManager([])), { code: "CHARACTER_NOT_FOUND" });
  assert.throws(() => createV9OpeningStageDefinition("unknown-stage", characters), { code: "V9_OPENING_STAGE_NOT_FOUND" });
  const definition = createV9OpeningStageDefinition("shaohuashan-road", characters);
  assert.ok(Object.isFrozen(definition) && Object.isFrozen(definition.units[0].position));
  const first = stage(1), second = stage(1);
  first.getUnit("shi_jin").applyDamage(5);
  assert.equal(second.getUnit("shi_jin").troops, 125);
  assert.equal(characters.size, 8);
});

test("both opening maps run enemy turns through BattleController to a terminal result", { timeout: 15000 }, async () => {
  for (const chapter of [1, 2]) {
    const runtime = stage(chapter), battleRandom = new BattleRandom(16);
    const movementService = new MovementService(), combatService = new CombatService();
    const tacticService = new TacticService(), statusService = new StatusService();
    const aiService = new AIService({ movementService, combatService, tacticService, battleRandom });
    const controller = new BattleController({ stage: runtime, battleRandom, movementService,
      combatService, tacticService, statusService, aiService });
    const completion = controller.startNewBattle();
    try {
      for (let attempts = 0; controller.flowState !== BattleFlowState.IDLE && attempts < 100; attempts++) {
        await new Promise((resolve) => setImmediate(resolve));
      }
      assert.equal(controller.flowState, BattleFlowState.IDLE);
      for (let turn = 0; turn < 15 && controller.getBattleResult() === null; turn++) {
        assert.equal(await controller.endPlayerTurn(), true);
        assert.equal(runtime.validateRuntime(), true);
      }
      assert.ok(controller.getBattleResult());
      const result = await completion;
      assert.equal(result.outcome, "DEFEAT");
      assert.ok(result.turn <= 15);
      assert.deepEqual(controller.getDiagnostics(), []);
    } finally { controller.dispose(); }
  }
});
