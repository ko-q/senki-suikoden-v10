import test from "node:test";
import assert from "node:assert/strict";

import { ActionType } from "../src/core/action-request.js";
import {
  createSemanticPresentationRequest,
  PresentationRequestType
} from "../src/core/presentation-request.js";
import { Position } from "../src/domain/position.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import { BattleEffectManager } from "../src/presentation/battle-effect-manager.js";
import { BattleRenderer } from "../src/presentation/battle-renderer.js";
import { createStageDigest } from "../test-support/fixtures.js";
import {
  createFakeBattleElements,
  installFakeDocument
} from "../test-support/fake-battle-dom.js";
import {
  Affiliation,
  createServiceStage
} from "../test-support/service-fixtures.js";

function bindNoopHandlers(renderer) {
  renderer.bindHandlers({
    onAction() {},
    onCell() {},
    onClear() {},
    onEndTurn() {},
    onFacing() {},
    onNextDialogue() {},
    onPath() {},
    onTacticMenu() {},
    onWait() {}
  });
}

test("BattleRenderer draws Stage and Preview without changing Domain", () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "renderer_preview",
      map: [["plain", "plain", "plain"]],
      units: [
        { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
        { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }
      ]
    });
    const elements = createFakeBattleElements();
    const renderer = new BattleRenderer(elements);
    const actor = stage.getUnit("actor");
    const target = stage.getUnit("target");
    const digestBefore = createStageDigest(stage);
    bindNoopHandlers(renderer);

    renderer.render(stage, {
      mode: "MOVE_PREVIEW",
      domainLabel: "Stable",
      instruction: "Select a target.",
      selectedUnit: actor,
      reachableByKey: new Map([["1,0", 1]]),
      previewDestination: new Position(1, 0),
      candidatePaths: [[new Position(1, 0)]],
      selectedPathIndex: 0,
      availableActions: [ActionType.NORMAL_ATTACK],
      selectedActionType: null,
      selectableTargets: [target],
      previewCost: 1,
      inputLocked: false,
      canWait: true,
      canEndTurn: true,
      showPrimaryCommands: true,
      showTacticPanel: false,
      showFacingPanel: false
    });

    assert.equal(elements.board.children.length, 3);
    assert.equal(elements.board.children[1].classList.has("is-destination"), true);
    assert.equal(elements.board.children[2].classList.has("is-target"), true);
    assert.equal(elements.selectedUnitText.textContent.includes("actor"), true);
    assert.equal(elements.waitButton.disabled, false);
    assert.equal(elements.endTurnButton.disabled, false);
    assert.equal(createStageDigest(stage), digestBefore);
  } finally {
    restoreDocument();
  }
});

test("BattleEffectManager renders semantic results and aborts its own wait", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const elements = createFakeBattleElements();
    const renderer = new BattleRenderer(elements);
    bindNoopHandlers(renderer);
    const manager = new BattleEffectManager({
      renderer,
      durations: { [PresentationRequestType.MOVE]: 1000 }
    });
    const abortController = new AbortController();
    const request = createSemanticPresentationRequest(
      PresentationRequestType.MOVE,
      { unitId: "unit_a", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }
    );

    const pending = manager.present(request, abortController.signal);
    assert.equal(elements.eventText.textContent, "unit_a moved.");
    abortController.abort();

    await assert.rejects(pending, { name: "AbortError" });
  } finally {
    restoreDocument();
  }
});

test("BattleEffectManager completes and disposes its Battle-owned audio session", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const elements = createFakeBattleElements();
    const renderer = new BattleRenderer(elements);
    bindNoopHandlers(renderer);
    const recording = {
      completed: 0,
      disposed: 0,
      requests: [],
      present(request) {
        this.requests.push(request);
        return {
          complete: () => {
            this.completed += 1;
          }
        };
      },
      dispose() {
        this.disposed += 1;
      }
    };
    const visualRecording = {
      disposed: 0,
      requests: [],
      async present(request, abortSignal, durationOverride) {
        this.requests.push({ request, abortSignal, durationOverride });
        return true;
      },
      dispose() {
        this.disposed += 1;
      }
    };
    const manager = new BattleEffectManager({
      renderer,
      audioSession: recording,
      visualSession: visualRecording,
      durations: { [PresentationRequestType.MOVE]: 0 }
    });
    const request = createSemanticPresentationRequest(
      PresentationRequestType.MOVE,
      { unitId: "unit_a", from: { x: 0, y: 0 }, to: { x: 1, y: 0 } }
    );

    await manager.present(request, new AbortController().signal);
    manager.dispose();
    manager.dispose();
    assert.deepEqual(recording.requests, [request]);
    assert.equal(recording.completed, 1);
    assert.equal(recording.disposed, 1);
    assert.equal(visualRecording.requests.length, 1);
    assert.equal(visualRecording.requests[0].request, request);
    assert.equal(visualRecording.requests[0].durationOverride, 0);
    assert.equal(visualRecording.disposed, 1);
  } finally {
    restoreDocument();
  }
});

test("BattleRenderer exposes projectile, charge and tactic controls from ViewState", () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "renderer_commands",
      map: [["plain", "plain", "plain"]],
      units: [
        {
          id: "actor",
          army: Affiliation.PLAYER,
          position: { x: 0, y: 0 },
          abilities: [
            UnitAbility.THROW_ATTACK,
            UnitAbility.CHARGE,
            UnitAbility.CONFUSION_LEVEL_2,
            UnitAbility.FIRE_TACTIC
          ],
          maxUses: {
            [UnitUse.PROJECTILE]: 2,
            [UnitUse.CHARGE]: 3,
            [UnitUse.TACTIC]: 4
          }
        },
        { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }
      ]
    });
    const elements = createFakeBattleElements();
    const renderer = new BattleRenderer(elements);
    const selectedActions = [];
    let tacticMenuCount = 0;
    renderer.bindHandlers({
      onAction(actionType) {
        selectedActions.push(actionType);
      },
      onCell() {},
      onClear() {},
      onEndTurn() {},
      onFacing() {},
      onNextDialogue() {},
      onPath() {},
      onTacticMenu() {
        tacticMenuCount += 1;
      },
      onWait() {}
    });

    renderer.render(stage, {
      mode: "CONFUSION_LEVEL_SELECT",
      domainLabel: "Stable",
      instruction: "Choose a tactic.",
      selectedUnit: stage.getUnit("actor"),
      reachableByKey: new Map(),
      previewDestination: null,
      candidatePaths: [],
      selectedPathIndex: 0,
      availableActions: [
        ActionType.BOW_ATTACK,
        ActionType.CHARGE,
        ActionType.CONFUSION_LV1,
        ActionType.CONFUSION_LV2,
        ActionType.FIRE
      ],
      selectedActionType: null,
      selectableTargets: [],
      previewCost: 0,
      inputLocked: false,
      canWait: false,
      canEndTurn: true,
      showPrimaryCommands: true,
      showTacticPanel: true,
      showFacingPanel: false
    });

    assert.equal(elements.bowButton.textContent, "Throw 2/2");
    assert.equal(elements.chargeButton.textContent, "Charge 3/3");
    assert.equal(elements.tacticButton.textContent, "Tactic 4/4");
    assert.equal(elements.bowButton.disabled, false);
    assert.equal(elements.confusionLv2Button.disabled, false);
    assert.equal(elements.confusionLv3Button.disabled, true);
    assert.equal(elements.fireButton.disabled, false);
    assert.equal(elements.waterButton.disabled, true);
    assert.equal(elements.tacticPanel.hidden, false);

    elements.bowButton.dispatch("click");
    elements.fireButton.dispatch("click");
    elements.tacticButton.dispatch("click");
    assert.deepEqual(selectedActions, [ActionType.BOW_ATTACK, ActionType.FIRE]);
    assert.equal(tacticMenuCount, 1);
  } finally {
    restoreDocument();
  }
});

test("BattleRenderer unbinds fixed controls and rendered cells idempotently", () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createServiceStage({
      id: "renderer_unbind",
      map: [["plain"]],
      units: [
        { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } }
      ]
    });
    const elements = createFakeBattleElements();
    const renderer = new BattleRenderer(elements);
    let clearCount = 0;
    let cellCount = 0;
    renderer.bindHandlers({
      onAction() {},
      onCell() {
        cellCount += 1;
      },
      onClear() {
        clearCount += 1;
      },
      onEndTurn() {},
      onFacing() {},
      onNextDialogue() {},
      onPath() {},
      onTacticMenu() {},
      onWait() {}
    });
    renderer.render(stage, {
      mode: "UNIT_SELECT",
      domainLabel: "Stable",
      instruction: "Select a unit.",
      selectedUnit: stage.getUnit("actor"),
      reachableByKey: new Map(),
      previewDestination: null,
      candidatePaths: [],
      selectedPathIndex: 0,
      availableActions: [],
      selectedActionType: null,
      selectableTargets: [],
      previewCost: 0,
      inputLocked: false,
      canWait: false,
      canEndTurn: true,
      showPrimaryCommands: false,
      showTacticPanel: false,
      showFacingPanel: false
    });
    const oldCell = elements.board.children[0];

    elements.resetButton.dispatch("click");
    oldCell.dispatch("click");
    assert.equal(clearCount, 1);
    assert.equal(cellCount, 1);

    renderer.unbindHandlers();
    renderer.unbindHandlers();
    elements.resetButton.dispatch("click");
    oldCell.dispatch("click");
    assert.equal(clearCount, 1);
    assert.equal(cellCount, 1);
    assert.equal(elements.resetButton.listeners.has("click"), false);
    assert.equal(oldCell.listeners.has("click"), false);
  } finally {
    restoreDocument();
  }
});
