import test from "node:test";
import assert from "node:assert/strict";
import { TurnEndConfirmation } from "../src/presentation/turn-end-confirmation.js";
import { FakeElement, createFakeBattleElements } from "../test-support/fake-battle-dom.js";

test("turn confirmation isolates the battle, traps focus, restores it on cancel and cleans up on disposal", () => {
  const elements = createFakeBattleElements(), root = new FakeElement(), background = new FakeElement();
  const { turnEndOverlay, cancelTurnEndButton, confirmTurnEndButton, endTurnButton } = elements;
  root.append(background, turnEndOverlay);
  turnEndOverlay.append(cancelTurnEndButton, confirmTurnEndButton);
  const document = { activeElement: endTurnButton };
  endTurnButton.isConnected = true;
  for (const button of [cancelTurnEndButton, confirmTurnEndButton, endTurnButton]) {
    button.tabIndex = 0;
    button.getClientRects = () => [{}];
    button.focus = () => { document.activeElement = button; };
  }
  turnEndOverlay.ownerDocument = document;
  turnEndOverlay.querySelectorAll = () => [cancelTurnEndButton, confirmTurnEndButton];
  const answers = [];
  const view = new TurnEndConfirmation(elements, answer => { answers.push(answer); view.render(null); });
  try {
    view.render(["林冲", "魯智深"]);
    assert.equal(background.inert, true);
    assert.equal(document.activeElement, cancelTurnEndButton);
    turnEndOverlay.dispatch("keydown", { key: "Tab", shiftKey: true });
    assert.equal(document.activeElement, confirmTurnEndButton);
    turnEndOverlay.dispatch("keydown", { key: "Tab" });
    assert.equal(document.activeElement, cancelTurnEndButton);
    turnEndOverlay.dispatch("keydown", { key: "Escape" });
    assert.deepEqual(answers, [false]);
    assert.equal(turnEndOverlay.hidden, true);
    assert.equal(background.inert, false);
    assert.equal(document.activeElement, endTurnButton);
    // Preserve an existing inert state rather than indiscriminately enabling it.
    background.inert = true;
    view.render(["林冲"]); view.dispose();
    assert.equal(background.inert, true);
    assert.equal(turnEndOverlay.hidden, true);
    confirmTurnEndButton.dispatch("click");
    assert.deepEqual(answers, [false]);
  } finally { view.dispose(); }
});
