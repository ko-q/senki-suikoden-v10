import test from "node:test";
import assert from "node:assert/strict";
import { BattleKeyboardControls } from "../src/presentation/battle-keyboard-controls.js";
import { ModalFocus } from "../src/presentation/modal-focus.js";
import { MovePreviewState } from "../src/presentation/move-preview-state.js";
import { Position } from "../src/domain/position.js";
import { FakeElement } from "../test-support/fake-battle-dom.js";

test("keyboard input attaches to the live document even when the view was cloned from a template", () => {
  const previous = globalThis.document;
  const document = new FakeElement(), templateDocument = new FakeElement(), root = new FakeElement();
  root.ownerDocument = templateDocument;
  root.isConnected = false;
  globalThis.document = document;
  let calls = 0;
  const controls = new BattleKeyboardControls({ root, canGoBack: () => true, onBack: () => calls++ });
  try {
    document.dispatch("keydown", { key: "Escape" });
    assert.equal(calls, 0, "prepared replacement views must stay inactive");
    root.ownerDocument = document; root.isConnected = true;
    document.dispatch("keydown", { key: "Escape" });
    assert.equal(calls, 1);
    assert.equal(templateDocument.listeners.size, 0);
  } finally { controls.dispose(); globalThis.document = previous; }
  assert.equal(document.listeners.size, 0);
});

test("Escape cancels only the active unlocked battle and ignores repeats, editors and handled dialogs", () => {
  const root = new FakeElement(), target = new FakeElement();
  let enabled = true, calls = 0, blocked = false;
  root.closest = () => blocked ? {} : null;
  const keys = new BattleKeyboardControls({ root, target, canGoBack: () => enabled, onBack: () => calls++ });
  try {
    assert.equal(target.dispatch("keydown", { key: "Escape" }).defaultPrevented, true);
    assert.equal(calls, 1);
    for (const extra of [{ repeat: true }, { isComposing: true }, { defaultPrevented: true },
      { altKey: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true },
      { target: { isContentEditable: true } }, { target: { closest: () => ({}) } }]) {
      target.dispatch("keydown", { key: "Escape", ...extra });
    }
    enabled = false; target.dispatch("keydown", { key: "Escape" });
    enabled = true; blocked = true; target.dispatch("keydown", { key: "Escape" });
    blocked = false; root.isConnected = false; target.dispatch("keydown", { key: "Escape" });
    assert.equal(calls, 1);
    root.isConnected = true; target.dispatch("keydown", { key: "Enter" });
    assert.equal(calls, 1, "shortcuts never commit an action");
    target.dispatch("keydown", { key: "Escape" });
    assert.equal(calls, 2);
  } finally { keys.dispose(); }
  target.dispatch("keydown", { key: "Escape" });
  assert.equal(calls, 2, "disposed sessions cannot receive keyboard commands");
  assert.equal(target.listeners.size, 0);
});

test("information dialogs trap Tab, retain background inert state and restore focus without scrolling", () => {
  const root = new FakeElement(), close = new FakeElement(), action = new FakeElement();
  const hidden = new FakeElement(), disabled = new FakeElement(), offscreen = new FakeElement();
  const opener = new FakeElement(), battle = new FakeElement(), menu = new FakeElement();
  const document = { activeElement: opener };
  root.ownerDocument = document;
  for (const element of [close, action, hidden, disabled, offscreen, opener]) {
    element.isConnected = true; element.tabIndex = 0;
    element.getClientRects = () => [{}];
    element.closest = () => null;
    element.focus = (options) => { document.activeElement = element; assert.equal(options.preventScroll, true); };
  }
  hidden.closest = () => ({}); disabled.disabled = true; offscreen.getClientRects = () => [];
  root.querySelectorAll = () => [action, hidden, disabled, offscreen, close];
  battle.inert = false; menu.inert = true;
  let closed = 0;
  const modal = new ModalFocus({ root, initialFocus: close, blockedRoots: [battle, menu],
    onEscape: () => { closed++; modal.deactivate(); } });
  try {
    modal.activate();
    assert.equal(document.activeElement, close);
    assert.equal(battle.inert, true);
    root.dispatch("keydown", { key: "Tab" }); assert.equal(document.activeElement, action);
    root.dispatch("keydown", { key: "Tab", shiftKey: true }); assert.equal(document.activeElement, close);
    document.activeElement = opener;
    root.dispatch("keydown", { key: "Tab" }); assert.equal(document.activeElement, action);
    root.dispatch("keydown", { key: "Escape", repeat: true }); assert.equal(closed, 0);
    const event = root.dispatch("keydown", { key: "Escape" });
    assert.equal(event.defaultPrevented, true);
    assert.equal(closed, 1); assert.equal(document.activeElement, opener);
    assert.equal(battle.inert, false); assert.equal(menu.inert, true);
    modal.activate(opener); opener.isConnected = false;
    modal.deactivate(); assert.equal(document.activeElement, close, "a replaced session cannot receive focus");
    modal.activate();
  } finally { modal.dispose(); }
  assert.equal(battle.inert, false); assert.equal(menu.inert, true);
  assert.equal(root.listeners.size, 0);
});

test("movement previews own their path snapshots, reset path choice and release all preview data on cancel", () => {
  const preview = new MovePreviewState();
  const destination = new Position(1, 1), paths = [[new Position(1, 0), destination], [new Position(0, 1), destination]];
  preview.set(destination, paths);
  paths[0].pop(); paths.pop();
  assert.equal(preview.paths.length, 2); assert.equal(preview.path.length, 2);
  assert.throws(() => preview.paths[0].pop(), TypeError);
  preview.nextPath(); assert.equal(preview.index, 1); assert.equal(preview.path[0].toKey(), "0,1");
  preview.nextPath(); assert.equal(preview.index, 0);
  preview.nextPath(); preview.set(destination, [[destination]]);
  assert.equal(preview.index, 0);
  preview.nextPath(); assert.equal(preview.index, 0);
  preview.clear(); preview.nextPath();
  assert.equal(preview.destination, null); assert.equal(preview.index, 0);
  assert.deepEqual(preview.paths, []); assert.deepEqual(preview.path, []);
});
