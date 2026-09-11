import test from "node:test";
import assert from "node:assert/strict";

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

function createScreenRuntime(stage) {
  const elements = createFakeBattleElements();
  const renderer = new BattleRenderer(elements);
  const effectManager = new BattleEffectManager({
    renderer,
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
    presentationPort: screen
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
    assert.equal(runtime.elements.bowButton.textContent, "Bow 2/2");
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

test("BattleScreen switches to another READY player unit from target selection", async () => {
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
    const runtime = createScreenRuntime(stage);
    const completion = runtime.controller.startNewBattle();
    await waitUntil(
      () => isRenderedMode(runtime, InteractionMode.UNIT_SELECT),
      "CONFUSION_READY"
    );

    runtime.elements.board.children[0].dispatch("click");
    runtime.elements.tacticButton.dispatch("click");
    runtime.elements.confusionLv2Button.dispatch("click");
    runtime.elements.board.children[2].dispatch("click");
    await waitUntil(
      () => runtime.controller.flowState === BattleFlowState.IDLE
        && runtime.screen.mode === InteractionMode.TACTIC_FACING_SELECT,
      "CONFUSION_FACING"
    );

    assert.equal(stage.getUnit("actor").actionState, UnitActionState.TACTIC_COMMITTED);
    assert.equal(stage.getUnit("actor").remainingUses[UnitUse.TACTIC], 3);
    assert.equal(stage.getUnit("target").getStatusTurns(UnitStatus.CONFUSED) > 0, true);
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
