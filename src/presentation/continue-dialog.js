import { ModalFocus } from "./modal-focus.js";

/** Input and focus for a read-through dialog; the caller owns its content and progress. */
export class ContinueDialog {
  #root; #button; #focus; #bindings; #disposed = false; #spacePressed = false;
  constructor({ root, button, onContinue }) {
    this.#root = root; this.#button = button;
    this.#focus = new ModalFocus({ root, initialFocus: button,
      blockedRoots: [...(root.parentNode?.children ?? [])].filter(element => element !== root),
      // Dialogue and briefing require the explicit Continue action, as in V9.
      onEscape: () => {} });
    const advance = () => {
      if (!this.#disposed && !root.hidden && !button.disabled && !root.closest?.("[hidden], [inert]")) onContinue();
    };
    this.#bindings = [
      ["click", advance],
      ["keydown", event => {
        if (event.defaultPrevented || event.isComposing || !["Enter", " "].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation?.();
        if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "Enter") advance();
        else this.#spacePressed = true;
      }],
      ["keyup", event => {
        if (event.key !== " ") return;
        event.preventDefault(); event.stopPropagation?.();
        const pressed = this.#spacePressed; this.#spacePressed = false;
        if (pressed && !event.isComposing) advance();
      }],
      ["blur", () => { this.#spacePressed = false; }]
    ];
    for (const [type, listener] of this.#bindings) button.addEventListener(type, listener);
    root.hidden = true;
  }
  show() {
    if (this.#disposed) return;
    this.#root.hidden = false;
    this.refreshFocus();
  }
  refreshFocus() {
    // A new battle can show its intro while the shell still hides its host.
    // Activate only after attachment and visibility, then keep the original focus owner.
    if (this.#disposed || this.#root.hidden || this.#root.isConnected === false
      || this.#root.closest?.("[hidden], [inert]")) return;
    this.#focus.activate();
  }
  hide({ restoreFocus = true } = {}) {
    this.#spacePressed = false;
    this.#root.hidden = true;
    this.#focus.deactivate({ restoreFocus });
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.hide({ restoreFocus: false });
    this.#focus.dispose();
    for (const [type, listener] of this.#bindings) this.#button.removeEventListener(type, listener);
    this.#bindings = [];
  }
}
