import {
  invariant,
  requireIdentifier,
  requireIntegerInRange,
  requireNonEmptyString
} from "../core/domain-error.js";
import { SAVE_FORMAT_VERSION } from "../config/version.js";

export const SaveKind = Object.freeze({
  RECOVERY: "recovery",
  MANUAL: "manual"
});

const SAVE_KINDS = new Set(Object.values(SaveKind));
const PHASES = new Set(["PLAYER", "ENEMY"]);
const AFFILIATIONS = new Set(["PLAYER", "ENEMY"]);
const FACINGS = new Set(["NORTH", "EAST", "SOUTH", "WEST"]);
const ACTION_STATES = new Set(["READY", "MOVED", "TACTIC_COMMITTED", "FINISHED"]);
const STATUS_TYPES = Object.freeze(["CONFUSED", "ILLUSION"]);
const STATUS_INDEX = new Map(STATUS_TYPES.map((type, index) => [type, index]));
const TRAP_KINDS = new Set(["normal", "spell"]);

const DOCUMENT_KEYS = Object.freeze([
  "saveFormatVersion",
  "gameVersion",
  "contentRevision",
  "saveKind",
  "slotId",
  "revision",
  "writerId",
  "savedAt",
  "battle"
]);
const BATTLE_KEYS = Object.freeze([
  "stageId",
  "turn",
  "phase",
  "randomState",
  "units",
  "hiddenTraps",
  "completedEventIds",
  "logs"
]);
const RANDOM_STATE_KEYS = Object.freeze(["algorithm", "state"]);
const UNIT_KEYS = Object.freeze([
  "id",
  "army",
  "troops",
  "position",
  "facing",
  "actionState",
  "statusEffects",
  "remainingUses"
]);
const POSITION_KEYS = Object.freeze(["x", "y"]);
const STATUS_KEYS = Object.freeze(["type", "remainingTurns"]);
const TRAP_KEYS = Object.freeze([
  "id",
  "kind",
  "position",
  "active",
  "triggerAffiliations"
]);
const LOG_KEYS = Object.freeze([
  "sequence",
  "turn",
  "phase",
  "type",
  "text",
  "unitIds"
]);

function requirePlainObject(value, code) {
  invariant(
    value !== null
      && typeof value === "object"
      && !Array.isArray(value)
      && Object.getPrototypeOf(value) === Object.prototype,
    code
  );
  return value;
}

function requireExactKeys(value, expectedKeys, code) {
  const actualKeys = Object.keys(value).sort();
  const sortedExpected = [...expectedKeys].sort();
  invariant(
    actualKeys.length === sortedExpected.length
      && actualKeys.every((key, index) => key === sortedExpected[index]),
    code,
    { actualKeys, expectedKeys: sortedExpected }
  );
}

function requireEnumLiteral(value, allowedValues, code) {
  invariant(allowedValues.has(value), code, { value });
  return value;
}

function requireBoolean(value, code) {
  invariant(typeof value === "boolean", code, { value });
  return value;
}

function validatePosition(position, codePrefix) {
  requirePlainObject(position, `${codePrefix}_INVALID`);
  requireExactKeys(position, POSITION_KEYS, `${codePrefix}_FIELDS_INVALID`);
  requireIntegerInRange(position.x, 0, Number.MAX_SAFE_INTEGER, `${codePrefix}_X_INVALID`);
  requireIntegerInRange(position.y, 0, Number.MAX_SAFE_INTEGER, `${codePrefix}_Y_INVALID`);
}

function validateStatusEffects(statusEffects) {
  invariant(Array.isArray(statusEffects), "SAVE_UNIT_STATUS_EFFECTS_INVALID");
  let previousIndex = -1;
  for (const effect of statusEffects) {
    requirePlainObject(effect, "SAVE_UNIT_STATUS_EFFECT_INVALID");
    requireExactKeys(effect, STATUS_KEYS, "SAVE_UNIT_STATUS_FIELDS_INVALID");
    const index = STATUS_INDEX.get(effect.type);
    invariant(index !== undefined, "SAVE_UNIT_STATUS_TYPE_INVALID", { type: effect.type });
    invariant(index > previousIndex, "SAVE_UNIT_STATUS_ORDER_INVALID", { type: effect.type });
    requireIntegerInRange(
      effect.remainingTurns,
      1,
      Number.MAX_SAFE_INTEGER,
      "SAVE_UNIT_STATUS_TURNS_INVALID"
    );
    previousIndex = index;
  }
}

function validateRemainingUses(remainingUses) {
  requirePlainObject(remainingUses, "SAVE_UNIT_REMAINING_USES_INVALID");
  for (const [useId, count] of Object.entries(remainingUses)) {
    requireIdentifier(useId, "SAVE_UNIT_USE_ID_INVALID");
    requireIntegerInRange(
      count,
      0,
      Number.MAX_SAFE_INTEGER,
      "SAVE_UNIT_USE_COUNT_INVALID"
    );
  }
}

function validateUnit(unit) {
  requirePlainObject(unit, "SAVE_UNIT_INVALID");
  requireExactKeys(unit, UNIT_KEYS, "SAVE_UNIT_FIELDS_INVALID");
  requireIdentifier(unit.id, "SAVE_UNIT_ID_INVALID");
  if (unit.army !== null) {
    requireEnumLiteral(unit.army, AFFILIATIONS, "SAVE_UNIT_ARMY_INVALID");
  }
  requireIntegerInRange(unit.troops, 0, Number.MAX_SAFE_INTEGER, "SAVE_UNIT_TROOPS_INVALID");
  if (unit.position !== null) {
    validatePosition(unit.position, "SAVE_UNIT_POSITION");
  }
  requireEnumLiteral(unit.facing, FACINGS, "SAVE_UNIT_FACING_INVALID");
  requireEnumLiteral(unit.actionState, ACTION_STATES, "SAVE_UNIT_ACTION_STATE_INVALID");
  validateStatusEffects(unit.statusEffects);
  validateRemainingUses(unit.remainingUses);
}

function validateTrap(trap) {
  requirePlainObject(trap, "SAVE_TRAP_INVALID");
  requireExactKeys(trap, TRAP_KEYS, "SAVE_TRAP_FIELDS_INVALID");
  requireIdentifier(trap.id, "SAVE_TRAP_ID_INVALID");
  requireEnumLiteral(trap.kind, TRAP_KINDS, "SAVE_TRAP_KIND_INVALID");
  validatePosition(trap.position, "SAVE_TRAP_POSITION");
  requireBoolean(trap.active, "SAVE_TRAP_ACTIVE_INVALID");
  invariant(
    Array.isArray(trap.triggerAffiliations) && trap.triggerAffiliations.length > 0,
    "SAVE_TRAP_AFFILIATIONS_INVALID"
  );
  const seen = new Set();
  for (const affiliation of trap.triggerAffiliations) {
    requireEnumLiteral(affiliation, AFFILIATIONS, "SAVE_TRAP_AFFILIATION_INVALID");
    invariant(!seen.has(affiliation), "SAVE_TRAP_AFFILIATION_DUPLICATE", { affiliation });
    seen.add(affiliation);
  }
}

function validateLog(entry, previousSequence) {
  requirePlainObject(entry, "SAVE_LOG_INVALID");
  requireExactKeys(entry, LOG_KEYS, "SAVE_LOG_FIELDS_INVALID");
  requireIntegerInRange(
    entry.sequence,
    previousSequence + 1,
    Number.MAX_SAFE_INTEGER,
    "SAVE_LOG_SEQUENCE_INVALID"
  );
  requireIntegerInRange(entry.turn, 1, Number.MAX_SAFE_INTEGER, "SAVE_LOG_TURN_INVALID");
  requireEnumLiteral(entry.phase, PHASES, "SAVE_LOG_PHASE_INVALID");
  requireNonEmptyString(entry.type, "SAVE_LOG_TYPE_INVALID");
  requireNonEmptyString(entry.text, "SAVE_LOG_TEXT_INVALID");
  invariant(Array.isArray(entry.unitIds), "SAVE_LOG_UNIT_IDS_INVALID");
  for (const unitId of entry.unitIds) {
    requireIdentifier(unitId, "SAVE_LOG_UNIT_ID_INVALID");
  }
}

function validateBattle(battle) {
  requirePlainObject(battle, "SAVE_BATTLE_INVALID");
  requireExactKeys(battle, BATTLE_KEYS, "SAVE_BATTLE_FIELDS_INVALID");
  requireIdentifier(battle.stageId, "SAVE_STAGE_ID_INVALID");
  requireIntegerInRange(battle.turn, 1, Number.MAX_SAFE_INTEGER, "SAVE_TURN_INVALID");
  requireEnumLiteral(battle.phase, PHASES, "SAVE_PHASE_INVALID");

  requirePlainObject(battle.randomState, "SAVE_RANDOM_STATE_INVALID");
  requireExactKeys(battle.randomState, RANDOM_STATE_KEYS, "SAVE_RANDOM_STATE_FIELDS_INVALID");
  invariant(battle.randomState.algorithm === "xorshift32", "SAVE_RANDOM_ALGORITHM_INVALID");
  requireIntegerInRange(battle.randomState.state, 1, 0xffffffff, "SAVE_RANDOM_VALUE_INVALID");

  invariant(Array.isArray(battle.units), "SAVE_UNITS_INVALID");
  const unitIds = new Set();
  for (const unit of battle.units) {
    validateUnit(unit);
    invariant(!unitIds.has(unit.id), "SAVE_UNIT_ID_DUPLICATE", { unitId: unit.id });
    unitIds.add(unit.id);
  }

  invariant(Array.isArray(battle.hiddenTraps), "SAVE_TRAPS_INVALID");
  const trapIds = new Set();
  const trapPositions = new Set();
  for (const trap of battle.hiddenTraps) {
    validateTrap(trap);
    const positionKey = `${trap.position.x},${trap.position.y}`;
    invariant(!trapIds.has(trap.id), "SAVE_TRAP_ID_DUPLICATE", { trapId: trap.id });
    invariant(!trapPositions.has(positionKey), "SAVE_TRAP_POSITION_DUPLICATE", { positionKey });
    trapIds.add(trap.id);
    trapPositions.add(positionKey);
  }

  invariant(Array.isArray(battle.completedEventIds), "SAVE_COMPLETED_EVENT_IDS_INVALID");
  const eventIds = new Set();
  for (const eventId of battle.completedEventIds) {
    requireIdentifier(eventId, "SAVE_COMPLETED_EVENT_ID_INVALID");
    invariant(!eventIds.has(eventId), "SAVE_COMPLETED_EVENT_ID_DUPLICATE", { eventId });
    eventIds.add(eventId);
  }

  invariant(Array.isArray(battle.logs), "SAVE_LOGS_INVALID");
  let previousSequence = 0;
  for (const entry of battle.logs) {
    validateLog(entry, previousSequence);
    previousSequence = entry.sequence;
  }
}

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) {
    return value;
  }
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

/**
 * Runtime objectを知らず、SaveDocumentのJSON形状だけを検証する。
 */
export class SaveCodec {
  validateShape(document) {
    requirePlainObject(document, "SAVE_DOCUMENT_INVALID");
    requireExactKeys(document, DOCUMENT_KEYS, "SAVE_DOCUMENT_FIELDS_INVALID");
    invariant(
      document.saveFormatVersion === SAVE_FORMAT_VERSION,
      "SAVE_FORMAT_UNSUPPORTED",
      { saveFormatVersion: document.saveFormatVersion }
    );
    requireNonEmptyString(document.gameVersion, "SAVE_GAME_VERSION_INVALID");
    requireNonEmptyString(document.contentRevision, "SAVE_CONTENT_REVISION_INVALID");
    requireEnumLiteral(document.saveKind, SAVE_KINDS, "SAVE_KIND_INVALID");
    requireIdentifier(document.slotId, "SAVE_SLOT_ID_INVALID");
    requireIntegerInRange(document.revision, 1, Number.MAX_SAFE_INTEGER, "SAVE_REVISION_INVALID");
    requireIdentifier(document.writerId, "SAVE_WRITER_ID_INVALID");
    requireIntegerInRange(document.savedAt, 0, Number.MAX_SAFE_INTEGER, "SAVE_TIME_INVALID");
    validateBattle(document.battle);
    return true;
  }

  encode(document) {
    this.validateShape(document);
    return JSON.stringify(document);
  }

  decode(raw) {
    invariant(typeof raw === "string", "SAVE_RAW_INVALID");
    let document;
    try {
      document = JSON.parse(raw);
    } catch (error) {
      invariant(false, "SAVE_JSON_INVALID", { message: error?.message });
    }
    this.validateShape(document);
    return deepFreeze(document);
  }
}
