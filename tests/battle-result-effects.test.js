import test from "node:test";
import assert from "node:assert/strict";

import { BattleOutcome } from "../src/core/battle-result.js";
import {
  PresentationRequestType,
  createSemanticPresentationRequest
} from "../src/core/presentation-request.js";
import { BattleResultEffectSession } from "../src/presentation/battle-result-effects.js";
import { FakeElement, installFakeDocument } from "../test-support/fake-battle-dom.js";

function request(outcome) {
  return createSemanticPresentationRequest(PresentationRequestType.BATTLE_RESULT, {
    stageId: "result_test",
    outcome,
    objectiveId: "result_objective",
    turn: 3,
    phase: "PLAYER"
  });
}

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`WAIT_TIMEOUT_${label}`);
}

test("victory waits for all v9 layers and then requires a fresh tap", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const layer = new FakeElement();
    const session = new BattleResultEffectSession({
      layer,
      timing: {
        ARMY_FADE_MS: 4,
        TITLE_FADE_MS: 4,
        RAYS_FADE_MS: 4,
        EXIT_MS: 0
      }
    });
    const pending = session.present(request(BattleOutcome.VICTORY), new AbortController().signal);
    const root = layer.children[0];
    assert.notEqual(root, undefined);
    assert.equal(root.children.length, 5);
    root.dispatch("click");
    await waitUntil(() => root.classList.has("is-ready"), "VICTORY_READY");
    assert.equal(root.classList.has("is-rays-visible"), true);
    root.dispatch("click");
    assert.equal(await pending, true);
    assert.equal(layer.hidden, true);
    assert.equal(layer.children.length, 0);
  } finally {
    restoreDocument();
  }
});

test("defeat ignores repeated keys and abort removes the active full-screen effect", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const layer = new FakeElement();
    const session = new BattleResultEffectSession({
      layer,
      timing: {
        ARMY_FADE_MS: 0,
        TITLE_FADE_MS: 0,
        RAYS_FADE_MS: 0,
        EXIT_MS: 0
      }
    });
    const pending = session.present(request(BattleOutcome.DEFEAT), new AbortController().signal);
    const root = layer.children[0];
    await waitUntil(() => root.classList.has("is-ready"), "DEFEAT_READY");
    root.dispatch("keydown", { key: " ", repeat: true });
    assert.equal(layer.hidden, false);
    root.dispatch("keydown", { key: " ", repeat: false });
    assert.equal(await pending, true);
    assert.equal(layer.hidden, true);

    const abortController = new AbortController();
    const blockingSession = new BattleResultEffectSession({ layer });
    const blocked = blockingSession.present(request(BattleOutcome.VICTORY), abortController.signal);
    abortController.abort();
    await assert.rejects(blocked, { name: "AbortError" });
    assert.equal(layer.children.length, 0);
    blockingSession.dispose();
  } finally {
    restoreDocument();
  }
});

test("a duration override auto-completes result effects for deterministic integration tests", async () => {
  const restoreDocument = installFakeDocument();
  try {
    const layer = new FakeElement();
    const session = new BattleResultEffectSession({ layer });
    assert.equal(
      await session.present(request(BattleOutcome.VICTORY), new AbortController().signal, 0),
      true
    );
    assert.equal(layer.hidden, true);
  } finally {
    restoreDocument();
  }
});
