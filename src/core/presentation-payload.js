import { ActionType } from "./action-request.js";
import { invariant } from "./domain-error.js";
import { Affiliation } from "../domain/army.js";
import { HiddenTrapKind } from "../domain/hidden-trap.js";
import { UnitStatus } from "../domain/unit.js";

const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const text = value => typeof value === "string" && value.length > 0;
const id = value => typeof value === "string" && /^[a-z0-9][a-z0-9_-]*$/.test(value);
const boolean = value => typeof value === "boolean";
const count = value => Number.isSafeInteger(value) && value >= 0;
const positive = value => count(value) && value > 0;
const oneOf = values => value => values.includes(value);
const nullable = check => value => value === null || check(value);
const arrayOf = check => value => Array.isArray(value) && value.every(check);
const shape = fields => value => record(value)
  && Object.entries(fields).every(([key, check]) => check(value[key]));
const position = shape({ x: count, y: count });
const statusType = oneOf(Object.values(UnitStatus));
const statusEffects = arrayOf(shape({ type: statusType, remainingTurns: positive }));
const statusChange = shape({ type: statusType, beforeTurns: count, afterTurns: count });
const operation = oneOf([...Object.values(ActionType), "ILLUSION_ATTACK", "TRAP"]);
// Wire values only: importing Stage or BattleResult here would create a domain cycle.
const phase = oneOf(["PLAYER", "ENEMY"]);

const fieldsByType = Object.freeze({
  UNIT_FOCUS: { unitId: id },
  MOVE: { unitId: id, from: position, to: position },
  ACTION: {
    actionType: oneOf([...Object.values(ActionType), "WAIT", "ILLUSION_WAIT"]),
    actorId: id, targetId: nullable(id), actorPosition: position,
    targetPosition: nullable(position), actorAffiliation: oneOf(Object.values(Affiliation)),
    actorIsMob: boolean, forced: boolean
  },
  DAMAGE: {
    operationType: operation, actorId: nullable(id),
    entries: arrayOf(shape({ unitId: id, position, damage: count,
      beforeTroops: count, afterTroops: count, defeated: boolean }))
  },
  TRAP: {
    trapId: id, trapKind: oneOf(Object.values(HiddenTrapKind)), unitId: id,
    neutralized: boolean, damage: count, beforeTroops: count, afterTroops: count,
    defeated: boolean, statusChange: nullable(statusChange)
  },
  PHASE: { turn: positive, phase },
  BATTLE_RESULT: {
    stageId: id, objectiveId: id, outcome: oneOf(["VICTORY", "DEFEAT"]), turn: positive, phase
  },
  MISSION_BRIEFING: { victory: text, defeat: text },
  CONFIRM: { messageKey: text }
});

function statusFields(reason) {
  if (reason === "PHASE_START") {
    return { reason: text, unitId: id, position,
      statusResult: oneOf(["NONE", "CONFUSION_SKIP", "ILLUSION"]), statusEffects };
  }
  if (reason === "TRAP") {
    return { reason: text, unitId: id, position, statusChange };
  }
  return { reason: operation, actorId: id,
    entries: arrayOf(shape({ unitId: id, position, before: statusEffects, after: statusEffects,
      effectTurns: nullable(count) })) };
}

/** Validate the complete wire contract at both production and reception. No runtime mutation. */
export function validatePresentationPayload(type, payload) {
  invariant(record(payload), "PRESENTATION_PAYLOAD_INVALID", { type, field: "payload" });
  const fields = type === "STATUS" ? statusFields(payload.reason) : fieldsByType[type];
  invariant(fields !== undefined, "PRESENTATION_PAYLOAD_INVALID", { type, field: "type" });
  for (const [field, check] of Object.entries(fields)) {
    invariant(check(payload[field]), "PRESENTATION_PAYLOAD_INVALID", { type, field });
  }
  if (type === "ACTION") {
    const targetless = payload.actionType === "WAIT" || payload.actionType === "ILLUSION_WAIT";
    invariant(targetless
      ? payload.targetId === null && payload.targetPosition === null
      : payload.targetId !== null && payload.targetPosition !== null,
    "PRESENTATION_PAYLOAD_INVALID", { type, field: "targetId/targetPosition" });
  }
  return payload;
}
