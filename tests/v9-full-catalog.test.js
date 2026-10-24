import test from "node:test";
import assert from "node:assert/strict";
import { createV9CharacterManager } from "../src/definitions/v9-characters.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { SaveService } from "../src/services/save-service.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { SaveKind } from "../src/persistence/save-codec.js";
import { MemoryStorage } from "../test-support/memory-storage.js";
import { BattleLogRecorder } from "../src/services/battle-log-recorder.js";
import { BattleController, MovementService, CombatService, TacticService, StatusService, AIService } from "../src/index.js";

const characters = createV9CharacterManager();
const factory = new StageFactory({ characterManager: characters,
  terrainCatalog: createV9CompatibleTerrainCatalog(),
  definitions: V9_OPENING_STAGE_SOURCE.map((source) => createV9OpeningStageDefinition(source.id, characters)) });
const eighth = () => factory.create("daming-prison-break");
const ninth = () => factory.create("zengtou-fortress");
function kill(stage, id) {
  const unit = stage.getUnit(id);
  unit.applyDamage(unit.maxTroops); unit.setReadyForPhase(false); stage.map.removeUnit(unit);
}
function phase(stage, turn, side) {
  stage.setTurnAndPhase(turn, side);
  return stage.eventManager.resolveChain({ stage, trigger: "PHASE_START" });
}

test("all nine chapters create real v9 characters, maps and placements and round-trip through saves", async () => {
  assert.equal(characters.getAll().length, 92);
  assert.equal(characters.get("shi_jin").name, "史進");
  const totals = [12, 9, 31, 12, 49, 80, 61, 57, 95];
  const deployed = [12, 9, 16, 12, 42, 80, 61, 57, 91];
  const service = new SaveService({ repository: new SaveRepository({ storage: new MemoryStorage() }), stageFactory: factory });
  for (const [index, source] of V9_OPENING_STAGE_SOURCE.entries()) {
    const stage = factory.create(source.id);
    assert.equal(stage.validateRuntime(), true);
    assert.equal(stage.getUnits().length, totals[index]);
    assert.equal(stage.getUnits().filter((unit) => stage.map.getPosition(unit)).length, deployed[index]);
    assert.equal(stage.map.width, 8);
    assert.equal(stage.briefing.victory, source.objectiveText.split("<br>")[0].replace(/^勝利：/, ""));
    const random = new BattleRandom(734);
    const movementService = new MovementService(), combatService = new CombatService(), tacticService = new TacticService();
    const controller = new BattleController({ stage, battleRandom: random, movementService, combatService, tacticService,
      statusService: new StatusService(), aiService: new AIService({ battleRandom: random, movementService, combatService, tacticService }) });
    const completion = controller.startNewBattle();
    for (let attempt = 0; attempt < 100 && !controller.isStableForSave(); attempt++) await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(controller.isStableForSave(), true, source.id);
    const before = createBattleSaveData(stage, random);
    assert.equal(service.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL, battle: before }).ok, true);
    const guard = service.inspectSlot("manual_01", SaveKind.MANUAL).guard;
    const loaded = service.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard });
    assert.deepEqual(createBattleSaveData(loaded.stage, random), before);
    assert.equal(loaded.stage.validateRuntime(), true);
    controller.dispose(); await assert.rejects(completion, { name: "AbortError" });
  }
  assert.equal(factory.create(V9_OPENING_STAGE_SOURCE[0].id).getUnit("shi_jin").maxTroops, 130);
});

test("Daming keeps all fourteen gate pursuers and protects Wu Yong, Lu Junyi and Shi Xiu", () => {
  const stage = eighth();
  const pursuit = stage.aiConfig.pursuitRules[0];
  assert.equal(pursuit.units.length, 14);
  assert.deepEqual(pursuit.gateColumns, [3, 4]);
  assert.deepEqual(stage.aiConfig.targetPriorityRules[0].targets.map((unit) => unit.id), ["lu_junyi_daming", "shi_xiu_daming"]);
  assert.equal(stage.aiConfig.targetPriorityRules[0].disableStrategy, true);
  for (const id of ["wu_yong_daming", "lu_junyi_daming", "shi_xiu_daming"]) {
    const runtime = eighth(); kill(runtime, id);
    assert.notEqual(runtime.objectiveManager.evaluateDefeat(runtime), null);
  }
});

test("Daming escape requires both prisoners in the southern radius-one zone", () => {
  const stage = eighth();
  const escape = stage.objectiveManager.getAll().find((objective) => objective.id.endsWith("_escape"));
  const [lu, shi] = [stage.getUnit("lu_junyi_daming"), stage.getUnit("shi_xiu_daming")];
  for (const [unit, x, y] of [[lu, 3, 15], [shi, 4, 15]]) {
    const occupant = stage.map.getCellAt(x, y).occupant;
    if (occupant) stage.map.removeUnit(occupant);
    stage.map.moveUnit(unit, { x, y });
    assert.equal(escape.evaluate(stage), unit === shi);
  }
});

test("Zengtou defection happens once on player turn six and is silent if Yu Baosi died", () => {
  const stage = ninth(), yu = stage.getUnit("yu_baosi");
  const troops = yu.troops, facing = yu.facing;
  assert.equal(yu.actionState, "FINISHED");
  assert.equal(phase(stage, 5, "PLAYER").completedEvents.length, 0);
  assert.equal(phase(stage, 6, "ENEMY").completedEvents.length, 0);
  const result = phase(stage, 6, "PLAYER");
  assert.deepEqual(result.completedEvents.map((event) => event.id), ["zengtou-fortress_defection"]);
  assert.equal(result.presentationRequests[0].dialogue.speeches[0].speaker, yu.character);
  assert.equal(stage.armyManager.playerArmy.has(yu), true);
  assert.equal(yu.troops, troops); assert.equal(yu.facing, facing);
  assert.ok(stage.getUnits().every((unit) => unit.statusEffects.length === 0));
  assert.equal(phase(stage, 7, "PLAYER").completedEvents.length, 0);
  const dead = ninth(); kill(dead, "yu_baosi");
  const skipped = phase(dead, 6, "PLAYER");
  assert.equal(skipped.completedEvents.length, 1);
  assert.equal(skipped.presentationRequests.length, 0);
  assert.equal(dead.armyManager.playerArmy.has(dead.getUnit("yu_baosi")), false);
});

test("Qin Ming's defeat calls four rescuers at the next player phase, never immediately or twice", () => {
  const stage = ninth(); kill(stage, "qin_ming_zengtou");
  assert.equal(stage.objectiveManager.evaluateDefeat(stage), null);
  assert.equal(stage.eventManager.resolveChain({ stage, trigger: "UNIT_DEFEATED" }).completedEvents.length, 0);
  assert.equal(phase(stage, 2, "ENEMY").completedEvents.length, 0);
  const result = phase(stage, 3, "PLAYER");
  assert.deepEqual(result.completedEvents.map((event) => event.id), ["zengtou-fortress_relief"]);
  for (const id of ["guan_sheng_zengtou", "xu_ning_zengtou", "shan_tinggui_zengtou", "wei_dingguo_zengtou"]) {
    const unit = stage.getUnit(id);
    assert.equal(stage.armyManager.playerArmy.has(unit), true);
    assert.notEqual(stage.map.getPosition(unit), null);
  }
  assert.equal(result.presentationRequests[0].dialogue.speeches.length, 5);
  assert.equal(phase(stage, 4, "PLAYER").completedEvents.length, 0);
  assert.equal(stage.validateRuntime(), true);
});

test("a defeated Yu Baosi leaves the V9 skipped-defection explanation once, including after save/load", () => {
  const stage = ninth(); kill(stage, "yu_baosi"); stage.setTurnAndPhase(6, "PLAYER");
  for (const unit of stage.armyManager.enemyArmy.getUnits()) unit.setReadyForPhase(false);
  const recorder = new BattleLogRecorder(stage);
  const resolution = stage.eventManager.resolveChain({ stage, trigger: "PHASE_START",
    afterEventCompleted(event) { recorder.event(event); } });
  assert.equal(resolution.presentationRequests.length, 0);
  const logs = stage.battleLog.getEntries();
  assert.equal(logs.length, 1);
  assert.equal(logs[0].text, "郁保四はすでに戦線を離れており、寝返りは起こらなかった。");
  assert.deepEqual(logs[0].unitIds, ["yu_baosi"]);
  assert.equal(stage.armyManager.getAffiliation(stage.getUnit("yu_baosi")), "ENEMY");
  const saves = new SaveService({ stageFactory: factory, repository: new SaveRepository({ storage: new MemoryStorage() }), writerId: "skipped_defection" });
  assert.equal(saves.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL,
    battle: createBattleSaveData(stage, new BattleRandom(1)) }).ok, true);
  const guard = saves.inspectSlot("manual_01", SaveKind.MANUAL).guard;
  const loaded = saves.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard }).stage;
  loaded.setTurnAndPhase(7, "PLAYER");
  const loadedRecorder = new BattleLogRecorder(loaded);
  const repeated = loaded.eventManager.resolveChain({ stage: loaded, trigger: "PHASE_START",
    afterEventCompleted(event) { loadedRecorder.event(event); } });
  assert.equal(repeated.completedEvents.length, 0);
  assert.deepEqual(loaded.battleLog.getEntries(), logs);
});

test("chapter-eight narration has no invented Character and remains detached from combat units", () => {
  const stage = eighth();
  const narration = stage.dialogueManager.getAll().flatMap((dialogue) => dialogue.speeches).filter((speech) => speech.narratorLabel);
  assert.ok(narration.length > 0);
  assert.ok(narration.every((speech) => speech.speaker === null && speech.narratorLabel === "物語"));
});
