import test from "node:test";
import assert from "node:assert/strict";

import { TitleScreen } from "../src/presentation/title-screen.js";
import { createFakeTitleElements } from "../test-support/fake-battle-dom.js";

const SHORT_TIMING = Object.freeze({
  WHITEOUT_AUDIO_MS: 0,
  TITLE_THEME_MS: 0,
  READY_MS: 20,
  EXIT_MS: 0
});

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 1));
  }
  throw new Error(`WAIT_TIMEOUT_${label}`);
}

test("TitleScreen requires one interaction for the intro and a fresh one after ready", async () => {
  const elements = createFakeTitleElements();
  const calls = [];
  const screen = new TitleScreen({
    elements,
    timing: SHORT_TIMING,
    onPrepare: () => calls.push("prepare"),
    onThunder: () => calls.push("thunder"),
    onWhiteout: () => calls.push("whiteout"),
    onTitleTheme: () => calls.push("theme"),
    onStart: () => calls.push("start")
  });
  screen.start();

  assert.equal(elements.root.classList.has("active"), true);
  assert.equal(elements.logo.src.endsWith("/title-logo.png"), true);
  elements.root.dispatch("click");
  await waitUntil(() => elements.root.classList.has("intro"), "TITLE_INTRO");
  elements.root.dispatch("click");
  assert.equal(calls.includes("start"), false);
  await waitUntil(() => screen.isReady, "TITLE_READY");
  assert.deepEqual(calls.slice(0, 4), ["prepare", "thunder", "whiteout", "theme"]);
  assert.equal(elements.prompt.attributes.get("aria-hidden"), "false");

  elements.root.dispatch("keydown", { key: "Enter", repeat: true });
  assert.equal(calls.includes("start"), false);
  elements.root.dispatch("keydown", { key: "Enter", repeat: false });
  await waitUntil(() => calls.includes("start"), "TITLE_START");
  assert.equal(elements.root.hidden, true);
  assert.equal(screen.isClosed, true);
  screen.dispose();
});

test("disposing TitleScreen cancels pending callbacks and removes input listeners", async () => {
  const elements = createFakeTitleElements();
  let starts = 0;
  const screen = new TitleScreen({
    elements,
    timing: {
      WHITEOUT_AUDIO_MS: 100,
      TITLE_THEME_MS: 100,
      READY_MS: 100,
      EXIT_MS: 100
    },
    onStart: () => {
      starts += 1;
    }
  });
  screen.start();
  elements.root.dispatch("click");
  screen.dispose();
  await new Promise((resolve) => setTimeout(resolve, 120));
  assert.equal(starts, 0);
  assert.equal(elements.root.listeners.has("click"), false);
  assert.equal(elements.root.listeners.has("keydown"), false);
});

test("pending audio preparation cannot block the title or replay it when preparation settles late", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const discard of [false, true]) {
    const elements = createFakeTitleElements(), calls = [];
    let finishPrepare;
    const screen = new TitleScreen({ elements, timing: SHORT_TIMING,
      onPrepare: () => new Promise(resolve => { finishPrepare = resolve; }),
      onThunder: () => calls.push("thunder"), onTitleTheme: () => calls.push("theme"),
      onStart: () => calls.push("start") });
    try {
      screen.start(); elements.root.dispatch("click");
      elements.root.dispatch("click");
      if (discard) screen.dispose();
      t.mock.timers.tick(1000); t.mock.timers.tick(20);
      assert.equal(screen.isReady, !discard);
      if (!discard) {
        elements.root.dispatch("click"); t.mock.timers.tick(1);
        assert.equal(elements.root.hidden, true);
      }
      assert.deepEqual(calls, discard ? [] : ["start"]);
      finishPrepare(true); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
      t.mock.timers.tick(2000);
      assert.deepEqual(calls, discard ? [] : ["start"]);
    } finally { screen.dispose(); }
  }
  t.mock.timers.reset();
});
