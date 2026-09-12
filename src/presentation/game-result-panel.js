import { BattleOutcome } from "../core/battle-result.js";
import { invariant, requireNonEmptyString } from "../core/domain-error.js";

function requireElement(element, code) {
  invariant(element !== null && typeof element === "object", code);
  return element;
}

/**
 * BattleResult Promiseの完了後にだけ表示するGame所有の結果画面。
 */
export class GameResultPanel {
  #elements;
  #onNewBattle;
  #bound;
  #disposed;

  constructor({ elements }) {
    invariant(elements !== null && typeof elements === "object", "GAME_RESULT_ELEMENTS_REQUIRED");
    this.#elements = Object.freeze({
      details: requireElement(elements.details, "GAME_RESULT_DETAILS_INVALID"),
      message: requireElement(elements.message, "GAME_RESULT_MESSAGE_INVALID"),
      newBattleButton: requireElement(
        elements.newBattleButton,
        "GAME_RESULT_NEW_BATTLE_BUTTON_INVALID"
      ),
      overlay: requireElement(elements.overlay, "GAME_RESULT_OVERLAY_INVALID"),
      title: requireElement(elements.title, "GAME_RESULT_TITLE_INVALID")
    });
    for (const methodName of ["addEventListener", "removeEventListener"]) {
      invariant(
        typeof this.#elements.newBattleButton[methodName] === "function",
        "GAME_RESULT_NEW_BATTLE_BUTTON_INVALID",
        { methodName }
      );
    }
    invariant(
      typeof this.#elements.overlay.setAttribute === "function",
      "GAME_RESULT_OVERLAY_INVALID"
    );
    this.#onNewBattle = null;
    this.#bound = false;
    this.#disposed = false;
  }

  bindHandlers({ onNewBattle }) {
    invariant(!this.#disposed, "GAME_RESULT_PANEL_DISPOSED");
    invariant(!this.#bound, "GAME_RESULT_PANEL_ALREADY_BOUND");
    invariant(typeof onNewBattle === "function", "GAME_RESULT_NEW_BATTLE_HANDLER_INVALID");
    this.#onNewBattle = onNewBattle;
    this.#elements.newBattleButton.addEventListener("click", this.#handleNewBattle);
    this.#bound = true;
  }

  show({ result, stageTitle }) {
    invariant(!this.#disposed, "GAME_RESULT_PANEL_DISPOSED");
    invariant(result !== null && typeof result === "object", "GAME_RESULT_INVALID");
    invariant(
      result.outcome === BattleOutcome.VICTORY || result.outcome === BattleOutcome.DEFEAT,
      "GAME_RESULT_OUTCOME_INVALID"
    );
    requireNonEmptyString(stageTitle, "GAME_RESULT_STAGE_TITLE_INVALID");
    this.#elements.title.textContent = result.outcome === BattleOutcome.VICTORY
      ? "Victory"
      : "Defeat";
    this.#elements.message.textContent = stageTitle;
    this.#elements.details.textContent = `Turn ${result.turn} / ${result.phase} / ${result.objectiveId}`;
    this.#elements.overlay.hidden = false;
    this.#elements.overlay.setAttribute("aria-hidden", "false");
    this.#elements.newBattleButton.focus?.({ preventScroll: true });
  }

  hide() {
    if (this.#disposed) {
      return;
    }
    this.#elements.overlay.hidden = true;
    this.#elements.overlay.setAttribute("aria-hidden", "true");
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    if (this.#bound) {
      this.#elements.newBattleButton.removeEventListener("click", this.#handleNewBattle);
    }
    this.#onNewBattle = null;
    this.#bound = false;
  }

  #handleNewBattle = () => {
    if (this.#disposed || this.#onNewBattle === null) {
      return;
    }
    this.#onNewBattle();
  };
}
