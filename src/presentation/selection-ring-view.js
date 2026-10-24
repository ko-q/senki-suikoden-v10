/** V9 selection feedback. CSS animates the ring; this view never changes battle data. */
export class SelectionRingView {
  #board; #ring = null;
  constructor(board) { this.#board = board; }
  render(stage, { selectionPosition, selectedUnit, previewDestination, inputLocked, presentationPosition }) {
    this.clear();
    const position = presentationPosition ?? selectionPosition;
    if (!position || (!presentationPosition && (inputLocked || stage.phase !== "PLAYER"))) return;
    const cell = this.#board.children[position.y * stage.map.width + position.x];
    if (!cell) return;
    const unit = !presentationPosition && previewDestination?.equals(position) ? selectedUnit : stage.map.getCellAt(position.x, position.y).occupant;
    const state = unit && stage.armyManager.playerArmy.has(unit) ? unit.actionState === "FINISHED" ? "done" : "ready" : "neutral";
    this.#ring = document.createElement("span");
    this.#ring.className = `selection-ring selection-ring-${state}`;
    this.#ring.setAttribute("aria-hidden", "true");
    cell.append(this.#ring);
  }
  clear() { this.#ring?.remove(); this.#ring = null; }
}
