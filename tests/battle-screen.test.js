import test from "node:test";
import assert from "node:assert/strict";
import { createV9CharacterManager } from "../src/definitions/v9-characters.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { OPENING_ESCAPE_ROUTE } from "../test-support/opening-escape-route.js";
import { SECOND_CHAPTER_ROUTE } from "../test-support/second-chapter-route.js";
import { CONVOY_ESCAPE_ROUTE } from "../test-support/convoy-escape-route.js";
import { QINGFENG_ESCAPE_ROUTE } from "../test-support/qingfeng-escape-route.js";
import { DAMING_ESCAPE_ROUTE } from "../test-support/daming-escape-route.js";
import { ZENGTOU_EVENT_ROUTE } from "../test-support/zengtou-event-route.js";
import { ZENGTOU_VICTORY_ROUTE } from "../test-support/zengtou-victory-route.js";
import { JIANGZHOU_ESCAPE_ROUTE } from "../test-support/jiangzhou-escape-route.js";
import { SORCERY_VICTORY_ROUTE } from "../test-support/sorcery-victory-route.js";
import { MANOR_VICTORY_ROUTE } from "../test-support/manor-victory-route.js";

import { ActionType } from "../src/core/action-request.js";
import { BattleOutcome } from "../src/core/battle-result.js";
import { PresentationRequestType } from "../src/core/presentation-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { ObjectiveOutcome, ObjectiveType } from "../src/domain/objective.js";
import { Facing, UnitActionState, UnitStatus } from "../src/domain/unit.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import {
  BattleController,
  BattleFlowState
} from "../src/orchestration/battle-controller.js";
import { BattleEffectManager } from "../src/presentation/battle-effect-manager.js";
import { BattleRenderer } from "../src/presentation/battle-renderer.js";
import { BattleScreen, InteractionMode } from "../src/presentation/battle-screen.js";
import { AIService } from "../src/services/ai-service.js";
import { CombatService } from "../src/services/combat-service.js";
import { MovementService } from "../src/services/movement-service.js";
import { StatusService } from "../src/services/status-service.js";
import { TacticService } from "../src/services/tactic-service.js";
import { createStageDigest } from "../test-support/fixtures.js";
import {
  FakeElement,
  createFakeBattleElements,
  installFakeDocument
} from "../test-support/fake-battle-dom.js";
import {
  Affiliation,
  createServiceStage
} from "../test-support/service-fixtures.js";

const ZERO_EFFECT_DURATIONS = Object.freeze(Object.fromEntries(
  Object.values(PresentationRequestType)
    .filter((type) => type !== PresentationRequestType.DIALOGUE)
    .map((type) => [type, 0])
));

function createScreenRuntime(stage, { visualSession = null, keyboardTarget = null, advanceTacticDialogues = true } = {}) {
  const elements = createFakeBattleElements();
  const renderer = new BattleRenderer(elements, keyboardTarget ? { keyboardTarget } : {});
  const effectManager = new BattleEffectManager({
    renderer,
    visualSession,
    durations: ZERO_EFFECT_DURATIONS
  });
  const screen = new BattleScreen({ stage, renderer, effectManager });
  const battleRandom = new BattleRandom(1);
  const movementService = new MovementService();
  const combatService = new CombatService();
  const tacticService = new TacticService();
  const statusService = new StatusService();
  const aiService = new AIService({
    movementService,
    combatService,
    tacticService,
    battleRandom
  });
  const controller = new BattleController({
    stage,
    battleRandom,
    movementService,
    combatService,
    tacticService,
    statusService,
    aiService,
    presentationPort: {
      async present(request, signal) {
        const pending = screen.present(request, signal);
        pending.catch(() => {});
        // Route tests operate the same Next button for each tactic result line.
        // Dedicated interaction tests below keep these dialogues under manual control.
        if (advanceTacticDialogues && request.type === PresentationRequestType.DIALOGUE
          && request.dialogue.id === "tactic_success") {
          for (const speech of request.dialogue.speeches) {
            await waitUntil(() => !elements.dialogueOverlay.hidden
              && elements.dialogueText.textContent === speech.text, "TACTIC_RESULT_LINE");
            assert.equal(screen.mode, InteractionMode.LOCKED);
            elements.dialogueNextButton.dispatch("click");
            await new Promise(setImmediate);
          }
        }
        return pending;
      }
    }
  });
  screen.connectCommandPort(controller);
  return { battleRandom, controller, elements, screen };
}

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`WAIT_TIMEOUT_${label}`);
}

function isRenderedMode(runtime, mode) {
  return runtime.screen.mode === mode
    && runtime.elements.modeValue.textContent === mode;
}

test("chapter two commands and hints follow current or preview position without changing the battle", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager(), id = "wild-boar-forest";
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] }).create(id);
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  try {
    for (const speech of stage.introDialogue.speeches) {
      await waitUntil(() => !elements.dialogueOverlay.hidden && elements.dialogueText.textContent === speech.text, "SECOND_INTRO");
      elements.dialogueNextButton.dispatch("click");
    }
    await waitUntil(() => !elements.missionOverlay.hidden, "SECOND_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "SECOND_READY");
    const before = createStageDigest(stage), random = battleRandom.exportState();
    cell(3, 12).dispatch("click");
    assert.equal(elements.chargeButton.disabled, true);
    assert.equal(elements.tacticButton.disabled, true);
    assert.match(elements.instructionText.textContent, /移動せず向きだけ変える場合は「待機」/);
    assert.doesNotMatch(elements.instructionText.textContent, /使用可能/);
    cell(4, 10).dispatch("click");
    assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW);
    assert.equal(elements.chargeButton.disabled, false);
    assert.equal(elements.tacticButton.disabled, false);
    assert.match(elements.instructionText.textContent, /突撃3\/3・撹乱Lv1 4\/4/);
    assert.match(elements.instructionText.textContent, /敵の方向へ攻撃せず向きたい場合は「待機」/);
    assert.equal(elements.pathButton.hidden, false);
    assert.equal(elements.pathButton.disabled, false);
    assert.equal(elements.pathButton.textContent, "経路 1/3");
    elements.pathButton.dispatch("click");
    assert.equal(elements.pathButton.textContent, "経路 2/3");
    elements.tacticButton.dispatch("click");
    assert.equal(elements.pathButton.hidden, true);
    assert.equal(elements.pathButton.disabled, true);
    elements.confusionLv1Button.dispatch("click");
    elements.pathButton.dispatch("click");
    assert.equal(elements.pathButton.textContent, "経路 2/3");
    assert.match(elements.instructionText.textContent, /対象：選択した敵1部隊。射程3・壁越し不可、消費1回/);
    assert.match(elements.instructionText.textContent, /残り4\/4回/);
    elements.resetButton.dispatch("click");
    cell(4, 10).dispatch("click");
    elements.chargeButton.dispatch("click");
    assert.equal(elements.pathButton.hidden, true);
    assert.match(elements.instructionText.textContent, /隣接する敵に大ダメージ/);
    assert.match(elements.instructionText.textContent, /残り3\/3回/);
    elements.resetButton.dispatch("click");
    assert.equal(createStageDigest(stage), before);
    assert.deepEqual(battleRandom.exportState(), random);
    elements.resetButton.dispatch("click");
    assert.equal(elements.chargeButton.disabled, true);
    assert.equal(elements.tacticButton.disabled, true);
    assert.doesNotMatch(elements.instructionText.textContent, /使用可能/);
    cell(3, 12).dispatch("click"); cell(4, 10).dispatch("click");
    assert.equal(elements.pathButton.hidden, false);
    elements.waitButton.dispatch("click");
    assert.equal(elements.pathButton.hidden, true);
    assert.equal(elements.pathButton.disabled, true);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("turn-end confirmation preserves selection on cancel, blocks other input, and commits only once", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ units: [
    { id: "lin", character: { name: "林冲" }, army: Affiliation.PLAYER, position: { x: 0, y: 2 }, maxTroops: 1000 },
    { id: "enemy", position: { x: 4, y: 0 }, maxTroops: 1000 }
  ] });
  const runtime = createScreenRuntime(stage), { screen, controller, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "TURN_CONFIRM_READY");
    elements.board.children[10].dispatch("click");
    const before = createStageDigest(stage), random = battleRandom.exportState();
    for (const cancel of [() => elements.cancelTurnEndButton.dispatch("click"),
      () => elements.turnEndOverlay.dispatch("keydown", { key: "Escape" })]) {
      elements.endTurnButton.dispatch("click");
      assert.equal(elements.turnEndOverlay.hidden, false);
      assert.match(elements.turnEndMessage.textContent, /未行動の味方部隊が1部隊います。\n林冲/);
      assert.equal(screen.mode, InteractionMode.LOCKED);
      elements.board.children[5].dispatch("click"); elements.waitButton.dispatch("click");
      elements.resetButton.dispatch("click"); elements.endTurnButton.dispatch("click");
      assert.equal(createStageDigest(stage), before);
      assert.deepEqual(battleRandom.exportState(), random);
      cancel();
      assert.equal(elements.turnEndOverlay.hidden, true);
      assert.equal(screen.mode, InteractionMode.UNIT_SELECTED);
      assert.equal(elements.endTurnButton.disabled, false);
      assert.equal(createStageDigest(stage), before);
    }
    assert.equal(elements.cancelTurnEndButton.focusCount, 2);
    elements.endTurnButton.dispatch("click");
    elements.confirmTurnEndButton.dispatch("click");
    elements.confirmTurnEndButton.dispatch("click");
    await waitUntil(() => stage.turn === 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "TURN_CONFIRMED");
    assert.equal(elements.turnEndOverlay.hidden, true);
    elements.endTurnButton.dispatch("click");
    assert.equal(elements.turnEndOverlay.hidden, false);
    const atDisposal = createStageDigest(stage);
    screen.dispose();
    assert.equal(elements.turnEndOverlay.hidden, true);
    assert.equal(elements.confirmTurnEndButton.listeners.size, 0);
    elements.confirmTurnEndButton.dispatch("click");
    assert.equal(createStageDigest(stage), atDisposal);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("first chapter screen inputs preserve previews and escape on the destination click before closing dialogue", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager(), id = "shaohuashan-road";
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] }).create(id);
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const advance = async dialogue => {
    for (const speech of dialogue.speeches) {
      await waitUntil(() => !elements.dialogueOverlay.hidden && elements.dialogueText.textContent === speech.text, "OPENING_DIALOGUE");
      assert.equal(screen.mode, InteractionMode.LOCKED);
      assert.equal(elements.dialogueNextButton.textContent, "進む");
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "OPENING_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "OPENING_READY");
    for (const [index, commands] of OPENING_ESCAPE_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [unitId, x, y, type, targetId] of commands) {
        const unit = stage.getUnit(unitId), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        const random = battleRandom.exportState();
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED, `${stage.turn}: ${unitId}`);
        if (origin.x !== x || origin.y !== y) cell(x, y).dispatch("click");
        if (type === "ESCAPE") {
          assert.equal(screen.mode, InteractionMode.LOCKED);
          await waitUntil(() => controller.getBattleResult() !== null, "OPENING_ESCAPE_CLICK");
          assert.deepEqual(battleRandom.exportState(), random);
          continue;
        }
        assert.equal(createStageDigest(stage), before);
        assert.deepEqual(battleRandom.exportState(), random);
        if (stage.turn === 2 && unitId === "shi_jin") {
          assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW);
          elements.resetButton.dispatch("click");
          assert.equal(createStageDigest(stage), before);
          assert.deepEqual(battleRandom.exportState(), random);
          assert.equal(stage.map.getPosition(unit).toKey(), origin.toKey());
          cell(x, y).dispatch("click");
        }
        if (type === "CHARGE") elements.chargeButton.dispatch("click");
        if (type === "CONFUSION_LV1") {
          elements.tacticButton.dispatch("click"); elements.confusionLv1Button.dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click"); cell(x, y - 1).dispatch("click");
        }
        if (type === "CONFUSION_LV1") {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "OPENING_FACING");
          cell(x, y - 1).dispatch("click");
        }
        await waitUntil(() => unit.actionState === UnitActionState.FINISHED
          && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), `OPENING_ACTION_${stage.turn}_${unitId}`);
      }
      if (index < OPENING_ESCAPE_ROUTE.length - 1) {
        elements.endTurnButton.dispatch("click");
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "OPENING_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    await advance(stage.victoryDialogue);
    assert.equal((await completion).objectiveId, `${id}_escape`);
    assert.equal(stage.getUnit("shi_jin").troops, 55);
    assert.equal(stage.map.getPosition(stage.getUnit("shi_jin")).toKey(), "3,0");
    assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "BATTLE_RESULT").length, 1);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("third chapter screen inputs reach escape after the convoy, pursuit dialogue and wetland retreat", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager();
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition("birthday-convoy", characters)] }).create("birthday-convoy");
  const runtime = createScreenRuntime(stage), { elements, controller, screen } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const face = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advance = async (dialogue) => {
    await waitUntil(() => !elements.dialogueOverlay.hidden, "CONVOY_DIALOGUE");
    const lines = [];
    for (let n = 0; n < 10 && !elements.dialogueOverlay.hidden; n++) {
      lines.push(elements.dialogueText.textContent);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
    assert.deepEqual(lines, dialogue.speeches.map(speech => speech.text));
    assert.equal(elements.dialogueOverlay.hidden, true);
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "CONVOY_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "CONVOY_READY");
    for (const [index, commands] of CONVOY_ESCAPE_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [id, x, y, type, targetId, facing = "NORTH"] of commands) {
        const unit = stage.getUnit(id), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED);
        if (origin.x !== x || origin.y !== y) {
          cell(x, y).dispatch("click");
          if (stage.turn === 12 && id === "chao_gai") {
            assert.equal(screen.mode, InteractionMode.LOCKED);
            await waitUntil(() => controller.getBattleResult() !== null, "CONVOY_ESCAPE_ON_MOVE");
            continue;
          }
          assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW, `turn ${stage.turn}: ${id}`);
        }
        assert.equal(createStageDigest(stage), before);
        const tactic = type === "ILLUSION" || type === "CONFUSION_LV1";
        if (tactic) {
          assert.equal(elements.tacticButton.disabled, false);
          elements.tacticButton.dispatch("click");
          if (type === "CONFUSION_LV1") elements.confusionLv1Button.dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click");
          assert.equal(screen.mode, InteractionMode.WAIT_FACING_SELECT);
          face(x, y, facing);
        }
        if (stage.turn === 5 && id === "ruan_xiaoer") await advance(stage.dialogueManager.get("birthday-convoy_arrival"));
        if (tactic) {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "CONVOY_FACING");
          face(x, y, facing);
        }
        await waitUntil(() => controller.getBattleResult() !== null || (unit.actionState === UnitActionState.FINISHED
          && isRenderedMode(runtime, InteractionMode.UNIT_SELECT)), `CONVOY_ACTION_${stage.turn}_${id}`);
      }
      if (index < CONVOY_ESCAPE_ROUTE.length - 1) {
        elements.endTurnButton.dispatch("click");
        if (!elements.turnEndOverlay.hidden) elements.confirmTurnEndButton.dispatch("click");
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "CONVOY_NEXT_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    await advance(stage.victoryDialogue);
    assert.equal((await completion).objectiveId, "birthday-convoy_escape");
    assert.equal(stage.turn, 12);
    assert.equal(stage.getUnit("chao_gai").troops, 19);
    assert.equal(stage.map.getPosition(stage.getUnit("chao_gai")).toKey(), "3,0");
    assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 13);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); restore(); }
});

test("fourth chapter reaches escape and its closing dialogue through board clicks without a final wait", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager();
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition("qingfeng-fort", characters)] }).create("qingfeng-fort");
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const face = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advance = async dialogue => {
    await waitUntil(() => !elements.dialogueOverlay.hidden, "QINGFENG_DIALOGUE");
    const lines = [];
    for (let n = 0; n < 10 && !elements.dialogueOverlay.hidden; n++) {
      lines.push(elements.dialogueText.textContent);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
    assert.deepEqual(lines, dialogue.speeches.map(speech => speech.text));
    assert.equal(elements.dialogueOverlay.hidden, true);
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "QINGFENG_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "QINGFENG_READY");
    for (const [index, commands] of QINGFENG_ESCAPE_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [id, x, y, type, targetId, facing = "NORTH"] of commands) {
        const unit = stage.getUnit(id), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        const random = battleRandom.exportState();
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED);
        if (origin.x !== x || origin.y !== y) cell(x, y).dispatch("click");
        if (index === QINGFENG_ESCAPE_ROUTE.length - 1) {
          assert.equal(screen.mode, InteractionMode.LOCKED);
          await waitUntil(() => controller.getBattleResult() !== null, "QINGFENG_ESCAPE_CLICK");
          assert.deepEqual(battleRandom.exportState(), random, "escape must not consume random values");
          continue;
        }
        assert.equal(createStageDigest(stage), before, "preview must leave Domain unchanged");
        assert.deepEqual(battleRandom.exportState(), random);
        if (type === "CHARGE") elements.chargeButton.dispatch("click");
        if (type === "CONFUSION_LV1") {
          elements.tacticButton.dispatch("click"); elements.confusionLv1Button.dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click"); face(x, y, facing);
        }
        if (type === "CONFUSION_LV1") {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "QINGFENG_FACING");
          face(x, y, facing);
        }
        await waitUntil(() => unit.actionState === UnitActionState.FINISHED
          && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), `QINGFENG_ACTION_${stage.turn}_${id}`);
      }
      if (index < QINGFENG_ESCAPE_ROUTE.length - 1) {
        elements.endTurnButton.dispatch("click");
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "QINGFENG_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    await advance(stage.victoryDialogue);
    assert.equal((await completion).objectiveId, "qingfeng-fort_escape");
    assert.equal(stage.turn, 6);
    assert.equal(stage.getUnit("song_jiang").troops, 116);
    assert.equal(stage.map.getPosition(stage.getUnit("song_jiang")).toKey(), "3,0");
    assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 4);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("fifth chapter screen plays rescue once and waits for both escapees before ending on a move click", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager(), id = "jiangzhou-execution-ground";
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] }).create(id);
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const face = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advance = async dialogue => {
    await waitUntil(() => !elements.dialogueOverlay.hidden, "JIANGZHOU_DIALOGUE");
    const lines = [];
    for (let n = 0; n < 12 && !elements.dialogueOverlay.hidden; n++) {
      const label = dialogue.speeches[n].actionLabel;
      assert.equal(elements.dialogueAction.textContent, label ?? "");
      assert.equal(elements.dialogueAction.hidden, !label);
      assert.equal(elements.dialogueNextButton.textContent, "進む");
      lines.push(elements.dialogueText.textContent);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
    assert.deepEqual(lines, dialogue.speeches.map(speech => speech.text));
    assert.equal(elements.dialogueOverlay.hidden, true);
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "JIANGZHOU_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "JIANGZHOU_READY");
    for (const [index, commands] of JIANGZHOU_ESCAPE_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [unitId, x, y, type, targetId, facing = "NORTH"] of commands) {
        const unit = stage.getUnit(unitId), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        const random = battleRandom.exportState();
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED, `${stage.turn}: ${unitId}`);
        if (origin.x !== x || origin.y !== y) cell(x, y).dispatch("click");
        if (type === "ESCAPE") {
          assert.equal(screen.mode, InteractionMode.LOCKED);
          await waitUntil(() => controller.getBattleResult() !== null, "JIANGZHOU_ESCAPE_CLICK");
          assert.deepEqual(battleRandom.exportState(), random);
          continue;
        }
        assert.equal(createStageDigest(stage), before);
        assert.deepEqual(battleRandom.exportState(), random);
        if (stage.turn === 5 && unitId === "chao_gai_jiangzhou") {
          assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW, "one required arrival is still a cancellable preview");
          elements.resetButton.dispatch("click");
          assert.equal(createStageDigest(stage), before);
          cell(x, y).dispatch("click");
          assert.equal(controller.getBattleResult(), null);
        }
        if (type === "CHARGE") elements.chargeButton.dispatch("click");
        if (type === "BOW_ATTACK") elements.bowButton.dispatch("click");
        if (type === "CONFUSION_LV1") {
          elements.tacticButton.dispatch("click"); elements.confusionLv1Button.dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true, `${stage.turn}: ${unitId} targets ${targetId}`);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click"); face(x, y, facing);
        }
        if (type === "CONFUSION_LV1") {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "JIANGZHOU_FACING");
          face(x, y, facing);
        }
        await waitUntil(() => unit.actionState === UnitActionState.FINISHED
          && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), `JIANGZHOU_ACTION_${stage.turn}_${unitId}`);
      }
      if (index < JIANGZHOU_ESCAPE_ROUTE.length - 1) {
        elements.endTurnButton.dispatch("click");
        if (index === 0) {
          await waitUntil(() => !elements.dialogueOverlay.hidden, "JIANGZHOU_RESCUE");
          const before = createStageDigest(stage), random = battleRandom.exportState();
          cell(0, 9).dispatch("click"); cell(0, 7).dispatch("click"); elements.endTurnButton.dispatch("click");
          assert.equal(createStageDigest(stage), before, "rescue dialogue must block battle commands");
          assert.deepEqual(battleRandom.exportState(), random);
          await advance(stage.dialogueManager.get(`${id}_arrival`));
        }
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "JIANGZHOU_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    await advance(stage.victoryDialogue);
    assert.equal((await completion).objectiveId, `${id}_escape`);
    assert.equal(stage.turn, 7);
    assert.equal(stage.getUnit("song_jiang_jiangzhou").troops, 10);
    assert.equal(stage.getUnit("chao_gai_jiangzhou").troops, 146);
    assert.equal(stage.map.getPosition(stage.getUnit("song_jiang_jiangzhou")).toKey(), "3,0");
    assert.equal(stage.map.getPosition(stage.getUnit("chao_gai_jiangzhou")).toKey(), "4,0");
    assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 28);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("sixth chapter screen completes betrayal, the enemy confusion log and annihilation through board clicks", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager(), id = "zhu-family-manor";
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] }).create(id);
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const face = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advance = async dialogue => {
    await waitUntil(() => !elements.dialogueOverlay.hidden, "MANOR_DIALOGUE");
    const lines = [];
    for (let n = 0; n < 12 && !elements.dialogueOverlay.hidden; n++) {
      lines.push(elements.dialogueText.textContent);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
    assert.deepEqual(lines, dialogue.speeches.map(speech => speech.text));
    assert.equal(elements.dialogueOverlay.hidden, true);
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "MANOR_BRIEFING");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "MANOR_READY");
    for (const [index, commands] of MANOR_VICTORY_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [unitId, x, y, type, targetId, facing] of commands) {
        const unit = stage.getUnit(unitId), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED);
        if (origin.x !== x || origin.y !== y) cell(x, y).dispatch("click");
        assert.equal(createStageDigest(stage), before);
        if (type === "BOW_ATTACK") elements.bowButton.dispatch("click");
        if (type === "CHARGE") elements.chargeButton.dispatch("click");
        const tactic = type === "CONFUSION_LV1" || type === "CONFUSION_LV3";
        if (tactic) {
          elements.tacticButton.dispatch("click");
          (type === "CONFUSION_LV1" ? elements.confusionLv1Button : elements.confusionLv3Button).dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true, `${stage.turn}: ${unitId} -> ${targetId}`);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click"); face(x, y, facing);
        }
        if (tactic) {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "MANOR_TACTIC");
          face(x, y, facing);
        }
        await waitUntil(() => controller.getBattleResult() !== null
          || isRenderedMode(runtime, InteractionMode.UNIT_SELECT), `MANOR_ACTION_${stage.turn}_${unitId}`);
      }
      if (index < MANOR_VICTORY_ROUTE.length - 1) {
        elements.endTurnButton.dispatch("click");
        if (index === 2) {
          await waitUntil(() => !elements.dialogueOverlay.hidden, "MANOR_BETRAYAL");
          assert.equal(stage.armyManager.playerArmy.getUnits().length, 28);
          const before = createStageDigest(stage), random = battleRandom.exportState();
          cell(0, 6).dispatch("click"); cell(0, 5).dispatch("click"); elements.endTurnButton.dispatch("click");
          assert.equal(createStageDigest(stage), before); assert.deepEqual(battleRandom.exportState(), random);
          assert.equal(stage.battleLog.getEntries().filter(entry => entry.text.includes("内応に動揺")).length, 1);
          await advance(stage.dialogueManager.get(`${id}_arrival`));
          assert.equal(stage.getUnit("sun_li_zhujia").actionState, "READY");
        }
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "MANOR_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    await advance(stage.victoryDialogue);
    assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_annihilation`, turn: 18, phase: "PLAYER" });
    assert.equal(stage.getUnit("song_jiang_zhujia").troops, 71);
    assert.equal(stage.armyManager.playerArmy.getUnits().filter(unit => unit.hasTroops()).length, 7);
    assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 0);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("seventh chapter screen completes illusion, a fatal trap and annihilation through board clicks", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager(), id = "gaotang-prefecture";
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] }).create(id);
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const face = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advance = async dialogue => {
    await waitUntil(() => !elements.dialogueOverlay.hidden, "SORCERY_DIALOGUE");
    const lines = [];
    for (let n = 0; n < 12 && !elements.dialogueOverlay.hidden; n++) {
      lines.push(elements.dialogueText.textContent);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
    assert.deepEqual(lines, dialogue.speeches.map(speech => speech.text));
    assert.equal(elements.dialogueOverlay.hidden, true);
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "SORCERY_BRIEFING");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "SORCERY_READY");
    for (const [index, commands] of SORCERY_VICTORY_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [unitId, x, y, type, targetId, facing] of commands) {
        const unit = stage.getUnit(unitId), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED);
        if (origin.x !== x || origin.y !== y) cell(x, y).dispatch("click");
        assert.equal(createStageDigest(stage), before);
        if (type === "BOW_ATTACK") elements.bowButton.dispatch("click");
        if (type === "CHARGE") elements.chargeButton.dispatch("click");
        const tactic = ["CONFUSION_LV1", "CONFUSION_LV2", "CONFUSION_LV3", "ILLUSION"].includes(type);
        if (tactic) {
          elements.tacticButton.dispatch("click");
          if (type !== "ILLUSION") ({ CONFUSION_LV1: elements.confusionLv1Button, CONFUSION_LV2: elements.confusionLv2Button, CONFUSION_LV3: elements.confusionLv3Button })[type].dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true, `${stage.turn}: ${unitId} -> ${targetId}`);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click"); face(x, y, facing);
        }
        if (tactic) {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "SORCERY_TACTIC");
          face(x, y, facing);
        }
        await waitUntil(() => controller.getBattleResult() !== null
          || isRenderedMode(runtime, InteractionMode.UNIT_SELECT), `SORCERY_ACTION_${stage.turn}_${unitId}`);
      }
      if (index < SORCERY_VICTORY_ROUTE.length - 1) {
        elements.endTurnButton.dispatch("click");
        if (index === 4) {
          await waitUntil(() => !elements.dialogueOverlay.hidden && elements.dialogueAction.textContent === "罠", "SORCERY_FATAL_TRAP");
          assert.equal(elements.dialogueText.textContent, "ぐっ……足元に罠が……！");
          const unit = stage.getUnit("sun_li_gaotang");
          assert.equal(unit.troops, 0); assert.equal(unit.actionState, "FINISHED");
          const before = createStageDigest(stage), random = battleRandom.exportState();
          cell(3, 11).dispatch("click"); elements.endTurnButton.dispatch("click");
          assert.equal(createStageDigest(stage), before); assert.deepEqual(battleRandom.exportState(), random);
          elements.dialogueNextButton.dispatch("click");
        }
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "SORCERY_TURN");
      }
      if (!controller.getBattleResult()) assert.equal(controller.isStableForSave(), true);
      assert.equal(stage.validateRuntime(), true);
    }
    await advance(stage.victoryDialogue);
    assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_annihilation`, turn: 18, phase: "PLAYER" });
    assert.equal(stage.getUnit("song_jiang_gaotang").troops, 149);
    assert.equal(stage.armyManager.playerArmy.getUnits().filter(unit => unit.hasTroops()).length, 5);
    assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 0);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("selecting a destination beyond a hidden trap immediately stops at the trap without an action or facing click", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ id: "trap_click", map: Array.from({ length: 3 }, () => Array(5).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 1 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 4, y: 1 } }],
    hiddenTrapDefinitions: [{ id: "trap", kind: "normal", count: 1, candidatePositions: [{ x: 2, y: 1 }], triggerAffiliations: [Affiliation.PLAYER] }] });
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "TRAP_CLICK_READY");
    const actor = stage.getUnit("actor"), random = battleRandom.exportState();
    elements.board.children[5].dispatch("click");
    elements.board.children[8].dispatch("click");
    assert.equal(screen.mode, InteractionMode.LOCKED);
    elements.resetButton.dispatch("click"); elements.waitButton.dispatch("click"); elements.board.children[8].dispatch("click");
    await waitUntil(() => !elements.dialogueOverlay.hidden, "TRAP_REACTION");
    assert.equal(elements.dialogueAction.textContent, "罠");
    assert.equal(elements.dialogueText.textContent, "しまった、罠だ！　隊列が乱れた。ここで立て直すぞ！");
    assert.equal(controller.isStableForSave(), false);
    const duringDialogue = createStageDigest(stage);
    elements.resetButton.dispatch("click"); elements.endTurnButton.dispatch("click"); elements.board.children[8].dispatch("click");
    assert.equal(createStageDigest(stage), duringDialogue);
    elements.dialogueNextButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "TRAP_CLICK_STOPPED");
    assert.equal(stage.map.getPosition(actor).toKey(), "2,1");
    assert.equal(actor.troops, 105); assert.equal(actor.getStatusTurns("CONFUSED"), 1);
    assert.equal(actor.actionState, UnitActionState.FINISHED); assert.equal(actor.facing, Facing.EAST);
    assert.equal(stage.getHiddenTraps()[0].active, false);
    assert.equal(controller.isStableForSave(), true);
    assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "TRAP").length, 1);
    assert.deepEqual(battleRandom.exportState(), random);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("trap awareness preserves cancellable movement while spell immunity still consumes and stops at a trap", async () => {
  for (const [ability, kind, commits] of [["hidden_trap_awareness", "normal", false], ["illusion", "spell", true]]) {
    const restore = installFakeDocument();
    const stage = createServiceStage({ id: `trap_ability_${kind}`, map: Array.from({ length: 3 }, () => Array(5).fill("plain")),
      units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 1 }, abilities: [ability] },
        { id: "enemy", army: Affiliation.ENEMY, position: { x: 4, y: 1 } }],
      hiddenTrapDefinitions: [{ id: "trap", kind, position: { x: 2, y: 1 }, triggerAffiliations: [Affiliation.PLAYER] }] });
    const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
    const completion = controller.startNewBattle(); completion.catch(() => {});
    try {
      await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "TRAP_ABILITY_READY");
      const actor = stage.getUnit("actor"), before = controller.createSaveSnapshot(), random = battleRandom.exportState();
      elements.board.children[5].dispatch("click"); elements.board.children[8].dispatch("click");
      if (commits) {
        assert.equal(screen.mode, InteractionMode.LOCKED);
        await waitUntil(() => !elements.dialogueOverlay.hidden, "SPELL_NEUTRALIZED_REACTION");
        assert.equal(elements.dialogueAction.textContent, "妖術罠無効");
        elements.dialogueNextButton.dispatch("click");
        await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "SPELL_NEUTRALIZED");
        assert.equal(stage.map.getPosition(actor).toKey(), "2,1");
        assert.equal(actor.actionState, UnitActionState.FINISHED);
        assert.equal(stage.getHiddenTraps()[0].active, false);
        assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "TRAP").length, 1);
      } else {
        assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW);
        elements.resetButton.dispatch("click");
        assert.deepEqual(controller.createSaveSnapshot(), before);
        elements.board.children[8].dispatch("click"); elements.waitButton.dispatch("click");
        elements.board.children[3].dispatch("click");
        await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "AWARE_TRAP_PASSED");
        assert.equal(stage.map.getPosition(actor).toKey(), "3,1");
        assert.equal(stage.getHiddenTraps()[0].active, true);
      }
      assert.equal(actor.troops, actor.maxTroops);
      assert.equal(actor.getStatusTurns("CONFUSED"), 0); assert.equal(actor.getStatusTurns("ILLUSION"), 0);
      assert.deepEqual(battleRandom.exportState(), random);
      assert.deepEqual(controller.getDiagnostics(), []);
    } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
  }
});

test("the last required escape unit wins on the destination click while ordinary moves remain cancellable", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ id: "click_escape", map: Array.from({ length: 3 }, () => Array(5).fill("plain")),
    units: [{ id: "first", army: Affiliation.PLAYER, position: { x: 1, y: 2 } },
      { id: "last", army: Affiliation.PLAYER, position: { x: 0, y: 1 } },
      { id: "other", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 4, y: 2 } }],
    objectives: [{ id: "escape_pair", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
      unitIds: ["first", "last"], destination: { x: 3, y: 0 }, radius: 1 }] });
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * 5 + x];
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "ESCAPE_PAIR_READY");
    const before = createStageDigest(stage), random = battleRandom.exportState();
    // First required unit is not enough to win, so it can still cancel its preview.
    cell(1, 2).dispatch("click"); cell(3, 1).dispatch("click");
    assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW);
    assert.equal(createStageDigest(stage), before);
    elements.resetButton.dispatch("click");
    assert.equal(createStageDigest(stage), before);
    cell(3, 1).dispatch("click"); elements.waitButton.dispatch("click"); cell(3, 2).dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "FIRST_ESCAPEE_WAIT");
    assert.equal(controller.getBattleResult(), null);
    // A non-required unit cannot finish the objective by entering the same zone.
    const afterFirst = createStageDigest(stage);
    cell(0, 0).dispatch("click"); cell(2, 0).dispatch("click");
    assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW);
    elements.resetButton.dispatch("click");
    assert.equal(createStageDigest(stage), afterFirst);
    cell(0, 1).dispatch("click"); cell(2, 0).dispatch("click");
    assert.equal(screen.mode, InteractionMode.LOCKED);
    // Duplicate clicks and command buttons cannot add a wait or a second move.
    cell(2, 0).dispatch("click"); elements.waitButton.dispatch("click"); elements.resetButton.dispatch("click");
    assert.equal((await completion).objectiveId, "escape_pair");
    assert.equal(stage.map.getPosition(stage.getUnit("last")).toKey(), "2,0");
    assert.equal(stage.getUnit("last").actionState, UnitActionState.MOVED);
    assert.deepEqual(battleRandom.exportState(), random);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("an unmoved actor can switch to inspecting a finished or inactive ally without losing unit information", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ id: "inspect_unavailable_ally", map: Array.from({ length: 3 }, () => Array(5).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 } },
      { id: "finished", army: Affiliation.PLAYER, position: { x: 2, y: 2 } },
      { id: "inactive", army: Affiliation.PLAYER, position: { x: 4, y: 2 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 4, y: 0 } }],
    unitControlRules: [{ unitId: "inactive", alwaysInactive: true, actionLabel: "潜入待機" }] });
  const runtime = createScreenRuntime(stage), { elements, controller, screen } = runtime;
  const completion = controller.startNewBattle();
  const cell = (x, y) => elements.board.children[y * 5 + x];
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "INSPECT_READY");
    cell(2, 2).dispatch("click"); elements.waitButton.dispatch("click"); cell(2, 1).dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "INSPECT_FINISHED");
    assert.equal(stage.getUnit("finished").actionState, UnitActionState.FINISHED);
    const before = createStageDigest(stage), random = runtime.battleRandom.exportState(), logs = stage.battleLog.getEntries();
    for (const [id, x, label] of [["finished", 2, "行動済み"], ["inactive", 4, "潜入待機"]]) {
      cell(0, 2).dispatch("click");
      assert.equal(screen.mode, InteractionMode.UNIT_SELECTED);
      cell(x, 2).dispatch("click");
      assert.equal(screen.mode, InteractionMode.UNIT_SELECT);
      assert.match(elements.selectedUnitText.textContent, new RegExp(stage.getUnit(id).character.name));
      assert.match(elements.selectedUnitText.textContent, new RegExp(label));
      assert.equal(elements.selectedUnitInfo.hidden, false);
      assert.equal(elements.actionPanel.hidden, true);
      assert.equal(elements.waitButton.disabled, true);
      assert.equal(elements.board.children.some(element => element.classList.has("is-reachable")), false);
    }
    // No switching once a move is previewed.
    cell(0, 2).dispatch("click"); cell(0, 1).dispatch("click"); cell(4, 2).dispatch("click");
    assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW);
    assert.match(elements.selectedUnitText.textContent, new RegExp(stage.getUnit("actor").character.name));
    elements.resetButton.dispatch("click");
    assert.equal(createStageDigest(stage), before);
    assert.deepEqual(runtime.battleRandom.exportState(), random);
    assert.deepEqual(stage.battleLog.getEntries(), logs);
  } finally { screen.dispose(); controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); restore(); }
});

test("second chapter reaches victory and closing dialogue through board and command button clicks", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager();
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition("wild-boar-forest", characters)] }).create("wild-boar-forest");
  const runtime = createScreenRuntime(stage), { elements, controller, screen } = runtime;
  const completion = controller.startNewBattle();
  // Attach a rejection handler while exercising asynchronous presentation callbacks.
  completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const facingCell = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advanceDialogue = async (label) => {
    await waitUntil(() => !elements.dialogueOverlay.hidden, `${label}_VISIBLE`);
    const lines = [];
    for (let n = 0; n < 10 && !elements.dialogueOverlay.hidden; n++) {
      lines.push(elements.dialogueText.textContent);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
    assert.equal(elements.dialogueOverlay.hidden, true);
    assert.ok(lines.length > 0);
    return lines;
  };
  try {
    assert.deepEqual(await advanceDialogue("INTRO"), stage.introDialogue.speeches.map(speech => speech.text));
    await waitUntil(() => !elements.missionOverlay.hidden, "SECOND_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "SECOND_READY");
    for (const [index, commands] of SECOND_CHAPTER_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [id, x, y, type, targetId, facing = "NORTH"] of commands) {
        const unit = stage.getUnit(id), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED);
        cell(x, y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW);
        assert.equal(createStageDigest(stage), before, "preview must not commit movement or facing");
        if (type === "CHARGE") {
          assert.equal(elements.chargeButton.disabled, false);
          elements.chargeButton.dispatch("click");
        } else if (type === "CONFUSION_LV1") {
          assert.equal(elements.tacticButton.disabled, false);
          elements.tacticButton.dispatch("click");
          elements.confusionLv1Button.dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true);
          cell(target.x, target.y).dispatch("click");
        } else facingCell(x, y, facing);
        if (type === "CONFUSION_LV1") {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "SECOND_TACTIC_FACING");
          assert.equal(elements.resetButton.disabled, true);
          facingCell(x, y, facing);
        }
        await waitUntil(() => unit.actionState === UnitActionState.FINISHED &&
          (controller.getBattleResult() !== null || isRenderedMode(runtime, InteractionMode.UNIT_SELECT)), "SECOND_ACTION_FINISHED");
      }
      if (index < SECOND_CHAPTER_ROUTE.length - 1) {
        assert.equal(elements.endTurnButton.disabled, false);
        elements.endTurnButton.dispatch("click");
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "SECOND_NEXT_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    assert.deepEqual(await advanceDialogue("VICTORY"), stage.victoryDialogue.speeches.map(speech => speech.text));
    assert.equal((await completion).outcome, BattleOutcome.VICTORY);
    assert.equal(stage.turn, 8);
    assert.equal(stage.getUnit("lin_chong").troops, 32);
    assert.equal(stage.getUnit("lu_zhishen").troops, 3);
    assert.equal(screen.mode, InteractionMode.LOCKED);
    assert.equal(elements.endTurnButton.disabled, true);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

test("v9 movement preview draws at the destination, cancels without mutation, and commits via an adjacent facing cell", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ id: "v9_preview_wait", map: Array.from({ length: 3 }, () => Array(5).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 4, y: 0 } }] });
  const runtime = createScreenRuntime(stage), completion = runtime.controller.startNewBattle();
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "V9_PREVIEW_READY");
    const actor = stage.getUnit("actor"), before = createStageDigest(stage), randomBefore = runtime.battleRandom.exportState();
    const cell = (x, y) => runtime.elements.board.children[y * 5 + x];
    const hasActor = (element) => element.children.some((child) => child.dataset?.unitId === "actor");
    cell(0, 2).dispatch("click"); cell(1, 2).dispatch("click");
    assert.equal(hasActor(cell(0, 2)), false); assert.equal(hasActor(cell(1, 2)), true);
    assert.equal(stage.map.getPosition(actor).toKey(), "0,2");
    assert.equal(runtime.elements.endTurnButton.disabled, true);
    runtime.elements.waitButton.dispatch("click");
    runtime.elements.resetButton.dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
    assert.equal(hasActor(cell(0, 2)), true); assert.equal(hasActor(cell(1, 2)), false);
    assert.equal(createStageDigest(stage), before); assert.deepEqual(runtime.battleRandom.exportState(), randomBefore);
    cell(1, 2).dispatch("click"); runtime.elements.waitButton.dispatch("click"); cell(1, 1).dispatch("click");
    await waitUntil(() => actor.actionState === UnitActionState.FINISHED && runtime.controller.flowState === BattleFlowState.IDLE, "V9_GRID_FACING");
    assert.equal(stage.map.getPosition(actor).toKey(), "1,2"); assert.equal(actor.facing, Facing.NORTH);
    assert.deepEqual(runtime.battleRandom.exportState(), randomBefore);
    cell(4, 0).dispatch("click");
    assert.equal(runtime.elements.commandDock.hidden, false);
    assert.equal(runtime.elements.actionPanel.hidden, true);
    assert.match(runtime.elements.selectedUnitText.textContent, /enemy/);
  } finally { runtime.screen.dispose(); runtime.controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); restore(); }
});

test("mission briefing locks input and a discarded battle aborts its pending start button", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ id: "v9_briefing", map: [["plain", "plain"]],
    briefing: { victory: "敵軍を全滅", defeat: "主将が敗走" },
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } }, { id: "enemy", army: Affiliation.ENEMY, position: { x: 1, y: 0 } }] });
  const runtime = createScreenRuntime(stage), completion = runtime.controller.startNewBattle();
  try {
    assert.equal(runtime.elements.missionOverlay.hidden, false);
    assert.equal(runtime.elements.missionVictory.textContent, "敵軍を全滅");
    assert.equal(runtime.elements.endTurnButton.disabled, true);
    assert.equal(runtime.controller.isStableForSave(), false);
    runtime.screen.dispose(); runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
    assert.equal(runtime.elements.missionOverlay.hidden, true);
    assert.equal(runtime.elements.missionStartButton.listeners.has("click"), false);
    runtime.elements.missionStartButton.dispatch("click");
    assert.equal(stage.turn, 1);
  } finally { runtime.screen.dispose(); runtime.controller.dispose(); restore(); }
});

test("BattleScreen closes intro, commits Preview attack and shows victory", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_victory",
      map: [["plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          character: { martial: 100, command: 100 }
        },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 2, y: 0 },
          maxTroops: 10,
          troops: 10,
          character: { command: 0 }
        }
      ],
      speeches: [{
        id: "intro_speech",
        speakerCharacterId: "actor_character",
        text: "Begin."
      }],
      dialogues: [{ id: "intro", speechIds: ["intro_speech"] }],
      introDialogueId: "intro",
      objectives: [{
        id: "victory",
        type: ObjectiveType.ELIMINATION,
        outcome: ObjectiveOutcome.VICTORY,
        targetArmy: Affiliation.ENEMY
      }]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();

    assert.equal(runtime.screen.mode, InteractionMode.LOCKED);
    assert.equal(runtime.elements.dialogueOverlay.hidden, false);
    runtime.elements.dialogueNextButton.dispatch("click");
    await waitUntil(
      () => runtime.controller.flowState === BattleFlowState.IDLE
        && isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "SCREEN_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
    runtime.elements.board.children[1].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.MOVE_PREVIEW);
    assert.equal(runtime.elements.board.children[2].classList.has("is-target"), true);
    runtime.elements.board.children[2].dispatch("click");

    const result = await completion;
    assert.equal(result.outcome, BattleOutcome.VICTORY);
    assert.equal(stage.map.getPosition(stage.getUnit("target")), null);
    assert.equal(runtime.elements.eventText.textContent, "Victory.");
    assert.equal(runtime.screen.mode, InteractionMode.LOCKED);
    runtime.screen.dispose();
    runtime.controller.dispose();
  } finally {
    restoreDocument();
  }
});

test("BattleScreen commits Wait only after an explicit final facing", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_wait",
      map: [["plain", "plain"]],
      units: [
        { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
        { id: "enemy", army: Affiliation.ENEMY, position: { x: 1, y: 0 } }
      ]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => runtime.controller.flowState === BattleFlowState.IDLE
        && isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "WAIT_SCREEN_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    runtime.elements.waitButton.dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.WAIT_FACING_SELECT);
    assert.equal(stage.getUnit("actor").actionState, UnitActionState.READY);
    assert.equal(runtime.elements.endTurnButton.disabled, true);
    runtime.elements.facingNorthButton.dispatch("click");
    await waitUntil(
      () => stage.getUnit("actor").actionState === UnitActionState.FINISHED
        && runtime.controller.flowState === BattleFlowState.IDLE,
      "WAIT_COMMITTED"
    );

    assert.equal(stage.getUnit("actor").facing, Facing.NORTH);
    assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECT);
    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("BattleScreen rejects a second tap while the first command is resolving", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_double_tap",
      map: [["plain", "plain"]],
      units: [
        { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 1, y: 0 },
          maxTroops: 500,
          troops: 500
        }
      ]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => runtime.controller.flowState === BattleFlowState.IDLE
        && isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "DOUBLE_TAP_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    const targetButton = runtime.elements.board.children[1];
    targetButton.dispatch("click");
    targetButton.dispatch("click");
    await waitUntil(
      () => stage.getUnit("actor").actionState === UnitActionState.FINISHED
        && runtime.controller.flowState === BattleFlowState.IDLE,
      "DOUBLE_TAP_FINISHED"
    );

    assert.equal(stage.getUnit("target").troops < 500, true);
    assert.deepEqual(runtime.battleRandom.exportState(), {
      algorithm: "xorshift32",
      state: 270369
    });
    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("BattleScreen closes an active Dialogue when the Battle is disposed", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_dialogue_abort",
      map: [["plain", "plain"]],
      units: [
        { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
        { id: "enemy", army: Affiliation.ENEMY, position: { x: 1, y: 0 } }
      ],
      speeches: [{
        id: "intro_speech",
        speakerCharacterId: "actor_character",
        text: "Begin."
      }],
      dialogues: [{ id: "intro", speechIds: ["intro_speech"] }],
      introDialogueId: "intro"
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();

    assert.equal(runtime.elements.dialogueOverlay.hidden, false);
    runtime.controller.dispose();

    await assert.rejects(completion, { name: "AbortError" });
    assert.equal(runtime.elements.dialogueOverlay.hidden, true);
    runtime.screen.dispose();
  } finally {
    restoreDocument();
  }
});

test("BattleScreen executes a projectile selected from the command panel", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_projectile",
      map: [["plain", "plain", "plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          abilities: [UnitAbility.BOW_ATTACK],
          maxUses: { [UnitUse.PROJECTILE]: 2 }
        },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 4, y: 0 },
          maxTroops: 500,
          troops: 500
        }
      ]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "PROJECTILE_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    assert.equal(runtime.elements.bowButton.disabled, true);
    runtime.elements.board.children[1].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.MOVE_PREVIEW);
    assert.equal(runtime.elements.bowButton.textContent, "弓撃 2/2");
    assert.equal(runtime.elements.bowButton.disabled, false);
    runtime.elements.bowButton.dispatch("click");

    assert.equal(runtime.screen.mode, InteractionMode.BOW_TARGET_SELECT);
    assert.equal(runtime.elements.board.dataset.actionType, ActionType.BOW_ATTACK);
    assert.equal(runtime.elements.board.children[4].classList.has("is-target"), true);
    runtime.elements.board.children[4].dispatch("click");
    await waitUntil(
      () => stage.getUnit("actor").actionState === UnitActionState.FINISHED
        && runtime.controller.flowState === BattleFlowState.IDLE,
      "PROJECTILE_FINISHED"
    );

    assert.equal(stage.getUnit("target").troops < 500, true);
    assert.equal(stage.getUnit("actor").remainingUses[UnitUse.PROJECTILE], 1);
    assert.equal(stage.map.getPosition(stage.getUnit("actor")).toKey(), "1,0");
    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("BattleScreen executes Charge only through its highlighted adjacent target", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_charge",
      map: [["plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          abilities: [UnitAbility.CHARGE],
          maxUses: { [UnitUse.CHARGE]: 2 }
        },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 1, y: 0 },
          maxTroops: 500,
          troops: 500
        }
      ]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "CHARGE_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    assert.equal(runtime.elements.chargeButton.disabled, false);
    runtime.elements.chargeButton.dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.CHARGE_TARGET_SELECT);
    assert.equal(runtime.elements.board.children[1].classList.has("is-target"), true);
    runtime.elements.board.children[2].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.CHARGE_TARGET_SELECT);
    runtime.elements.board.children[1].dispatch("click");
    await waitUntil(
      () => stage.getUnit("actor").actionState === UnitActionState.FINISHED
        && runtime.controller.flowState === BattleFlowState.IDLE,
      "CHARGE_FINISHED"
    );

    assert.equal(stage.getUnit("target").troops < 500, true);
    assert.equal(stage.getUnit("actor").remainingUses[UnitUse.CHARGE], 1);
    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("BattleScreen maps every targeted tactic mode without changing Domain or RNG", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_tactic_modes",
      map: [["plain", "plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          abilities: [
            UnitAbility.CONFUSION_LEVEL_3,
            UnitAbility.ILLUSION,
            UnitAbility.FIRE_TACTIC,
            UnitAbility.WATER_TACTIC
          ],
          maxUses: { [UnitUse.TACTIC]: 6 },
          character: { intelligence: 100 }
        },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 2, y: 0 },
          character: { intelligence: 0 }
        }
      ]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "TACTIC_MODES_READY"
    );
    runtime.elements.board.children[0].dispatch("click");
    const domainBefore = createStageDigest(stage);
    const randomBefore = runtime.battleRandom.exportState();
    const cases = [
      ["confusionLv1Button", InteractionMode.CONFUSION_LV1_TARGET_SELECT, ActionType.CONFUSION_LV1],
      ["confusionLv2Button", InteractionMode.CONFUSION_LV2_TARGET_SELECT, ActionType.CONFUSION_LV2],
      ["confusionLv3Button", InteractionMode.CONFUSION_LV3_TARGET_SELECT, ActionType.CONFUSION_LV3],
      ["illusionButton", InteractionMode.ILLUSION_TARGET_SELECT, ActionType.ILLUSION],
      ["fireButton", InteractionMode.FIRE_TARGET_SELECT, ActionType.FIRE],
      ["waterButton", InteractionMode.WATER_TARGET_SELECT, ActionType.WATER]
    ];

    for (const [buttonKey, expectedMode, actionType] of cases) {
      runtime.elements.tacticButton.dispatch("click");
      assert.equal(runtime.screen.mode, InteractionMode.CONFUSION_LEVEL_SELECT);
      assert.equal(runtime.elements.tacticPanel.hidden, false);
      runtime.elements[buttonKey].dispatch("click");
      assert.equal(runtime.screen.mode, expectedMode);
      assert.equal(runtime.elements.board.dataset.actionType, actionType);
      assert.equal(runtime.elements.board.children[2].classList.has("is-target"), true);
      runtime.elements.board.children[3].dispatch("click");
      assert.equal(runtime.screen.mode, expectedMode);
      runtime.elements.resetButton.dispatch("click");
      if ([ActionType.CONFUSION_LV1, ActionType.CONFUSION_LV2, ActionType.CONFUSION_LV3].includes(actionType)) {
        assert.equal(runtime.screen.mode, InteractionMode.CONFUSION_LEVEL_SELECT);
        assert.equal(runtime.elements.tacticPanel.hidden, false);
        runtime.elements.resetButton.dispatch("click");
      }
      assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
    }

    assert.equal(createStageDigest(stage), domainBefore);
    assert.deepEqual(runtime.battleRandom.exportState(), randomBefore);
    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("V9 target selection keeps the actor until Back, then permits another READY ally", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_target_switch",
      map: [["plain", "plain", "plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          abilities: [UnitAbility.BOW_ATTACK],
          maxUses: { [UnitUse.PROJECTILE]: 2 }
        },
        {
          id: "other",
          army: Affiliation.PLAYER,
          position: { x: 4, y: 0 }
        },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 3, y: 0 }
        }
      ]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "TARGET_SWITCH_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    runtime.elements.bowButton.dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.BOW_TARGET_SELECT);
    const domainBefore = createStageDigest(stage);
    const randomBefore = runtime.battleRandom.exportState();
    runtime.elements.board.children[0].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.BOW_TARGET_SELECT);
    runtime.elements.board.children[4].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.BOW_TARGET_SELECT);
    assert.equal(runtime.elements.selectedUnitText.textContent.includes("actor"), true);
    runtime.elements.resetButton.dispatch("click");
    runtime.elements.board.children[4].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
    assert.equal(runtime.elements.selectedUnitText.textContent.includes("other"), true);
    assert.equal(runtime.elements.board.dataset.actionType, "");
    assert.equal(createStageDigest(stage), domainBefore);
    assert.deepEqual(runtime.battleRandom.exportState(), randomBefore);
    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("BattleScreen commits Confusion Lv2 then requires final tactic facing", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_confusion",
      map: [["plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          abilities: [UnitAbility.CONFUSION_LEVEL_3],
          maxUses: { [UnitUse.TACTIC]: 5 },
          character: { intelligence: 100 }
        },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 2, y: 0 },
          character: { intelligence: 0 }
        }
      ]
    });
    const keyboardTarget = new FakeElement();
    const runtime = createScreenRuntime(stage, { keyboardTarget, advanceTacticDialogues: false });
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "CONFUSION_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    runtime.elements.tacticButton.dispatch("click");
    runtime.elements.confusionLv2Button.dispatch("click");
    runtime.elements.board.children[2].dispatch("click");
    await waitUntil(() => !runtime.elements.dialogueOverlay.hidden, "CONFUSION_SUCCESS_DIALOGUE");
    assert.equal(runtime.elements.dialogueText.textContent, "かかった。敵の動きは乱れたぞ！");
    assert.equal(runtime.elements.dialogueAction.textContent, "撹乱成功");
    assert.equal(runtime.screen.mode, InteractionMode.LOCKED);
    assert.equal(runtime.controller.isStableForSave(), false);
    assert.equal(runtime.elements.endTurnButton.disabled, true);
    const duringDialogue = createStageDigest(stage), duringRandom = runtime.battleRandom.exportState();
    keyboardTarget.dispatch("keydown", { key: "Escape" });
    runtime.elements.board.children[1].dispatch("click");
    assert.equal(createStageDigest(stage), duringDialogue);
    assert.deepEqual(runtime.battleRandom.exportState(), duringRandom);
    assert.equal(runtime.elements.dialogueOverlay.hidden, false);
    runtime.elements.dialogueNextButton.dispatch("click");
    assert.equal(runtime.elements.dialogueText.textContent, "何だ……命令が聞き取れん！　隊列が崩れる！");
    assert.equal(runtime.elements.dialogueAction.textContent, "撹乱状態");
    assert.equal(runtime.screen.mode, InteractionMode.LOCKED);
    runtime.elements.dialogueNextButton.dispatch("click");
    await waitUntil(
      () => runtime.controller.flowState === BattleFlowState.IDLE
        && runtime.screen.mode === InteractionMode.TACTIC_FACING_SELECT,
      "CONFUSION_FACING"
    );

    assert.equal(stage.getUnit("actor").actionState, UnitActionState.TACTIC_COMMITTED);
    assert.equal(stage.getUnit("actor").remainingUses[UnitUse.TACTIC], 3);
    assert.equal(stage.getUnit("target").getStatusTurns(UnitStatus.CONFUSED) > 0, true);
    assert.equal(runtime.elements.resetButton.disabled, true);
    const committed = createStageDigest(stage), committedRandom = runtime.battleRandom.exportState();
    keyboardTarget.dispatch("keydown", { key: "Escape" });
    runtime.elements.resetButton.dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.TACTIC_FACING_SELECT);
    assert.equal(createStageDigest(stage), committed);
    assert.deepEqual(runtime.battleRandom.exportState(), committedRandom);
    runtime.elements.facingSouthButton.dispatch("click");
    await waitUntil(
      () => stage.getUnit("actor").actionState === UnitActionState.FINISHED,
      "CONFUSION_FINISHED"
    );
    assert.equal(stage.getUnit("actor").facing, Facing.SOUTH);

    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("BattleScreen commits Wide Illusion without target selection or use consumption", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "screen_wide_illusion",
      map: [["plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          abilities: [UnitAbility.ILLUSION, UnitAbility.WIDE_ILLUSION],
          maxUses: { [UnitUse.TACTIC]: 2 }
        },
        {
          id: "target",
          army: Affiliation.ENEMY,
          position: { x: 2, y: 0 },
          character: { intelligence: 0 }
        }
      ]
    });
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "WIDE_ILLUSION_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    runtime.elements.tacticButton.dispatch("click");
    assert.equal(runtime.elements.wideIllusionButton.disabled, false);
    runtime.elements.wideIllusionButton.dispatch("click");
    await waitUntil(
      () => runtime.controller.flowState === BattleFlowState.IDLE
        && runtime.screen.mode === InteractionMode.TACTIC_FACING_SELECT,
      "WIDE_ILLUSION_FACING"
    );

    assert.equal(stage.getUnit("actor").remainingUses[UnitUse.TACTIC], 2);
    assert.equal(stage.getUnit("target").getStatusTurns(UnitStatus.ILLUSION) > 0, true);
    runtime.elements.facingEastButton.dispatch("click");
    await waitUntil(
      () => stage.getUnit("actor").actionState === UnitActionState.FINISHED,
      "WIDE_ILLUSION_FINISHED"
    );

    runtime.screen.dispose();
    runtime.controller.dispose();
    await assert.rejects(completion, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});


test("V9 special tactics go directly to targeting and return without spending uses", async () => {
  const restore = installFakeDocument();
  try {
    for (const [ability, mode] of [[UnitAbility.FIRE_TACTIC, InteractionMode.FIRE_TARGET_SELECT],
      [UnitAbility.WATER_TACTIC, InteractionMode.WATER_TARGET_SELECT], [UnitAbility.ILLUSION, InteractionMode.ILLUSION_TARGET_SELECT]]) {
      const stage = createServiceStage({ id: "direct_tactic", map: [["plain", "plain", "plain"]],
        units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 }, abilities: [ability], maxUses: { [UnitUse.TACTIC]: 3 } },
          { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }] });
      const runtime = createScreenRuntime(stage), completion = runtime.controller.startNewBattle();
      try {
        await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "DIRECT_READY");
        const before = createStageDigest(stage), random = runtime.battleRandom.exportState();
        runtime.elements.board.children[0].dispatch("click"); runtime.elements.tacticButton.dispatch("click");
        assert.equal(runtime.screen.mode, mode); assert.equal(runtime.elements.tacticPanel.hidden, true);
        runtime.elements.resetButton.dispatch("click");
        assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
        assert.equal(createStageDigest(stage), before); assert.deepEqual(runtime.battleRandom.exportState(), random);
      } finally { runtime.screen.dispose(); runtime.controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); }
    }
  } finally { restore(); }
});

test("long press inspects a preview without committing it and disposal cancels pending gestures", async (t) => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ id: "long_press_preview", map: [["plain", "forest", "plain", "plain"]],
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }] });
  const runtime = createScreenRuntime(stage), completion = runtime.controller.startNewBattle();
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "DETAIL_READY");
    runtime.elements.board.children[0].dispatch("click"); runtime.elements.board.children[1].dispatch("click");
    const cell = runtime.elements.board.children[1], overlay = runtime.elements.unitDetailOverlay;
    const before = createStageDigest(stage), random = runtime.battleRandom.exportState();
    t.mock.timers.enable({ apis: ["setTimeout", "Date"] });
    const pointer = { pointerId: 1, clientX: 30, clientY: 30, button: 0 };
    cell.dispatch("pointerdown", pointer); t.mock.timers.tick(430);
    assert.equal(overlay.hidden, false);
    const text = (element) => element.textContent + element.children.map(text).join(" ");
    assert.match(text(overlay), /地形 森/); assert.match(text(overlay), /武力/);
    assert.match(text(overlay), /向き 東/);
    assert.match(runtime.elements.selectedUnitText.textContent, /方向 東/);
    const token = cell.children.find((element) => element.dataset.unitId === "actor");
    assert.equal(token.children.find((element) => element.className === "unit-facing").dataset.facing, "EAST");
    assert.equal(stage.getUnit("actor").facing, "SOUTH");
    cell.dispatch("pointerup", pointer); cell.dispatch("click");
    assert.equal(overlay.hidden, false); assert.equal(runtime.screen.mode, InteractionMode.MOVE_PREVIEW);
    overlay.dispatch("click"); assert.equal(overlay.hidden, false);
    t.mock.timers.tick(251); overlay.dispatch("click"); assert.equal(overlay.hidden, true);
    const info = runtime.elements.selectedUnitInfo;
    info.dispatch("click"); assert.equal(overlay.hidden, false);
    assert.match(text(overlay), /地形 森/); assert.match(text(overlay), /向き 東/);
    for (const key of ["Enter", " ", "Escape"]) {
      overlay.dispatch("keydown", { key, repeat: true }); assert.equal(overlay.hidden, false);
    }
    overlay.dispatch("keydown", { key: "Escape" }); assert.equal(overlay.hidden, true);
    info.dispatch("keydown", { key: "Enter", repeat: true }); assert.equal(overlay.hidden, true);
    info.dispatch("keydown", { key: "Enter", isComposing: true }); assert.equal(overlay.hidden, true);
    info.dispatch("keydown", { key: "Enter" }); assert.equal(overlay.hidden, false);
    overlay.dispatch("keydown", { key: " " }); assert.equal(overlay.hidden, true);
    info.dispatch("pointerdown", pointer); t.mock.timers.tick(430);
    info.dispatch("pointerup", pointer); info.dispatch("click");
    assert.equal(overlay.hidden, false, "long-press release must not close or reopen the card");
    t.mock.timers.tick(251); overlay.dispatch("click"); assert.equal(overlay.hidden, true);
    assert.equal(runtime.screen.mode, InteractionMode.MOVE_PREVIEW);
    assert.equal(createStageDigest(stage), before); assert.deepEqual(runtime.battleRandom.exportState(), random);
    // Dragging cancels the timer and consumes the click generated after a scroll.
    cell.dispatch("pointerdown", pointer); cell.dispatch("pointermove", { ...pointer, clientY: 60 });
    t.mock.timers.tick(500); cell.dispatch("pointerup", pointer); cell.dispatch("click");
    assert.equal(overlay.hidden, true); assert.equal(runtime.screen.mode, InteractionMode.MOVE_PREVIEW);
    cell.dispatch("pointerdown", pointer); runtime.screen.dispose(); t.mock.timers.tick(500);
    assert.equal(overlay.hidden, true); assert.equal(cell.listeners.size, 0);
  } finally { t.mock.timers.reset(); runtime.screen.dispose(); runtime.controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); restore(); }
});


test("enemy turns focus the acting unit through movement, stationary attacks and confusion without enabling input", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({
    map: Array.from({ length: 7 }, () => Array(3).fill("plain")),
    units: [
      { id: "player", army: Affiliation.PLAYER, maxTroops: 1000, position: { x: 0, y: 6 } },
      { id: "moving", position: { x: 0, y: 0 }, move: 2 },
      { id: "archer", position: { x: 2, y: 6 }, abilities: [UnitAbility.BOW_ATTACK], maxUses: { [UnitUse.PROJECTILE]: 2 } },
      { id: "confused", position: { x: 2, y: 0 }, statusEffects: [{ type: UnitStatus.CONFUSED, remainingTurns: 1 }] }
    ]
  });
  const frames = [];
  const rings = () => runtime.elements.board.children.flatMap((cell) => cell.children
    .filter((child) => child.className?.includes("selection-ring"))
    .map((child) => ({ at: `${cell.dataset.x},${cell.dataset.y}`, className: child.className })));
  const runtime = createScreenRuntime(stage, { visualSession: {
    async present(request) {
      if (stage.phase !== "ENEMY") return false;
      const before = createStageDigest(stage), random = runtime.battleRandom.exportState();
      runtime.elements.board.children[18].dispatch("click");
      runtime.elements.waitButton.dispatch("click");
      runtime.elements.endTurnButton.dispatch("click");
      frames.push({ request, rings: rings(), mode: runtime.screen.mode,
        dockHidden: runtime.elements.commandDock.hidden,
        unchanged: before === createStageDigest(stage)
          && JSON.stringify(random) === JSON.stringify(runtime.battleRandom.exportState()) });
      return false;
    }, dispose() {}
  } });
  const completion = runtime.controller.startNewBattle();
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "FOCUS_START");
    runtime.elements.endTurnButton.dispatch("click");
    runtime.elements.confirmTurnEndButton.dispatch("click");
    await waitUntil(() => stage.turn === 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "FOCUS_END");
    const movement = frames.filter(({ request }) => request.type === "MOVE");
    assert.equal(movement.length, 2);
    const focus = frames.filter(({ request }) => request.type === "UNIT_FOCUS");
    assert.deepEqual(focus.map(({ request }) => request.payload.unitId), ["moving", "archer"]);
    assert.deepEqual(focus[0].rings, [{ at: "0,0", className: "selection-ring selection-ring-neutral" }]);
    assert.ok(frames.indexOf(focus[0]) < frames.indexOf(movement[0]));
    for (const frame of movement) {
      const { to } = frame.request.payload;
      assert.deepEqual(frame.rings, [{ at: `${to.x},${to.y}`, className: "selection-ring selection-ring-neutral" }]);
    }
    const bow = frames.find(({ request }) => request.type === "ACTION" && request.payload.actorId === "archer");
    assert.equal(bow.request.payload.actionType, ActionType.BOW_ATTACK);
    assert.deepEqual(bow.rings, [{ at: "2,6", className: "selection-ring selection-ring-neutral" }]);
    const skipped = frames.find(({ request }) => request.type === "STATUS" && request.payload.unitId === "confused");
    assert.deepEqual(skipped.rings, [{ at: "2,0", className: "selection-ring selection-ring-neutral" }]);
    assert.ok(frames.every((frame) => frame.mode === InteractionMode.LOCKED && frame.unchanged && frame.dockHidden));
    assert.deepEqual(rings(), []);
    runtime.elements.board.children[18].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
    assert.match(rings()[0].className, /ready/);
  } finally { runtime.screen.dispose(); runtime.controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); restore(); }
});

test("allied illusion follows its forced movement and releases focus before normal player input", async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ map: [Array(5).fill("plain")], units: [
    { id: "illusion", army: Affiliation.PLAYER, position: { x: 0, y: 0 },
      statusEffects: [{ type: UnitStatus.ILLUSION, remainingTurns: 1 }] },
    { id: "ally", army: Affiliation.PLAYER, position: { x: 3, y: 0 } },
    { id: "enemy", position: { x: 4, y: 0 } }
  ] });
  const frames = [];
  const rings = () => runtime.elements.board.children.flatMap((cell) => cell.children
    .filter((child) => child.className?.includes("selection-ring"))
    .map((child) => ({ at: `${cell.dataset.x},${cell.dataset.y}`, className: child.className })));
  const runtime = createScreenRuntime(stage, { visualSession: {
    async present(request) { frames.push({ request, rings: rings(), mode: runtime.screen.mode }); return false; },
    dispose() {}
  } });
  const completion = runtime.controller.startNewBattle();
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "ILLUSION_FOCUS_END");
    const movement = frames.filter(({ request }) => request.type === "MOVE");
    assert.deepEqual(movement.map(({ rings }) => rings), [
      [{ at: "1,0", className: "selection-ring selection-ring-ready" }],
      [{ at: "2,0", className: "selection-ring selection-ring-ready" }]
    ]);
    const action = frames.find(({ request }) => request.type === "ACTION");
    assert.equal(action.request.payload.forced, true);
    assert.deepEqual(action.rings, [{ at: "2,0", className: "selection-ring selection-ring-ready" }]);
    assert.ok([...movement, action].every(({ mode }) => mode === InteractionMode.LOCKED));
    assert.equal(stage.getUnit("illusion").actionState, UnitActionState.FINISHED);
    assert.ok(stage.getUnit("ally").troops < stage.getUnit("ally").maxTroops);
    assert.deepEqual(rings(), []);
    runtime.elements.board.children[3].dispatch("click");
    assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
    assert.deepEqual(rings(), [{ at: "3,0", className: "selection-ring selection-ring-ready" }]);
  } finally { runtime.screen.dispose(); runtime.controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); restore(); }
});

test("selection rings follow preview and completion; empty terrain inspection stays read-only", async () => {
 const restore = installFakeDocument();
 const stage = createServiceStage({ id: "selection_feedback", map: [["plain","plain","plain","plain"],["plain","plain","forest","wall"]],
   units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 1 } }, { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }] });
 const runtime = createScreenRuntime(stage), completion = runtime.controller.startNewBattle();
 const cell = (x,y) => runtime.elements.board.children[y*4+x];
 const ring = (x,y) => cell(x,y).children.find((child) => child.className?.includes("selection-ring"));
 try {
   await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "RING_READY");
   cell(0,1).dispatch("click"); assert.match(ring(0,1).className, /ready/);
   cell(1,1).dispatch("click"); assert.equal(ring(0,1),undefined); assert.match(ring(1,1).className,/ready/);
   assert.match(runtime.elements.selectedUnitText.textContent, /方向 東/);
   runtime.elements.resetButton.dispatch("click");
   assert.equal(stage.map.getPosition(stage.getUnit("actor")).toKey(), "0,1");
   assert.equal(stage.getUnit("actor").facing, "SOUTH");
   const restoredToken = cell(0,1).children.find((child) => child.dataset.unitId === "actor");
   assert.equal(restoredToken.children.find((child) => child.className === "unit-facing").dataset.facing, "SOUTH");
   assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
   assert.match(ring(0,1).className, /ready/);
   cell(1,1).dispatch("click");
   cell(3,0).dispatch("click"); assert.match(ring(1,1).className,/ready/);
   runtime.elements.waitButton.dispatch("click"); runtime.elements.facingNorthButton.dispatch("click");
   await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "RING_FINISHED");
   assert.match(ring(1,1).className,/done/);
   const before=createStageDigest(stage), random=runtime.battleRandom.exportState();
   cell(3,0).dispatch("click"); assert.match(ring(3,0).className,/neutral/);
   cell(2,1).dispatch("click"); assert.match(ring(2,1).className,/neutral/);
   assert.equal(runtime.elements.commandDock.hidden,false); assert.equal(runtime.elements.selectedUnitInfo.hidden,true);
   assert.match(runtime.elements.terrainInfoText.textContent,/森/); assert.equal(runtime.elements.resetButton.disabled,false);
   cell(3,1).dispatch("click"); assert.match(runtime.elements.terrainInfoText.textContent,/進入不可/);
   assert.equal(createStageDigest(stage),before); assert.deepEqual(runtime.battleRandom.exportState(),random);
   runtime.elements.resetButton.dispatch("click"); assert.equal(runtime.elements.commandDock.hidden,true);
   assert.equal(ring(3,1),undefined);
 } finally {runtime.screen.dispose();runtime.controller.dispose();await assert.rejects(completion,{name:"AbortError"});restore();}
});

for (const input of ["button", "Escape"]) test(`one ${input} cancels a V9 movement preview from every uncommitted command without spending state`, async () => {
  const restore = installFakeDocument();
  const stage = createServiceStage({ id: "v9_cancel_submodes", map: Array.from({ length: 4 }, () => Array(5).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 }, facing: Facing.SOUTH,
      abilities: [UnitAbility.BOW_ATTACK, UnitAbility.CHARGE, UnitAbility.CONFUSION_LEVEL_3,
        UnitAbility.FIRE_TACTIC, UnitAbility.WATER_TACTIC, UnitAbility.ILLUSION],
      maxUses: { [UnitUse.PROJECTILE]: 3, [UnitUse.CHARGE]: 3, [UnitUse.TACTIC]: 6 } },
      { id: "ally", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "near", army: Affiliation.ENEMY, position: { x: 3, y: 2 } },
      { id: "far", army: Affiliation.ENEMY, position: { x: 4, y: 2 } }] });
  const keyboardTarget = new FakeElement();
  const runtime = createScreenRuntime(stage, { keyboardTarget }), completion = runtime.controller.startNewBattle();
  const back = () => input === "Escape" ? keyboardTarget.dispatch("keydown", { key: "Escape" }) : runtime.elements.resetButton.dispatch("click");
  const cell = (x, y) => runtime.elements.board.children[y * 5 + x];
  const token = (x, y) => cell(x, y).children.find((child) => child.dataset.unitId === "actor");
  const cases = [
    [[], InteractionMode.MOVE_PREVIEW], [["waitButton"], InteractionMode.WAIT_FACING_SELECT],
    [["bowButton"], InteractionMode.BOW_TARGET_SELECT], [["chargeButton"], InteractionMode.CHARGE_TARGET_SELECT],
    [["tacticButton"], InteractionMode.CONFUSION_LEVEL_SELECT],
    ...[["confusionLv1Button", InteractionMode.CONFUSION_LV1_TARGET_SELECT],
      ["confusionLv2Button", InteractionMode.CONFUSION_LV2_TARGET_SELECT],
      ["confusionLv3Button", InteractionMode.CONFUSION_LV3_TARGET_SELECT],
      ["fireButton", InteractionMode.FIRE_TARGET_SELECT], ["waterButton", InteractionMode.WATER_TARGET_SELECT],
      ["illusionButton", InteractionMode.ILLUSION_TARGET_SELECT]].map(([key, mode]) => [["tacticButton", key], mode])
  ];
  try {
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "CANCEL_SUBMODE_READY");
    const before = createStageDigest(stage), randomBefore = runtime.battleRandom.exportState(), logsBefore = stage.battleLog.getEntries();
    for (const [buttons, mode] of cases) {
      cell(0, 2).dispatch("click"); cell(2, 2).dispatch("click");
      for (const key of buttons) {
        assert.equal(runtime.elements[key].disabled, false, key);
        runtime.elements[key].dispatch("click");
      }
      assert.equal(runtime.screen.mode, mode);
      cell(0, 0).dispatch("click"); // Another ally cannot discard a pending preview.
      assert.equal(runtime.screen.mode, mode);
      assert.ok(token(2, 2)); assert.equal(token(0, 2), undefined);
      back();
      assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED);
      keyboardTarget.dispatch("keydown", { key: "Escape", repeat: true });
      assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECTED, "held Escape cannot clear the remaining selection");
      assert.ok(token(0, 2)); assert.equal(token(2, 2), undefined);
      assert.equal(token(0, 2).children.find((child) => child.className === "unit-facing").dataset.facing, Facing.SOUTH);
      assert.equal(runtime.elements.actionPanel.hidden, false);
      assert.equal(runtime.elements.endTurnButton.disabled, false);
      assert.equal(cell(1, 2).classList.has("is-reachable"), true);
      assert.equal(createStageDigest(stage), before); assert.deepEqual(runtime.battleRandom.exportState(), randomBefore);
      assert.deepEqual(stage.battleLog.getEntries(), logsBefore);
      back();
      assert.equal(runtime.screen.mode, InteractionMode.UNIT_SELECT);
    }
  } finally { runtime.screen.dispose(); runtime.controller.dispose(); await assert.rejects(completion, { name: "AbortError" }); restore(); }
});

test("eighth chapter screen escapes both prisoners through normal clicks and preserves the first arrival preview", async () => {
  const restore = installFakeDocument(), characters = createV9CharacterManager(), id = "daming-prison-break";
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] }).create(id);
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const face = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advance = async dialogue => {
    await waitUntil(() => !elements.dialogueOverlay.hidden, "DAMING_DIALOGUE");
    const lines = [];
    for (let n = 0; n < 12 && !elements.dialogueOverlay.hidden; n++) {
      const label = dialogue.speeches[n].actionLabel;
      assert.equal(elements.dialogueAction.textContent, label ?? "");
      assert.equal(elements.dialogueAction.hidden, !label);
      assert.equal(elements.dialogueNextButton.textContent, "進む");
      lines.push(elements.dialogueText.textContent);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
    assert.deepEqual(lines, dialogue.speeches.map(speech => speech.text));
    assert.equal(elements.dialogueOverlay.hidden, true);
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "DAMING_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "DAMING_READY");
    assert.deepEqual(elements.board.children.filter(cell => cell.classList.has("escape-zone"))
      .map(cell => `${cell.dataset.x},${cell.dataset.y}`), ["3,14", "2,15", "3,15", "4,15"]);
    assert.equal(elements.board.children.flatMap(cell => cell.children).filter(child => child.className === "escape-flag").length, 1);
    for (const [index, commands] of DAMING_ESCAPE_ROUTE.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [unitId, x, y, type, targetId, facing = "NORTH"] of commands) {
        const unit = stage.getUnit(unitId), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        const random = battleRandom.exportState();
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED, `${stage.turn}: ${unitId}`);
        if (origin.x !== x || origin.y !== y) cell(x, y).dispatch("click");
        if (type === "ESCAPE") {
          assert.equal(screen.mode, InteractionMode.LOCKED);
          await waitUntil(() => controller.getBattleResult() !== null, "DAMING_ESCAPE_CLICK");
          assert.deepEqual(battleRandom.exportState(), random);
          continue;
        }
        assert.equal(createStageDigest(stage), before);
        assert.deepEqual(battleRandom.exportState(), random);
        if (stage.turn === 6 && unitId === "lu_junyi_daming") {
          assert.equal(screen.mode, InteractionMode.MOVE_PREVIEW, "one required arrival is still a cancellable preview");
          elements.resetButton.dispatch("click");
          assert.equal(createStageDigest(stage), before);
          cell(x, y).dispatch("click");
          assert.equal(controller.getBattleResult(), null);
        }
        if (type === "CHARGE") elements.chargeButton.dispatch("click");
        if (type === "BOW_ATTACK") elements.bowButton.dispatch("click");
        if (type?.startsWith("CONFUSION_LV")) {
          elements.tacticButton.dispatch("click"); elements[`confusionLv${type.at(-1)}Button`].dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true, `${stage.turn}: ${unitId} targets ${targetId}`);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click"); face(x, y, facing);
        }
        if (type?.startsWith("CONFUSION_LV")) {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "DAMING_FACING");
          face(x, y, facing);
        }
        await waitUntil(() => unit.actionState === UnitActionState.FINISHED
          && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), `DAMING_ACTION_${stage.turn}_${unitId}`);
      }
      if (index < DAMING_ESCAPE_ROUTE.length - 1) {
        elements.endTurnButton.dispatch("click");
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "DAMING_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    await advance(stage.victoryDialogue);
    assert.equal((await completion).objectiveId, `${id}_escape`);
    assert.equal(stage.turn, 6);
    assert.equal(stage.getUnit("lu_junyi_daming").troops, 95);
    assert.equal(stage.getUnit("shi_xiu_daming").troops, 97);
    assert.equal(stage.map.getPosition(stage.getUnit("lu_junyi_daming")).toKey(), "3,14");
    assert.equal(stage.map.getPosition(stage.getUnit("shi_xiu_daming")).toKey(), "4,15");
    assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 20);
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
});

async function checkZengtouScreen({ route, eventDialogues, victory }) {
  const restore = installFakeDocument(), characters = createV9CharacterManager(), id = "zengtou-fortress";
  const stage = new StageFactory({ characterManager: characters, terrainCatalog: createV9CompatibleTerrainCatalog(),
    definitions: [createV9OpeningStageDefinition(id, characters)] }).create(id);
  const runtime = createScreenRuntime(stage), { controller, screen, elements, battleRandom } = runtime;
  const completion = controller.startNewBattle(); completion.catch(() => {});
  const cell = (x, y) => elements.board.children[y * stage.map.width + x];
  const face = (x, y, facing) => {
    const [dx, dy] = { NORTH: [0, -1], EAST: [1, 0], SOUTH: [0, 1], WEST: [-1, 0] }[facing];
    cell(x + dx, y + dy).dispatch("click");
  };
  const advance = async dialogue => {
    for (const speech of dialogue.speeches) {
      await waitUntil(() => !elements.dialogueOverlay.hidden && elements.dialogueText.textContent === speech.text, "ZENGTOU_DIALOGUE");
      assert.equal(elements.dialogueAction.textContent, speech.actionLabel ?? "");
      assert.equal(elements.dialogueAction.hidden, !speech.actionLabel);
      assert.equal(elements.dialogueNextButton.textContent, "進む");
      assert.equal(screen.mode, InteractionMode.LOCKED);
      assert.equal(controller.isStableForSave(), false);
      const before = createStageDigest(stage), random = battleRandom.exportState();
      cell(3, 10).dispatch("click"); elements.endTurnButton.dispatch("click");
      assert.equal(createStageDigest(stage), before);
      assert.deepEqual(battleRandom.exportState(), random);
      elements.dialogueNextButton.dispatch("click");
      await new Promise(setImmediate);
    }
  };
  try {
    await advance(stage.introDialogue);
    await waitUntil(() => !elements.missionOverlay.hidden, "ZENGTOU_MISSION");
    elements.missionStartButton.dispatch("click");
    await waitUntil(() => isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "ZENGTOU_READY");
    for (const [index, commands] of route.entries()) {
      assert.equal(stage.turn, index + 1);
      for (const [unitId, x, y, type, targetId, facing] of commands) {
        const unit = stage.getUnit(unitId), origin = stage.map.getPosition(unit), before = createStageDigest(stage);
        const random = battleRandom.exportState();
        cell(origin.x, origin.y).dispatch("click");
        assert.equal(screen.mode, InteractionMode.UNIT_SELECTED, `${stage.turn}: ${unitId}`);
        if (origin.x !== x || origin.y !== y) cell(x, y).dispatch("click");
        assert.equal(createStageDigest(stage), before);
        assert.deepEqual(battleRandom.exportState(), random);
        if (type === "CHARGE") elements.chargeButton.dispatch("click");
        if (type === "BOW_ATTACK") elements.bowButton.dispatch("click");
        const tactic = ["ILLUSION", "FIRE", "WATER"].includes(type) || type?.startsWith("CONFUSION_LV");
        if (tactic) {
          elements.tacticButton.dispatch("click");
          if (type.startsWith("CONFUSION_LV")) elements[`confusionLv${type.at(-1)}Button`].dispatch("click");
        }
        if (type) {
          const target = stage.map.getPosition(stage.getUnit(targetId));
          assert.equal(cell(target.x, target.y).classList.has("is-target"), true, `${stage.turn}: ${unitId} targets ${targetId}`);
          cell(target.x, target.y).dispatch("click");
        } else {
          elements.waitButton.dispatch("click"); face(x, y, facing);
        }
        if (tactic) {
          await waitUntil(() => isRenderedMode(runtime, InteractionMode.TACTIC_FACING_SELECT), "ZENGTOU_FACING");
          face(x, y, facing);
        }
        await waitUntil(() => controller.getBattleResult() !== null || (unit.actionState === UnitActionState.FINISHED
          && isRenderedMode(runtime, InteractionMode.UNIT_SELECT)), `ZENGTOU_ACTION_${stage.turn}_${unitId}`);
      }
      if (index < route.length - 1) {
        elements.endTurnButton.dispatch("click");
        for (const kind of eventDialogues[index + 2] ?? []) {
          await advance(stage.dialogueManager.get(`${id}_${kind}`));
        }
        await waitUntil(() => stage.turn === index + 2 && isRenderedMode(runtime, InteractionMode.UNIT_SELECT), "ZENGTOU_TURN");
      }
      assert.equal(stage.validateRuntime(), true);
    }
    assert.equal(stage.getUnit("qin_ming_zengtou").hasTroops(), false);
    assert.deepEqual(stage.eventManager.getCompletedEventIds(), [`${id}_defection`, `${id}_relief`]);
    if (victory) {
      await advance(stage.victoryDialogue);
      assert.deepEqual(await completion, { stageId: id, outcome: "VICTORY", objectiveId: `${id}_annihilation`, turn: 14, phase: "PLAYER" });
      assert.equal(stage.getUnit("song_jiang_zengtou").troops, 149);
      assert.equal(stage.getUnit("lu_junyi_zengtou").troops, 41);
      assert.equal(stage.armyManager.playerArmy.getUnits().filter(unit => unit.hasTroops()).length, 11);
      assert.equal(stage.armyManager.enemyArmy.getUnits().filter(unit => unit.hasTroops()).length, 0);
    } else {
      for (const unitId of ["yu_baosi", "guan_sheng_zengtou", "xu_ning_zengtou", "shan_tinggui_zengtou", "wei_dingguo_zengtou"]) {
        const unit = stage.getUnit(unitId);
        assert.equal(stage.armyManager.getAffiliation(unit), "PLAYER");
        assert.equal(unit.hasTroops(), true); assert.equal(unit.actionState, "FINISHED");
      }
      assert.equal(controller.getBattleResult(), null, "event progression is not a victory verification");
      assert.equal(controller.isStableForSave(), true);
    }
    assert.deepEqual(controller.getDiagnostics(), []);
  } finally { screen.dispose(); controller.dispose(); await completion.catch(() => {}); restore(); }
}

test("ninth chapter screen chains defection and relief dialogues, then accepts orders for all five arrivals", async () => {
  await checkZengtouScreen({ route: ZENGTOU_EVENT_ROUTE, eventDialogues: { 6: ["defection", "relief"] }, victory: false });
});

test("ninth chapter screen executes 327 commands via board clicks, fire and water, defection and the closing dialogue", async () => {
  await checkZengtouScreen({ route: ZENGTOU_VICTORY_ROUTE, eventDialogues: { 2: ["relief"], 6: ["defection"] }, victory: true });
});
