import test from "node:test";
import assert from "node:assert/strict";
import { ContinueDialog } from "../src/presentation/continue-dialog.js";
import { FakeElement } from "../test-support/fake-battle-dom.js";

function setup() {
  const host = new FakeElement(), root = new FakeElement(), button = new FakeElement();
  const board = new FakeElement(), blocked = new FakeElement(), opener = new FakeElement();
  const document = { activeElement: opener };
  host.append(board, blocked, root); root.append(button); blocked.inert = true;
  root.ownerDocument = document;
  for (const e of [button, opener]) {
    e.isConnected = true; e.tabIndex = 0; e.getClientRects = () => [{}];
    e.focus = options => { assert.equal(options.preventScroll, true); document.activeElement = e; };
  }
  root.querySelectorAll = () => [button];
  let advances = 0;
  const dialog = new ContinueDialog({ root, button, onContinue: () => advances++ });
  return { root, button, board, blocked, opener, document, dialog, count: () => advances };
}

test("read-through dialogs retain focus and require a fresh key press for each line", () => {
  const s = setup(), { root, button, dialog } = s;
  try {
    button.dispatch("click"); assert.equal(s.count(), 0, "hidden prompts cannot advance");
    dialog.show();
    assert.equal(s.document.activeElement, button); assert.equal(s.board.inert, true);
    for (const shiftKey of [false, true]) {
      assert.equal(root.dispatch("keydown", { key: "Tab", shiftKey }).defaultPrevented, true);
      assert.equal(s.document.activeElement, button);
    }
    root.dispatch("keydown", { key: "Escape" });
    assert.equal(root.hidden, false); assert.equal(s.count(), 0);
    assert.equal(button.dispatch("keydown", { key: "Enter" }).defaultPrevented, true);
    assert.equal(s.count(), 1);
    dialog.show(); // Rendering the next speech must not replace the original return focus.
    button.dispatch("keydown", { key: "Enter", repeat: true });
    button.dispatch("keydown", { key: "Enter", isComposing: true });
    button.dispatch("keydown", { key: "Enter", ctrlKey: true });
    assert.equal(s.count(), 1);
    button.dispatch("keydown", { key: " " });
    button.dispatch("keydown", { key: " ", repeat: true });
    assert.equal(s.count(), 1, "Space waits for release");
    button.dispatch("keyup", { key: " " });
    button.dispatch("keyup", { key: " " });
    assert.equal(s.count(), 2);
    button.dispatch("click"); assert.equal(s.count(), 3);
    dialog.hide();
    assert.equal(s.document.activeElement, s.opener);
    assert.equal(s.board.inert, false); assert.equal(s.blocked.inert, true);
  } finally { dialog.dispose(); }
});

test("blur, replacement and disposal cannot advance a later prompt or restore stale focus", () => {
  const s = setup(), { root, button, dialog } = s;
  dialog.show();
  button.dispatch("keydown", { key: " " }); button.dispatch("blur"); button.dispatch("keyup", { key: " " });
  assert.equal(s.count(), 0);
  button.dispatch("keydown", { key: " " }); dialog.hide({ restoreFocus: false }); dialog.show();
  button.dispatch("keyup", { key: " " }); button.dispatch("keydown", { key: "Enter", repeat: true });
  assert.equal(s.count(), 0, "the new prompt requires a fresh press");
  button.disabled = true; root.dispatch("keydown", { key: "Enter" }); assert.equal(s.count(), 0);
  button.disabled = false;
  button.dispatch("keydown", { key: " " }); dialog.dispose();
  button.dispatch("keyup", { key: " " }); button.dispatch("click"); dialog.show(); dialog.dispose();
  assert.equal(root.hidden, true); assert.equal(s.count(), 0);
  assert.equal(s.document.activeElement, button, "no focus restoration into a disposed battle");
  assert.equal(s.board.inert, false); assert.equal(s.blocked.inert, true);
  assert.equal(root.listeners.size, 0); assert.equal(button.listeners.size, 0);
});

test("an intro shown under a hidden battle host gains focus when the shell reveals it", () => {
  const s = setup(), { root, button, dialog } = s;
  let hostHidden = true;
  root.isConnected = false;
  root.closest = () => hostHidden ? {} : null;
  try {
    dialog.show();
    root.isConnected = true; dialog.refreshFocus();
    assert.equal(s.document.activeElement, s.opener);
    assert.notEqual(s.board.inert, true, "the inactive view must not block its siblings yet");
    hostHidden = false; dialog.refreshFocus();
    assert.equal(s.document.activeElement, button); assert.equal(s.board.inert, true);
    dialog.refreshFocus(); dialog.hide();
    assert.equal(s.document.activeElement, s.opener);
    assert.equal(s.board.inert, false);
  } finally { dialog.dispose(); }
});
