const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex]";

/** Keyboard focus and background input isolation for one information overlay. */
export class ModalFocus {
  #root; #initialFocus; #blockedRoots; #blocked = []; #returnFocus = null; #active = false; #listener;
  constructor({ root, initialFocus, blockedRoots = [], onEscape }) {
    this.#root = root;
    this.#initialFocus = initialFocus;
    this.#blockedRoots = blockedRoots;
    this.#listener = (event) => {
      if (!this.#active || event.defaultPrevented || event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation?.();
        if (!event.repeat) onEscape();
      } else if (event.key === "Tab") {
        const items = [...(root.querySelectorAll?.(FOCUSABLE) ?? [])].filter((element) => (
          !element.disabled && element.tabIndex >= 0 && !element.closest?.("[hidden], [inert]")
          && element.getClientRects().length > 0
        ));
        const current = root.ownerDocument?.activeElement ?? globalThis.document?.activeElement;
        const index = items.indexOf(current);
        if (index < 0 || (event.shiftKey ? index === 0 : index === items.length - 1)) {
          event.preventDefault();
          ((event.shiftKey ? items.at(-1) : items[0]) ?? this.#initialFocus)?.focus({ preventScroll: true });
        }
      }
    };
    root.addEventListener("keydown", this.#listener);
  }
  activate(returnFocus = this.#root.ownerDocument?.activeElement ?? globalThis.document?.activeElement) {
    if (this.#active) return;
    this.#active = true;
    this.#returnFocus = returnFocus;
    this.#blocked = this.#blockedRoots.filter(Boolean).map((element) => [element, element.inert ?? false]);
    for (const [element] of this.#blocked) element.inert = true;
    this.#initialFocus?.focus({ preventScroll: true });
  }
  deactivate({ restoreFocus = true } = {}) {
    if (!this.#active) return;
    this.#active = false;
    for (const [element, inert] of this.#blocked) element.inert = inert;
    this.#blocked = [];
    const target = this.#returnFocus;
    this.#returnFocus = null;
    if (restoreFocus && target?.isConnected && !target.disabled && !target.closest?.("[hidden], [inert]")) {
      target.focus({ preventScroll: true });
    }
  }
  dispose() {
    this.deactivate({ restoreFocus: false });
    this.#root.removeEventListener("keydown", this.#listener);
  }
}
