import { ModalFocus } from "./modal-focus.js";

/** Presents one cancellable UI decision; it never performs a save or replaces a battle. */
export class ActionConfirmation {
  #elements; #focus; #pending = null; #disposed = false; #bindings;
  constructor(elements) {
    this.#elements = elements;
    const { actionConfirmationOverlay: root, cancelActionButton, confirmActionButton } = elements;
    this.#focus = new ModalFocus({ root, initialFocus: cancelActionButton,
      blockedRoots: [...(root.parentNode?.children ?? [])].filter(element => element !== root),
      onEscape: () => this.#answer(false) });
    this.#bindings = [[cancelActionButton, () => this.#answer(false)],
      [confirmActionButton, () => this.#answer(true)]];
    for (const [button, listener] of this.#bindings) button.addEventListener("click", listener);
    root.hidden = true;
  }
  ask(message, { confirmLabel = "実行", signal } = {}) {
    if (this.#disposed || this.#pending || signal?.aborted) return Promise.resolve(false);
    return new Promise(resolve => {
      const abort = () => this.#answer(false);
      this.#pending = { resolve, signal, abort };
      signal?.addEventListener("abort", abort, { once: true });
      this.#elements.actionConfirmationMessage.textContent = message;
      this.#elements.confirmActionButton.textContent = confirmLabel;
      this.#elements.actionConfirmationOverlay.hidden = false;
      this.#focus.activate();
    });
  }
  #answer(answer, restoreFocus = true) {
    const pending = this.#pending;
    if (!pending) return;
    this.#pending = null;
    pending.signal?.removeEventListener("abort", pending.abort);
    this.#elements.actionConfirmationOverlay.hidden = true;
    this.#focus.deactivate({ restoreFocus });
    pending.resolve(answer);
  }
  dispose() {
    this.#disposed = true;
    this.#answer(false, false);
    this.#focus.dispose();
    for (const [button, listener] of this.#bindings) button.removeEventListener("click", listener);
    this.#bindings = [];
  }
}
