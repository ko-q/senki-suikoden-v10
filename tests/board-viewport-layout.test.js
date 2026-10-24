import test from "node:test";
import assert from "node:assert/strict";
import { BoardViewportLayout } from "../src/presentation/board-viewport-layout.js";

test("board spacer follows controls, preserves scrolled rows and releases its observer", () => {
  const boardScroll = { style: {}, scrollTop: 0, scrollHeight: 1600, clientHeight: 600, getBoundingClientRect: () => ({ top: 50 }) };
  const boardTopSpacer = { style: {} };
  const battleToolbar = { hidden: false, getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 106 }) };
  const commandDock = { hidden: true, style: {}, getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 50 + Number.parseFloat(commandDock.style.top) + 180 }) };
  let observed = [], disconnected = false, notify;
  class Observer { constructor(callback) { notify = callback; } observe(element) { observed.push(element); } disconnect() { disconnected = true; } }
  const layout = new BoardViewportLayout({ boardScroll, boardTopSpacer, battleToolbar, commandDock }, Observer);
  layout.sync();
  assert.equal(boardTopSpacer.style.height, "62px"); assert.equal(commandDock.style.top, "62px");
  assert.equal(boardScroll.scrollTop, 0);
  boardScroll.scrollTop = 240; commandDock.hidden = false; notify();
  assert.equal(boardTopSpacer.style.height, "248px"); assert.equal(boardScroll.style.scrollPaddingTop, "248px");
  assert.equal(boardScroll.scrollTop, 426);
  layout.sync(); assert.equal(boardScroll.scrollTop, 426);
  commandDock.hidden = true; layout.sync(); assert.equal(boardScroll.scrollTop, 240);
  battleToolbar.hidden = true; layout.sync(); assert.equal(boardTopSpacer.style.height, "0px"); assert.equal(boardScroll.scrollTop, 178);
  assert.equal(observed.length, 3); layout.dispose(); assert.equal(disconnected, true);
});

test("opening the dock on a fitted map keeps the bottom unit visible even from scrollTop zero", () => {
  const boardTopSpacer = { style: {} };
  const boardScroll = { style: {}, scrollTop: 0, clientHeight: 785,
    get scrollHeight() { return 700 + Number.parseFloat(boardTopSpacer.style.height || 0); },
    getBoundingClientRect: () => ({ top: 52 }) };
  const battleToolbar = { hidden: false, getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 108 }) };
  const commandDock = { hidden: true, style: {}, getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 356 }) };
  const layout = new BoardViewportLayout({ boardScroll, boardTopSpacer, battleToolbar, commandDock }, null);
  layout.sync();
  const unitBottom = () => 52 + Number.parseFloat(boardTopSpacer.style.height) + 15 * 43.75 - boardScroll.scrollTop;
  assert.equal(boardScroll.scrollTop, 0); assert.ok(unitBottom() < 837);
  commandDock.hidden = false; layout.sync();
  assert.equal(boardScroll.scrollTop, 225); assert.ok(unitBottom() < 837);
  commandDock.hidden = true; layout.sync();
  assert.equal(boardScroll.scrollTop, 0); assert.ok(unitBottom() < 837);
});

test("cell visibility accounts for fixed controls, viewport edges and scrolling limits", () => {
  const boardScroll = { style: {}, scrollTop: 300, scrollLeft: 0, clientHeight: 600, clientWidth: 360,
    scrollHeight: 1800, scrollWidth: 700, getBoundingClientRect: () => ({ top: 50, bottom: 650, left: 0, right: 360 }) };
  const boardTopSpacer = { style: {} };
  const battleToolbar = { hidden: false, getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 106 }) };
  const commandDock = { hidden: false, style: {}, getClientRects: () => [1], getBoundingClientRect: () => ({ bottom: 290 }) };
  let contentTop = 400, contentLeft = 300;
  const board = { querySelector: () => ({ getBoundingClientRect: () => ({ top: 50 + contentTop - boardScroll.scrollTop,
    bottom: 100 + contentTop - boardScroll.scrollTop, left: contentLeft - boardScroll.scrollLeft,
    right: contentLeft + 50 - boardScroll.scrollLeft }) }) };
  const layout = new BoardViewportLayout({ boardScroll, boardTopSpacer, battleToolbar, commandDock, board }, null);
  layout.sync(); layout.keepCellVisible({ x: 0, y: 0 });
  assert.equal(boardScroll.scrollTop, 142); assert.equal(boardScroll.scrollLeft, 2);
  // A visible cell and a normal layout refresh must not pull the user's view back.
  layout.keepCellVisible({ x: 0, y: 0 }); layout.sync(); assert.equal(boardScroll.scrollTop, 142);
  contentTop = 1000; contentLeft = 650; layout.keepCellVisible({ x: 0, y: 0 });
  assert.equal(boardScroll.scrollTop, 462); assert.equal(boardScroll.scrollLeft, 340);
  contentTop = 0; contentLeft = 0; layout.keepCellVisible({ x: 0, y: 0 });
  assert.equal(boardScroll.scrollTop, 0); assert.equal(boardScroll.scrollLeft, 0);
});
