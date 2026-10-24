/** One pointer gesture, shared by the board and selected-unit information. */
export class LongPressGesture {
  #open; #release; #canOpen; #timer = null; #pointer = null; #suppressClick = false;
  constructor({ open, release, canOpen }) {
    this.#open = open; this.#release = release; this.#canOpen = canOpen;
  }
  bind(element, getUnit) {
    const bindings = [];
    const listen = (type, listener) => { element.addEventListener(type, listener); bindings.push([type, listener]); };
    listen("pointerdown", (event) => {
      this.cancel(); this.#suppressClick = false;
      if (event.isPrimary === false || (event.button !== undefined && event.button !== 0) || !this.#canOpen()) return;
      const unit = getUnit();
      if (!unit) return;
      this.#pointer = { element, id: event.pointerId, x: event.clientX, y: event.clientY };
      if (event.pointerType !== "touch") {
        try { element.setPointerCapture?.(event.pointerId); } catch { /* Pointer may have ended. */ }
      }
      this.#timer = setTimeout(() => {
        this.#timer = null;
        if (!this.#pointer || !this.#canOpen()) return;
        this.#suppressClick = true;
        this.#open(unit);
      }, 430);
    });
    listen("pointermove", (event) => {
      if (!this.#pointer || this.#pointer.id !== event.pointerId) return;
      if (Math.hypot(event.clientX - this.#pointer.x, event.clientY - this.#pointer.y) > 8) {
        this.#suppressClick = true;
        this.#clearTimer();
      }
    });
    for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) listen(type, () => this.cancel());
    listen("pointerleave", () => { if (this.#timer !== null) this.cancel(); });
    listen("contextmenu", (event) => event.preventDefault());
    return () => {
      if (this.#pointer?.element === element) this.cancel();
      for (const [type, listener] of bindings) element.removeEventListener(type, listener);
    };
  }
  consumeClick() { const suppressed = this.#suppressClick; this.#suppressClick = false; return suppressed; }
  #clearTimer() { if (this.#timer !== null) clearTimeout(this.#timer); this.#timer = null; }
  cancel() { this.#clearTimer(); this.#pointer = null; this.#release(); }
}
