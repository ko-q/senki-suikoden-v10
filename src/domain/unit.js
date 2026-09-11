import {
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireIntegerInRange
} from "../core/domain-error.js";
import { Character } from "./character.js";

export const Facing = Object.freeze({
  NORTH: "NORTH",
  EAST: "EAST",
  SOUTH: "SOUTH",
  WEST: "WEST"
});

export const UnitActionState = Object.freeze({
  READY: "READY",
  MOVED: "MOVED",
  TACTIC_COMMITTED: "TACTIC_COMMITTED",
  FINISHED: "FINISHED"
});

export const UnitStatus = Object.freeze({
  CONFUSED: "CONFUSED",
  ILLUSION: "ILLUSION"
});

const STATUS_ORDER = Object.freeze([UnitStatus.CONFUSED, UnitStatus.ILLUSION]);

const ALLOWED_ACTION_TRANSITIONS = new Map([
  [UnitActionState.READY, new Set([
    UnitActionState.MOVED,
    UnitActionState.TACTIC_COMMITTED,
    UnitActionState.FINISHED
  ])],
  [UnitActionState.MOVED, new Set([
    UnitActionState.TACTIC_COMMITTED,
    UnitActionState.FINISHED
  ])],
  [UnitActionState.TACTIC_COMMITTED, new Set([UnitActionState.FINISHED])],
  [UnitActionState.FINISHED, new Set([UnitActionState.READY])]
]);

function normalizeUseTable(values, codePrefix) {
  invariant(values !== null && typeof values === "object" && !Array.isArray(values), `${codePrefix}_INVALID`);
  const normalized = {};

  for (const [useId, count] of Object.entries(values)) {
    requireIdentifier(useId, `${codePrefix}_ID_INVALID`);
    normalized[useId] = requireIntegerInRange(
      count,
      0,
      Number.MAX_SAFE_INTEGER,
      `${codePrefix}_COUNT_INVALID`
    );
  }
  return normalized;
}

/**
 * 戦闘中の部隊状態。位置と所属は意図的に保持しない。
 */
export class Unit {
  #troops;
  #facing;
  #actionState;
  #abilityIds;
  #statusEffects;
  #maxUses;
  #remainingUses;

  constructor({
    id,
    character,
    maxTroops,
    troops = maxTroops,
    move,
    abilities = [],
    facing = Facing.SOUTH,
    actionState = UnitActionState.READY,
    statusEffects = [],
    maxUses = {},
    remainingUses = maxUses
  }) {
    this.id = requireIdentifier(id, "UNIT_ID_INVALID");
    invariant(character instanceof Character, "UNIT_CHARACTER_REQUIRED", { unitId: this.id });
    this.character = character;
    this.maxTroops = requireIntegerInRange(
      maxTroops,
      1,
      Number.MAX_SAFE_INTEGER,
      "UNIT_MAX_TROOPS_INVALID"
    );
    this.#troops = requireIntegerInRange(troops, 0, this.maxTroops, "UNIT_TROOPS_INVALID");
    this.move = requireIntegerInRange(move, 0, Number.MAX_SAFE_INTEGER, "UNIT_MOVE_INVALID");

    invariant(Array.isArray(abilities), "UNIT_ABILITIES_ARRAY_REQUIRED");
    const abilityIds = abilities.map((abilityId) => requireIdentifier(abilityId, "UNIT_ABILITY_ID_INVALID"));
    invariant(new Set(abilityIds).size === abilityIds.length, "UNIT_ABILITY_ID_DUPLICATE");
    this.abilities = Object.freeze([...abilityIds]);
    this.#abilityIds = new Set(abilityIds);

    this.#facing = requireEnumValue(facing, Facing, "UNIT_FACING_INVALID");
    this.#actionState = requireEnumValue(actionState, UnitActionState, "UNIT_ACTION_STATE_INVALID");
    this.#statusEffects = new Map();
    this.restoreStatusEffects(statusEffects);

    this.#maxUses = Object.freeze(normalizeUseTable(maxUses, "UNIT_MAX_USES"));
    this.#remainingUses = {};
    this.restoreRemainingUses(remainingUses);
  }

  get troops() {
    return this.#troops;
  }

  get facing() {
    return this.#facing;
  }

  get actionState() {
    return this.#actionState;
  }

  get statusEffects() {
    return Object.freeze(
      STATUS_ORDER
        .filter((type) => this.#statusEffects.has(type))
        .map((type) => Object.freeze({ type, remainingTurns: this.#statusEffects.get(type) }))
    );
  }

  get maxUses() {
    return this.#maxUses;
  }

  get remainingUses() {
    return Object.freeze({ ...this.#remainingUses });
  }

  hasTroops() {
    return this.#troops > 0;
  }

  hasAbility(abilityId) {
    return this.#abilityIds.has(abilityId);
  }

  applyDamage(amount) {
    requireIntegerInRange(amount, 0, Number.MAX_SAFE_INTEGER, "UNIT_DAMAGE_INVALID");
    const before = this.#troops;
    this.#troops = Math.max(0, this.#troops - amount);
    return Object.freeze({ before, after: this.#troops });
  }

  restoreTroops(troops) {
    this.#troops = requireIntegerInRange(troops, 0, this.maxTroops, "UNIT_TROOPS_INVALID");
  }

  setFacing(facing) {
    this.#facing = requireEnumValue(facing, Facing, "UNIT_FACING_INVALID");
  }

  transitionActionState(nextState) {
    requireEnumValue(nextState, UnitActionState, "UNIT_ACTION_STATE_INVALID");
    const allowed = ALLOWED_ACTION_TRANSITIONS.get(this.#actionState);
    invariant(allowed.has(nextState), "UNIT_ACTION_TRANSITION_INVALID", {
      from: this.#actionState,
      to: nextState
    });
    this.#actionState = nextState;
  }

  setReadyForPhase(canAct) {
    invariant(typeof canAct === "boolean", "UNIT_CAN_ACT_INVALID");
    this.#actionState = canAct ? UnitActionState.READY : UnitActionState.FINISHED;
  }

  restoreActionState(actionState) {
    this.#actionState = requireEnumValue(actionState, UnitActionState, "UNIT_ACTION_STATE_INVALID");
  }

  getStatusTurns(statusType) {
    requireEnumValue(statusType, UnitStatus, "UNIT_STATUS_TYPE_INVALID");
    return this.#statusEffects.get(statusType) ?? 0;
  }

  setStatus(statusType, remainingTurns) {
    requireEnumValue(statusType, UnitStatus, "UNIT_STATUS_TYPE_INVALID");
    requireIntegerInRange(
      remainingTurns,
      0,
      Number.MAX_SAFE_INTEGER,
      "UNIT_STATUS_TURNS_INVALID"
    );
    if (remainingTurns === 0) {
      this.#statusEffects.delete(statusType);
      return;
    }
    this.#statusEffects.set(statusType, remainingTurns);
  }

  restoreStatusEffects(statusEffects) {
    invariant(Array.isArray(statusEffects), "UNIT_STATUS_EFFECTS_ARRAY_REQUIRED");
    const restored = new Map();
    for (const effect of statusEffects) {
      invariant(effect !== null && typeof effect === "object", "UNIT_STATUS_EFFECT_INVALID");
      const type = requireEnumValue(effect.type, UnitStatus, "UNIT_STATUS_TYPE_INVALID");
      const remainingTurns = requireIntegerInRange(
        effect.remainingTurns,
        1,
        Number.MAX_SAFE_INTEGER,
        "UNIT_STATUS_TURNS_INVALID"
      );
      invariant(!restored.has(type), "UNIT_STATUS_TYPE_DUPLICATE", { type });
      restored.set(type, remainingTurns);
    }
    this.#statusEffects = restored;
  }

  restoreRemainingUses(remainingUses) {
    const normalizedRemainingUses = normalizeUseTable(remainingUses, "UNIT_REMAINING_USES");
    invariant(
      Object.keys(normalizedRemainingUses).length === Object.keys(this.#maxUses).length,
      "UNIT_USE_KEYS_MISMATCH"
    );

    for (const [useId, maximum] of Object.entries(this.#maxUses)) {
      invariant(
        Object.hasOwn(normalizedRemainingUses, useId) && normalizedRemainingUses[useId] <= maximum,
        "UNIT_REMAINING_USE_INVALID",
        { useId }
      );
    }
    this.#remainingUses = normalizedRemainingUses;
  }

  consumeUse(useId, amount = 1) {
    requireIdentifier(useId, "UNIT_USE_ID_INVALID");
    requireIntegerInRange(amount, 1, Number.MAX_SAFE_INTEGER, "UNIT_USE_AMOUNT_INVALID");
    invariant(Object.hasOwn(this.#remainingUses, useId), "UNIT_USE_NOT_FOUND", { useId });
    invariant(this.#remainingUses[useId] >= amount, "UNIT_USE_EXHAUSTED", { useId });
    this.#remainingUses[useId] -= amount;
  }

}
