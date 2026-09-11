import {
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireIntegerInRange
} from "../core/domain-error.js";
import { Affiliation } from "./army.js";
import { Position } from "./position.js";

export const HiddenTrapKind = Object.freeze({
  NORMAL: "normal",
  SPELL: "spell"
});

function normalizeAffiliations(values) {
  invariant(Array.isArray(values) && values.length > 0, "TRAP_AFFILIATIONS_REQUIRED");
  const normalized = values.map((value) => requireEnumValue(
    value,
    Affiliation,
    "TRAP_AFFILIATION_INVALID"
  ));
  invariant(new Set(normalized).size === normalized.length, "TRAP_AFFILIATION_DUPLICATE");
  return Object.freeze(normalized);
}

function normalizeCandidatePositions(position, candidatePositions) {
  const hasPosition = position !== undefined && position !== null;
  const hasCandidates = candidatePositions !== undefined && candidatePositions !== null;
  invariant(hasPosition !== hasCandidates, "TRAP_DEFINITION_POSITION_SOURCE_INVALID");
  const values = hasPosition ? [position] : candidatePositions;
  invariant(Array.isArray(values) && values.length > 0, "TRAP_DEFINITION_CANDIDATES_REQUIRED");
  const normalized = values.map((value) => Position.from(value));
  invariant(
    new Set(normalized.map((value) => value.toKey())).size === normalized.length,
    "TRAP_DEFINITION_CANDIDATE_DUPLICATE"
  );
  return Object.freeze(normalized);
}

/**
 * 乱数選択前の候補zone。固定位置はposition 1件として表現できる。
 */
export class HiddenTrapDefinition {
  constructor({
    id,
    kind = HiddenTrapKind.NORMAL,
    position = undefined,
    candidatePositions = undefined,
    count = 1,
    triggerAffiliations
  }) {
    this.id = requireIdentifier(id, "TRAP_DEFINITION_ID_INVALID");
    this.kind = requireEnumValue(kind, HiddenTrapKind, "TRAP_KIND_INVALID");
    this.candidatePositions = normalizeCandidatePositions(position, candidatePositions);
    this.count = requireIntegerInRange(
      count,
      1,
      Number.MAX_SAFE_INTEGER,
      "TRAP_DEFINITION_COUNT_INVALID"
    );
    this.triggerAffiliations = normalizeAffiliations(triggerAffiliations);
    Object.freeze(this);
  }
}

/**
 * 新規開始時の生成結果またはSave復元結果であるactive Trap。
 */
export class HiddenTrap {
  constructor({ id, kind, position, triggerAffiliations, active = true }) {
    this.id = requireIdentifier(id, "TRAP_ID_INVALID");
    this.kind = requireEnumValue(kind, HiddenTrapKind, "TRAP_KIND_INVALID");
    this.position = Position.from(position);
    this.triggerAffiliations = normalizeAffiliations(triggerAffiliations);
    invariant(typeof active === "boolean", "TRAP_ACTIVE_INVALID");
    this.active = active;
  }

  canTriggerFor(affiliation) {
    return this.active && this.triggerAffiliations.includes(affiliation);
  }

  deactivate() {
    invariant(this.active, "TRAP_ALREADY_INACTIVE", { trapId: this.id });
    this.active = false;
  }
}
