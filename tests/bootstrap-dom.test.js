import test from "node:test";
import assert from "node:assert/strict";

import { SAVE_STORAGE_PREFIX } from "../src/config/version.js";
import {
  FakeElement,
  createFakeBattleViewTemplate,
  createFakePersistenceElements
} from "../test-support/fake-battle-dom.js";
import { MemoryStorage } from "../test-support/memory-storage.js";
import {
  FakeAudioContext,
  createFakeAudioFetcher
} from "../test-support/fake-audio.js";

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`WAIT_TIMEOUT_${label}`);
}

test("bootstrap starts, saves manually, and swaps the Battle DOM without touching v9", async () => {
  const { template, createdViews } = createFakeBattleViewTemplate();
  const battleHost = new FakeElement();
  const persistence = createFakePersistenceElements();
  const elementsBySelector = new Map([
    ["#battleHost", battleHost],
    ["#battleViewTemplate", template],
    ...Object.entries(persistence).map(([key, element]) => [`#${key}`, element])
  ]);
  const previousDocument = globalThis.document;
  const previousLocalStorage = globalThis.localStorage;
  const previousConfirm = globalThis.confirm;
  const previousAudioContext = globalThis.AudioContext;
  const previousFetch = globalThis.fetch;
  const storage = new MemoryStorage({ senki_suikoden_save_v2: "v9-untouched" });
  globalThis.document = {
    createElement() {
      return new FakeElement();
    },
    querySelector(selector) {
      return elementsBySelector.get(selector) ?? null;
    }
  };
  globalThis.localStorage = storage;
  globalThis.confirm = () => true;
  globalThis.AudioContext = FakeAudioContext;
  globalThis.fetch = createFakeAudioFetcher();

  try {
    await import(`../src/app/bootstrap.js?dom-test=${Date.now()}`);
    assert.equal(createdViews.length, 1);
    const firstView = createdViews[0];
    const { elements } = firstView;
    assert.equal(battleHost.children[0], firstView.root);
    assert.equal(elements.board.children.length, 35);
    assert.equal(elements.modeValue.textContent, "LOCKED");
    assert.equal(elements.dialogueOverlay.hidden, false);
    assert.equal(persistence.manualSlotList.children.length, 20);
    assert.equal(persistence.audioButton.textContent, "Sound: Start");

    persistence.audioButton.dispatch("click");
    await waitUntil(
      () => persistence.audioButton.textContent === "Sound: ON",
      "AUDIO_UNLOCKED"
    );
    assert.equal(persistence.audioButton.attributes.get("aria-pressed"), "true");

    elements.dialogueNextButton.dispatch("click");
    await waitUntil(
      () => elements.modeValue.textContent === "UNIT_SELECT",
      "BATTLE_READY"
    );
    await waitUntil(
      () => storage.getItem(`${SAVE_STORAGE_PREFIX}slot:recovery:primary`) !== null,
      "RECOVERY_SAVE"
    );
    await waitUntil(
      () => persistence.manualSlotList.children[0].children[2].children[0].disabled === false,
      "MANUAL_SAVE_ENABLED"
    );
    assert.equal(elements.domainValue.textContent, "Stable");
    assert.equal(storage.getItem("senki_suikoden_save_v2"), "v9-untouched");

    const firstSlotActions = persistence.manualSlotList.children[0].children[2];
    firstSlotActions.children[0].dispatch("click");
    const manualPrimaryKey = `${SAVE_STORAGE_PREFIX}slot:manual_01:primary`;
    const manualTemporaryKey = `${SAVE_STORAGE_PREFIX}slot:manual_01:temporary`;
    const savedRaw = storage.getItem(manualPrimaryKey);
    assert.notEqual(savedRaw, null);

    storage.setItem(manualTemporaryKey, savedRaw);
    storage.removeItem(manualPrimaryKey);
    persistence.refreshSlotsButton.dispatch("click");
    const fallbackSlotActions = persistence.manualSlotList.children[0].children[2];
    assert.equal(fallbackSlotActions.children[3].textContent, "Repair");
    fallbackSlotActions.children[3].dispatch("click");
    assert.equal(storage.getItem(manualPrimaryKey), savedRaw);
    assert.equal(storage.getItem(manualTemporaryKey), null);

    const refreshedSlotActions = persistence.manualSlotList.children[0].children[2];
    refreshedSlotActions.children[1].dispatch("click");
    await waitUntil(() => createdViews.length === 2, "SESSION_SWAP");
    const secondView = createdViews[1];
    await waitUntil(
      () => secondView.elements.modeValue.textContent === "UNIT_SELECT",
      "LOADED_BATTLE_READY"
    );

    assert.equal(battleHost.children[0], secondView.root);
    assert.equal(firstView.root.parentNode, null);
    assert.equal(firstView.elements.resetButton.listeners.has("click"), false);
    assert.equal(firstView.elements.board.children[0].listeners.has("click"), false);
    assert.equal(storage.getItem("senki_suikoden_save_v2"), "v9-untouched");
  } finally {
    globalThis.document = previousDocument;
    if (previousLocalStorage === undefined) {
      delete globalThis.localStorage;
    } else {
      globalThis.localStorage = previousLocalStorage;
    }
    if (previousConfirm === undefined) {
      delete globalThis.confirm;
    } else {
      globalThis.confirm = previousConfirm;
    }
    if (previousAudioContext === undefined) {
      delete globalThis.AudioContext;
    } else {
      globalThis.AudioContext = previousAudioContext;
    }
    if (previousFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = previousFetch;
    }
  }
});
