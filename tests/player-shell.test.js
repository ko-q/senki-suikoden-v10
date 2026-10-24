import test from "node:test";
import assert from "node:assert/strict";
import { PlayerShell } from "../src/presentation/player-shell.js";
import { FakeElement, installFakeDocument } from "../test-support/fake-battle-dom.js";

test("V9 information opens by tap, closes on text taps, preserves action buttons and rejects inactive battles", () => {
  const restore = installFakeDocument();
  const elements = Object.fromEntries(["stageSelectOverlay", "stageList", "stageSelectLoadButton", "closeSaveSlotsButton", "saveSlotOverlay",
    "closeBattleInfoButton", "battleInfoOverlay", "openSaveButton", "openLoadButton", "returnStageSelectButton", "battleInfoTitle",
    "battleInfoBody", "stageInfoActions", "persistenceTitle"].map((id) => [id, new FakeElement()]));
  const buttons = Object.fromEntries(["stageInfoButton", "battleStatusButton", "strategyGuideButton"].map((id) => [id, new FakeElement()]));
  elements.battleHost = new FakeElement({ selectorMap: new Map(Object.entries(buttons).map(([id, element]) => [`#${id}`, element])) });
  let raidComplete = false;
  const stage = { id: "first", phase: "PLAYER", turn: 1, eventManager: { isCompleted: () => raidComplete }, battleLog: { getEntries: () => [{ text: "味方ターン 1" }] } };
  const controller = { isDisposed: false, flowState: "IDLE", isStableForSave: () => true, getBattleResult: () => null };
  const session = { stage, controller, screen: { refresh() {} } };
  let refreshes = 0;
  const shell = new PlayerShell({ elements, game: { refreshManualSlots() { refreshes++; } },
    stages: [{ id: "first", title: "第一章", description: "章説明", objectiveText: "勝利：護送隊殲滅<br>敗北：期限超過", raid: { turnLimit: 5, escapeObjective: "勝利：晁蓋が北端の旗へ到達<br>敗北：晁蓋が敗走" }, turnLimit: 15 }] });
  try {
    shell.attachSession(session);
    buttons.stageInfoButton.dispatch("pointerdown"); assert.equal(elements.battleInfoOverlay.hidden, true);
    buttons.stageInfoButton.dispatch("click"); assert.equal(elements.battleInfoOverlay.hidden, false);
    assert.match(elements.battleInfoBody.textContent, /護送隊殲滅/);
    assert.match(elements.battleInfoBody.textContent, /護送部隊殲滅まで残り5ターン/);
    assert.equal(buttons.stageInfoButton.attributes.get("aria-expanded"), "true");
    elements.battleInfoOverlay.dispatch("click", { target: { closest: () => elements.openSaveButton } });
    assert.equal(elements.battleInfoOverlay.hidden, false);
    elements.battleInfoOverlay.dispatch("click", { target: elements.battleInfoBody });
    assert.equal(elements.battleInfoOverlay.hidden, true);
    assert.equal(buttons.stageInfoButton.attributes.get("aria-expanded"), "false");
    buttons.stageInfoButton.dispatch("click"); elements.openSaveButton.dispatch("click");
    assert.equal(elements.battleInfoOverlay.hidden, true); assert.equal(elements.saveSlotOverlay.hidden, false); assert.equal(refreshes, 1);
    shell.attachSession(session); stage.phase = "ENEMY";
    buttons.battleStatusButton.dispatch("click"); assert.equal(elements.battleInfoOverlay.hidden, true);
    stage.phase = "PLAYER"; controller.flowState = "TURN_TRANSITION";
    buttons.battleStatusButton.dispatch("click"); assert.equal(elements.battleInfoOverlay.hidden, true);
    controller.flowState = "IDLE"; buttons.battleStatusButton.dispatch("click");
    assert.equal(elements.battleInfoBody.textContent, "味方ターン 1");
    raidComplete = true; shell.attachSession(session); buttons.stageInfoButton.dispatch("click");
    assert.match(elements.battleInfoBody.textContent, /晁蓋が北端の旗へ到達/);
    assert.doesNotMatch(elements.battleInfoBody.textContent, /期限超過/);
    assert.doesNotMatch(elements.battleInfoBody.textContent, /護送部隊殲滅まで残り/);
    raidComplete = false; stage.turn = 5; shell.attachSession(session); buttons.stageInfoButton.dispatch("click");
    assert.match(elements.battleInfoBody.textContent, /期限超過/);
    assert.match(elements.battleInfoBody.textContent, /護送部隊殲滅まで残り1ターン/);
    shell.dispose(); assert.equal(elements.battleInfoOverlay.hidden, true);
    assert.equal(buttons.battleStatusButton.listeners.size, 0);
  } finally { shell.dispose(); restore(); }
});
