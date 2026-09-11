import test from "node:test";
import assert from "node:assert/strict";

import { ActionType } from "../src/core/action-request.js";
import {
  PresentationRequestType,
  createSemanticPresentationRequest
} from "../src/core/presentation-request.js";
import { Affiliation } from "../src/domain/army.js";
import { UnitStatus } from "../src/domain/unit.js";
import {
  BattleVisualEffectSession,
  V9_BATTLE_VISUAL_TIMING
} from "../src/presentation/battle-visual-effects.js";
import {
  FakeElement,
  installFakeDocument
} from "../test-support/fake-battle-dom.js";
import { createServiceStage } from "../test-support/service-fixtures.js";

function createStage() {
  return createServiceStage({
    id: "visual_effects",
    map: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"]
    ],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 1 } },
      { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 1 } }
    ]
  });
}

function createRuntime(stage) {
  const board = new FakeElement();
  const effectLayer = new FakeElement();
  for (let y = 0; y < stage.map.height; y += 1) {
    for (let x = 0; x < stage.map.width; x += 1) {
      const domainCell = stage.map.getCellAt(x, y);
      const cell = new FakeElement();
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      cell.offsetLeft = x * 48;
      cell.offsetTop = y * 48;
      if (domainCell.occupant !== null) {
        const token = new FakeElement();
        token.className = "unit-token";
        token.classList.add("unit-token");
        token.dataset.unitId = domainCell.occupant.id;
        cell.append(token);
      }
      board.append(cell);
    }
  }
  return {
    board,
    effectLayer,
    session: new BattleVisualEffectSession({ stage, board, effectLayer })
  };
}

function actionRequest(actionType, overrides = {}) {
  return createSemanticPresentationRequest(PresentationRequestType.ACTION, {
    actionType,
    actorId: "actor",
    targetId: "target",
    actorPosition: { x: 0, y: 1 },
    targetPosition: { x: 2, y: 1 },
    actorAffiliation: Affiliation.PLAYER,
    actorIsMob: false,
    forced: false,
    ...overrides
  });
}

test("movement uses a detached token and abort removes every visual", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const stage = createStage();
    const actor = stage.getUnit("actor");
    stage.map.moveUnit(actor, { x: 1, y: 1 });
    const runtime = createRuntime(stage);
    const abortController = new AbortController();
    const pending = runtime.session.present(createSemanticPresentationRequest(
      PresentationRequestType.MOVE,
      { unitId: "actor", from: { x: 0, y: 1 }, to: { x: 1, y: 1 } }
    ), abortController.signal, 1000);

    assert.equal(runtime.effectLayer.children.length, 1);
    assert.equal(
      runtime.effectLayer.children[0].classList.contains("battle-effect-unit-move"),
      true
    );
    abortController.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(runtime.effectLayer.children.length, 0);
  } finally {
    restoreDocument();
  }
});

test("charge returns at impact while its v9 dust remains Battle-owned", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const runtime = createRuntime(createStage());
    await runtime.session.present(
      actionRequest(ActionType.CHARGE, { actorIsMob: true }),
      new AbortController().signal
    );

    assert.equal(V9_BATTLE_VISUAL_TIMING.CHARGE_IMPACT_MOB_MS, 160);
    assert.equal(runtime.effectLayer.children.length, 1);
    assert.equal(runtime.effectLayer.children[0].className, "charge-dust-effect");
    runtime.session.dispose();
    assert.equal(runtime.effectLayer.children.length, 0);
  } finally {
    restoreDocument();
  }
});

test("projectile action launches four independently timed v9 arrow lines", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const runtime = createRuntime(createStage());
    const abortController = new AbortController();
    const pending = runtime.session.present(
      actionRequest(ActionType.BOW_ATTACK),
      abortController.signal
    );

    assert.equal(runtime.effectLayer.children.length, 4);
    assert.deepEqual(
      runtime.effectLayer.children.map((line) => line.style.animationDelay),
      ["0ms", "153ms", "250ms", "320ms"]
    );
    assert.equal(
      runtime.effectLayer.children.every((line) => line.className === "bow-shot-line"),
      true
    );
    abortController.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(runtime.effectLayer.children.length, 0);
  } finally {
    restoreDocument();
  }
});

test("elemental and wide illusion casts render their dedicated v9 overlays", async () => {
  const restoreDocument = installFakeDocument();
  try {
    for (const actionType of [ActionType.FIRE, ActionType.WATER, ActionType.WIDE_ILLUSION]) {
      const runtime = createRuntime(createStage());
      const abortController = new AbortController();
      const request = actionType === ActionType.WIDE_ILLUSION
        ? actionRequest(actionType, {
          targetId: "actor",
          targetPosition: { x: 0, y: 1 }
        })
        : actionRequest(actionType);
      const pending = runtime.session.present(request, abortController.signal, 1000);
      const classNames = runtime.effectLayer.children.map((element) => element.className);
      const expectedClass = actionType === ActionType.FIRE
        ? "fire-tactic-burst-effect"
        : actionType === ActionType.WATER
          ? "water-tactic-burst-effect"
          : "wide-illusion-overlay";
      assert.equal(classNames.includes(expectedClass), true, actionType);
      assert.equal(classNames.includes("strategy-cast-cell-flash"), true, actionType);
      abortController.abort();
      await assert.rejects(pending, { name: "AbortError" });
      assert.equal(runtime.effectLayer.children.length, 0);
    }
  } finally {
    restoreDocument();
  }
});

test("two-turn confusion shows the alert symbol and repeats the unit flash", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const runtime = createRuntime(createStage());
    const abortController = new AbortController();
    const pending = runtime.session.present(createSemanticPresentationRequest(
      PresentationRequestType.STATUS,
      {
        reason: ActionType.CONFUSION_LV1,
        entries: [{
          unitId: "target",
          position: { x: 2, y: 1 },
          before: [],
          after: [{ type: UnitStatus.CONFUSED, remainingTurns: 2 }],
          effectTurns: 2
        }]
      }
    ), abortController.signal, 1000);

    const flash = runtime.effectLayer.children.find((element) => (
      element.classList.contains("battle-effect-unit-confusion")
    ));
    const symbol = runtime.effectLayer.children.find((element) => (
      element.className === "confusion-symbol-effect"
    ));
    assert.notEqual(flash, undefined);
    assert.equal(flash.style.animationIterationCount, "2");
    assert.equal(symbol.src.endsWith("/confusion-alert.webp"), true);
    abortController.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(runtime.effectLayer.children.length, 0);
  } finally {
    restoreDocument();
  }
});

test("normal illusion adds its skull while wide illusion keeps the overlay-only rule", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const runtime = createRuntime(createStage());
    const abortController = new AbortController();
    const pending = runtime.session.present(createSemanticPresentationRequest(
      PresentationRequestType.STATUS,
      {
        reason: ActionType.ILLUSION,
        entries: [{
          unitId: "target",
          position: { x: 2, y: 1 },
          before: [],
          after: [{ type: UnitStatus.ILLUSION, remainingTurns: 1 }],
          effectTurns: 1
        }]
      }
    ), abortController.signal, 1000);

    const skull = runtime.effectLayer.children.find((element) => (
      element.className === "normal-illusion-skull-effect"
    ));
    assert.notEqual(skull, undefined);
    assert.equal(skull.src.endsWith("/normal-illusion-skull.webp"), true);
    abortController.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(runtime.effectLayer.children.length, 0);
  } finally {
    restoreDocument();
  }
});

test("damage presentation combines the popup with operation-specific glow", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const runtime = createRuntime(createStage());
    const abortController = new AbortController();
    const pending = runtime.session.present(createSemanticPresentationRequest(
      PresentationRequestType.DAMAGE,
      {
        operationType: ActionType.FIRE,
        actorId: "actor",
        entries: [{
          unitId: "target",
          position: { x: 2, y: 1 },
          damage: 37,
          beforeTroops: 100,
          afterTroops: 63,
          defeated: false
        }]
      }
    ), abortController.signal, 1000);

    assert.equal(
      runtime.effectLayer.children.some((element) => element.textContent === "37"),
      true
    );
    assert.equal(
      runtime.effectLayer.children.some((element) => (
        element.classList.contains("battle-effect-unit-fire")
      )),
      true
    );
    abortController.abort();
    await assert.rejects(pending, { name: "AbortError" });
    assert.equal(runtime.effectLayer.children.length, 0);
  } finally {
    restoreDocument();
  }
});
