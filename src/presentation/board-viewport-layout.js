/** Keeps every map row reachable below the fixed V9 controls. Owns no battle state. */
export class BoardViewportLayout {
  #scroll; #spacer; #toolbar; #dock; #board; #observer = null; #height = null;
  constructor({ boardScroll, boardTopSpacer, battleToolbar, commandDock, board }, Observer = globalThis.ResizeObserver) {
    this.#scroll = boardScroll; this.#spacer = boardTopSpacer;
    this.#toolbar = battleToolbar; this.#dock = commandDock; this.#board = board;
    if (Observer && boardScroll && boardTopSpacer && battleToolbar && commandDock) {
      this.#observer = new Observer(() => this.sync());
      for (const element of [boardScroll, battleToolbar, commandDock]) this.#observer.observe(element);
    }
  }
  sync() {
    const scroll = this.#scroll;
    if (!scroll?.getBoundingClientRect || !this.#spacer || !scroll.clientHeight) return;
    const top = scroll.getBoundingClientRect().top;
    const bottom = (element) => element && !element.hidden && element.getClientRects().length
      ? element.getBoundingClientRect().bottom - top + 6 : 0;
    const toolbarBottom = bottom(this.#toolbar);
    this.#dock.style.top = `${toolbarBottom || 6}px`;
    const height = Math.max(0, Math.ceil(Math.max(toolbarBottom, bottom(this.#dock))));
    if (height === this.#height) return;
    const oldScrollTop = scroll.scrollTop;
    this.#spacer.style.height = `${height}px`;
    scroll.style.scrollPaddingTop = `${height}px`;
    // Once laid out, preserve the map even at scrollTop 0. Opening the dock must
    // not push a selected unit off the bottom of a map that previously fitted.
    if (this.#height !== null) {
      scroll.scrollTop = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, oldScrollTop + height - this.#height));
    }
    this.#height = height;
  }
  keepCellVisible(position) {
    const scroll = this.#scroll;
    if (!position || !scroll?.clientHeight || !this.#board?.querySelector) return;
    const cell = this.#board.querySelector(`[data-x="${position.x}"][data-y="${position.y}"]`);
    if (!cell?.getBoundingClientRect) return;
    const viewport = scroll.getBoundingClientRect(), rect = cell.getBoundingClientRect();
    const top = viewport.top + (this.#height ?? 0) + 12, bottom = viewport.bottom - 12;
    const deltaY = rect.top < top ? rect.top - top : rect.bottom > bottom ? rect.bottom - bottom : 0;
    if (deltaY) scroll.scrollTop = Math.max(0, Math.min(scroll.scrollHeight - scroll.clientHeight, scroll.scrollTop + deltaY));
    const left = viewport.left + 12, right = viewport.right - 12;
    const deltaX = rect.left < left ? rect.left - left : rect.right > right ? rect.right - right : 0;
    if (deltaX) scroll.scrollLeft = Math.max(0, Math.min(scroll.scrollWidth - scroll.clientWidth, scroll.scrollLeft + deltaX));
  }
  dispose() { this.#observer?.disconnect(); this.#observer = null; }
}
