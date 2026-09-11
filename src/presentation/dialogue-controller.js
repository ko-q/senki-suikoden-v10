import { invariant } from "../core/domain-error.js";
import { Dialogue } from "../domain/dialogue.js";

/**
 * Dialogue再生位置だけを持つDOM非依存のpresentation state。
 */
export class DialogueController {
  #dialogue;
  #currentIndex;
  #active;

  constructor() {
    this.#dialogue = null;
    this.#currentIndex = -1;
    this.#active = false;
  }

  get dialogue() {
    return this.#dialogue;
  }

  get currentIndex() {
    return this.#currentIndex;
  }

  get isActive() {
    return this.#active;
  }

  start(dialogue) {
    invariant(dialogue instanceof Dialogue, "DIALOGUE_CONTROLLER_DIALOGUE_REQUIRED");
    invariant(!this.#active, "DIALOGUE_CONTROLLER_ALREADY_ACTIVE");
    this.#dialogue = dialogue;
    this.#currentIndex = 0;
    this.#active = true;
    return this.getCurrentSpeech();
  }

  getCurrentSpeech() {
    if (!this.#active) {
      return null;
    }
    return this.#dialogue.speeches[this.#currentIndex] ?? null;
  }

  advance() {
    invariant(this.#active, "DIALOGUE_CONTROLLER_NOT_ACTIVE");
    if (this.#currentIndex + 1 >= this.#dialogue.speeches.length) {
      this.finish();
      return null;
    }
    this.#currentIndex += 1;
    return this.getCurrentSpeech();
  }

  finish() {
    if (!this.#active) {
      return null;
    }
    const finishedDialogue = this.#dialogue;
    this.#dialogue = null;
    this.#currentIndex = -1;
    this.#active = false;
    return finishedDialogue;
  }
}
