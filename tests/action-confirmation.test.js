import test from "node:test";
import assert from "node:assert/strict";
import { ActionConfirmation } from "../src/presentation/action-confirmation.js";
import { FakeElement } from "../test-support/fake-battle-dom.js";

test("save confirmation isolates its parent screens, handles Escape, abort and disposal without an action", async () => {
  const elements = Object.fromEntries(["actionConfirmationOverlay", "actionConfirmationMessage", "cancelActionButton", "confirmActionButton"].map(id => [id, new FakeElement()]));
  const { actionConfirmationOverlay: root, cancelActionButton: cancel, confirmActionButton: confirm } = elements;
  const body = new FakeElement(), slots = new FakeElement(), battle = new FakeElement(), opener = new FakeElement();
  body.append(slots, battle, root); battle.inert = true;
  const document = { activeElement: opener }; root.ownerDocument = document;
  root.querySelectorAll = () => [cancel, confirm];
  for (const element of [cancel, confirm, opener]) {
    element.tabIndex = 0; element.isConnected = true; element.getClientRects = () => [{}];
    element.focus = () => { document.activeElement = element; };
  }
  const view = new ActionConfirmation(elements);
  try {
    let result = view.ask("セーブ 1 を上書きしますか？", { confirmLabel: "上書き" });
    assert.equal(root.hidden, false); assert.equal(slots.inert, true); assert.equal(battle.inert, true);
    assert.equal(document.activeElement, cancel); assert.equal(confirm.textContent, "上書き");
    assert.equal(await view.ask("second"), false);
    root.dispatch("keydown", { key: "Tab", shiftKey: true }); assert.equal(document.activeElement, confirm);
    root.dispatch("keydown", { key: "Tab" }); assert.equal(document.activeElement, cancel);
    root.dispatch("keydown", { key: "Escape", repeat: true }); assert.equal(root.hidden, false);
    root.dispatch("keydown", { key: "Escape" }); assert.equal(await result, false);
    assert.equal(slots.inert, false); assert.equal(battle.inert, true); assert.equal(document.activeElement, opener);
    const abort = new AbortController(); result = view.ask("load", { signal: abort.signal });
    abort.abort(); assert.equal(await result, false); confirm.dispatch("click");
    assert.equal(root.hidden, true);
    result = view.ask("load"); confirm.dispatch("click"); confirm.dispatch("click");
    assert.equal(await result, true);
    result = view.ask("delete"); view.dispose(); assert.equal(await result, false);
    assert.equal(slots.inert, false); assert.equal(battle.inert, true);
    assert.equal(document.activeElement, cancel, "disposal does not return to old controls");
    assert.equal(root.listeners.size, 0); assert.equal(confirm.listeners.size, 0);
  } finally { view.dispose(); }
});
