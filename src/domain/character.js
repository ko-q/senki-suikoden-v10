import {
  copyFrozenArray,
  invariant,
  requireIdentifier,
  requireIntegerInRange,
  requireNonEmptyString
} from "../core/domain-error.js";

function normalizeStat(value, name) {
  return requireIntegerInRange(value, 0, 100, `CHARACTER_${name}_INVALID`);
}

/**
 * 人物の章共通データ。戦闘中に変化しないためimmutableとする。
 */
export class Character {
  constructor({
    id,
    name,
    reading = "",
    shortName,
    martial,
    command,
    intelligence,
    charisma,
    portraitKey = "",
    alias = "",
    combatSkills = [],
    specialAbilities = [],
    personality = "",
    historical = "",
    source = ""
  }) {
    this.id = requireIdentifier(id, "CHARACTER_ID_INVALID");
    this.name = requireNonEmptyString(name, "CHARACTER_NAME_INVALID");
    this.reading = String(reading);
    this.shortName = requireNonEmptyString(shortName, "CHARACTER_SHORT_NAME_INVALID");
    this.martial = normalizeStat(martial, "MARTIAL");
    this.command = normalizeStat(command, "COMMAND");
    this.intelligence = normalizeStat(intelligence, "INTELLIGENCE");
    this.charisma = normalizeStat(charisma, "CHARISMA");
    this.portraitKey = String(portraitKey);
    this.alias = String(alias);
    this.combatSkills = copyFrozenArray(combatSkills.map(String));
    this.specialAbilities = copyFrozenArray(specialAbilities.map(String));
    this.personality = String(personality);
    this.historical = String(historical);
    this.source = String(source);
    Object.freeze(this);
  }
}

/**
 * CharacterをIDで一意に管理する読み取り専用catalog。
 */
export class CharacterManager {
  #charactersById;

  constructor(characters = []) {
    invariant(Array.isArray(characters), "CHARACTERS_ARRAY_REQUIRED");
    this.#charactersById = new Map();

    for (const character of characters) {
      invariant(character instanceof Character, "CHARACTER_INSTANCE_REQUIRED");
      invariant(!this.#charactersById.has(character.id), "CHARACTER_ID_DUPLICATE", {
        characterId: character.id
      });
      this.#charactersById.set(character.id, character);
    }
  }

  get(characterId) {
    const character = this.#charactersById.get(characterId);
    invariant(character !== undefined, "CHARACTER_NOT_FOUND", { characterId });
    return character;
  }

  has(characterId) {
    return this.#charactersById.has(characterId);
  }

  getAll() {
    return Object.freeze([...this.#charactersById.values()]);
  }

  get size() {
    return this.#charactersById.size;
  }
}
