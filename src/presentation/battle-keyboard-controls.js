/** Maps PC input to the same Back command as the existing button. */
export class BattleKeyboardControls {
  #target; #listener;
  constructor({ root, canGoBack, onBack, target = globalThis.document }) {
    this.#target = target;
    this.#listener = (event) => {
      if (event.key !== "Escape" || event.defaultPrevented || event.repeat || event.isComposing
        || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (!root || root.isConnected === false || root.hidden || root.inert
        || root.closest?.("[hidden], [inert]")) return;
      if (event.target?.isContentEditable || event.target?.closest?.("input, textarea, select, [contenteditable]")) return;
      if (!canGoBack()) return;
      event.preventDefault();
      onBack();
    };
    target?.addEventListener?.("keydown", this.#listener);
  }
  dispose() { this.#target?.removeEventListener?.("keydown", this.#listener); }
}
