import { invariant, requireIdentifier, requireNonEmptyString } from "../core/domain-error.js";
import { Character } from "./character.js";

export class Speech {
  constructor({ id, speaker, text, actionLabel = undefined }) {
    this.id = requireIdentifier(id, "SPEECH_ID_INVALID");
    invariant(speaker instanceof Character, "SPEECH_SPEAKER_REQUIRED");
    this.speaker = speaker;
    this.text = requireNonEmptyString(text, "SPEECH_TEXT_INVALID");
    this.actionLabel = actionLabel === undefined ? undefined : String(actionLabel);
    Object.freeze(this);
  }
}

export class Dialogue {
  constructor({ id, speeches }) {
    this.id = requireIdentifier(id, "DIALOGUE_ID_INVALID");
    invariant(Array.isArray(speeches) && speeches.length > 0, "DIALOGUE_SPEECHES_REQUIRED");
    invariant(speeches.every((speech) => speech instanceof Speech), "DIALOGUE_SPEECH_INVALID");
    this.speeches = Object.freeze([...speeches]);
    Object.freeze(this);
  }
}

class ReadonlyManager {
  #itemsById;

  constructor(items, expectedType, duplicateCode) {
    invariant(Array.isArray(items), "MANAGER_ITEMS_ARRAY_REQUIRED");
    this.#itemsById = new Map();

    for (const item of items) {
      invariant(item instanceof expectedType, "MANAGER_ITEM_TYPE_INVALID");
      invariant(!this.#itemsById.has(item.id), duplicateCode, { id: item.id });
      this.#itemsById.set(item.id, item);
    }
  }

  get(id) {
    const item = this.#itemsById.get(id);
    invariant(item !== undefined, "MANAGER_ITEM_NOT_FOUND", { id });
    return item;
  }

  has(id) {
    return this.#itemsById.has(id);
  }

  getAll() {
    return Object.freeze([...this.#itemsById.values()]);
  }
}

export class SpeechManager extends ReadonlyManager {
  constructor(speeches = []) {
    super(speeches, Speech, "SPEECH_ID_DUPLICATE");
  }
}

export class DialogueManager extends ReadonlyManager {
  constructor(dialogues = []) {
    super(dialogues, Dialogue, "DIALOGUE_ID_DUPLICATE");
  }
}
