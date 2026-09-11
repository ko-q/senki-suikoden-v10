import {
  invariant,
  requireIntegerInRange,
  requireNonEmptyString
} from "../core/domain-error.js";

function freezeEntry(entry) {
  return Object.freeze({
    sequence: entry.sequence,
    turn: entry.turn,
    phase: entry.phase,
    type: entry.type,
    text: entry.text,
    unitIds: Object.freeze([...entry.unitIds])
  });
}

/**
 * 表示済み文言をsnapshotとして保持する戦闘log。
 */
export class BattleLog {
  #entries;
  #nextSequence;

  constructor() {
    this.#entries = [];
    this.#nextSequence = 1;
  }

  append({ turn, phase, type, text, unitIds = [] }) {
    requireIntegerInRange(turn, 1, Number.MAX_SAFE_INTEGER, "BATTLE_LOG_TURN_INVALID");
    requireNonEmptyString(phase, "BATTLE_LOG_PHASE_INVALID");
    requireNonEmptyString(type, "BATTLE_LOG_TYPE_INVALID");
    requireNonEmptyString(text, "BATTLE_LOG_TEXT_INVALID");
    invariant(Array.isArray(unitIds), "BATTLE_LOG_UNIT_IDS_INVALID");
    invariant(unitIds.every((unitId) => typeof unitId === "string"), "BATTLE_LOG_UNIT_ID_INVALID");

    const entry = freezeEntry({
      sequence: this.#nextSequence,
      turn,
      phase,
      type,
      text,
      unitIds
    });
    this.#entries.push(entry);
    this.#nextSequence += 1;
    return entry;
  }

  restore(entries) {
    invariant(Array.isArray(entries), "BATTLE_LOG_ENTRIES_INVALID");
    let previousSequence = 0;
    const restored = entries.map((entry) => {
      invariant(entry !== null && typeof entry === "object", "BATTLE_LOG_ENTRY_INVALID");
      requireIntegerInRange(
        entry.sequence,
        previousSequence + 1,
        Number.MAX_SAFE_INTEGER,
        "BATTLE_LOG_SEQUENCE_INVALID"
      );
      previousSequence = entry.sequence;
      requireIntegerInRange(entry.turn, 1, Number.MAX_SAFE_INTEGER, "BATTLE_LOG_TURN_INVALID");
      requireNonEmptyString(entry.phase, "BATTLE_LOG_PHASE_INVALID");
      requireNonEmptyString(entry.type, "BATTLE_LOG_TYPE_INVALID");
      requireNonEmptyString(entry.text, "BATTLE_LOG_TEXT_INVALID");
      invariant(Array.isArray(entry.unitIds), "BATTLE_LOG_UNIT_IDS_INVALID");
      return freezeEntry(entry);
    });
    this.#entries = restored;
    this.#nextSequence = previousSequence + 1;
  }

  getEntries() {
    return Object.freeze([...this.#entries]);
  }
}
