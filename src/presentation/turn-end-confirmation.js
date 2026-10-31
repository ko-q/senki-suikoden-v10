import { ModalFocus } from "./modal-focus.js";

/** A non-blocking view of the screen's pending turn-end decision. */
export class TurnEndConfirmation {
  #elements; #focus; #bindings;
  constructor(elements, onAnswer) {
    this.#elements = elements;
    const root = elements.turnEndOverlay;
    this.#focus = new ModalFocus({ root, initialFocus: elements.cancelTurnEndButton,
      blockedRoots: [...(root.parentNode?.children ?? [])].filter(element => element !== root),
      onEscape: () => onAnswer(false) });
    this.#bindings = [[elements.cancelTurnEndButton, () => onAnswer(false)],
      [elements.confirmTurnEndButton, () => onAnswer(true)]];
    for (const [element, listener] of this.#bindings) element.addEventListener("click", listener);
    root.hidden = true;
  }
  render(names) {
    const { turnEndOverlay, turnEndMessage, endTurnButton } = this.#elements;
    if (names) {
      turnEndMessage.textContent = `未行動の味方部隊が${names.length}部隊います。\n${names.join("、")}\n\nこのままターンを終了しますか？`;
      turnEndOverlay.hidden = false;
      this.#focus.activate(endTurnButton);
    } else {
      turnEndOverlay.hidden = true;
      this.#focus.deactivate();
    }
  }
  dispose() {
    this.#elements.turnEndOverlay.hidden = true;
    this.#focus.dispose();
    for (const [element, listener] of this.#bindings) element.removeEventListener("click", listener);
    this.#bindings = [];
  }
}
