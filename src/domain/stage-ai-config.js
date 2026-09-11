import {
  invariant,
  requireIntegerInRange
} from "../core/domain-error.js";
import { Unit } from "./unit.js";

function freezeUniqueUnits(units, codePrefix) {
  invariant(
    Array.isArray(units) && units.every((unit) => unit instanceof Unit),
    `${codePrefix}_UNITS_INVALID`
  );
  invariant(new Set(units).size === units.length, `${codePrefix}_UNITS_DUPLICATE`);
  return Object.freeze([...units]);
}

function freezeColumns(columns, codePrefix) {
  invariant(Array.isArray(columns) && columns.length === 2, `${codePrefix}_COLUMNS_INVALID`);
  const normalized = columns.map((column) => requireIntegerInRange(
    column,
    0,
    Number.MAX_SAFE_INTEGER,
    `${codePrefix}_COLUMN_INVALID`
  )).sort((left, right) => left - right);
  invariant(normalized[0] !== normalized[1], `${codePrefix}_COLUMNS_DUPLICATE`);
  return Object.freeze(normalized);
}

/**
 * 特定Unitの広域幻術を、抑止Unitの生存・距離で切り替えるStage固有規則。
 */
export class WideIllusionAIRule {
  constructor({ actor, suppressor, suppressionRange = 3 }) {
    invariant(actor instanceof Unit, "WIDE_ILLUSION_AI_ACTOR_REQUIRED");
    invariant(suppressor instanceof Unit, "WIDE_ILLUSION_AI_SUPPRESSOR_REQUIRED");
    invariant(actor !== suppressor, "WIDE_ILLUSION_AI_UNITS_MUST_DIFFER");
    this.actor = actor;
    this.suppressor = suppressor;
    this.suppressionRange = requireIntegerInRange(
      suppressionRange,
      0,
      Number.MAX_SAFE_INTEGER,
      "WIDE_ILLUSION_AI_RANGE_INVALID"
    );
    Object.freeze(this);
  }
}

/**
 * 大名府追捕隊の門路前詰めと追跡を表すStage固有規則。
 */
export class PursuitAIRule {
  constructor({
    units,
    gateColumns,
    insideMaximumRow,
    outsideRow,
    candidateMinimumRow = 1
  }) {
    this.units = freezeUniqueUnits(units, "PURSUIT_AI");
    invariant(this.units.length > 0, "PURSUIT_AI_UNITS_REQUIRED");
    this.gateColumns = freezeColumns(gateColumns, "PURSUIT_AI_GATE");
    this.insideMaximumRow = requireIntegerInRange(
      insideMaximumRow,
      0,
      Number.MAX_SAFE_INTEGER,
      "PURSUIT_AI_INSIDE_ROW_INVALID"
    );
    this.outsideRow = requireIntegerInRange(
      outsideRow,
      0,
      Number.MAX_SAFE_INTEGER,
      "PURSUIT_AI_OUTSIDE_ROW_INVALID"
    );
    this.candidateMinimumRow = requireIntegerInRange(
      candidateMinimumRow,
      0,
      Number.MAX_SAFE_INTEGER,
      "PURSUIT_AI_MINIMUM_ROW_INVALID"
    );
    invariant(
      this.candidateMinimumRow <= this.insideMaximumRow
        && this.insideMaximumRow < this.outsideRow,
      "PURSUIT_AI_ROW_ORDER_INVALID"
    );
    Object.freeze(this);
  }

  has(unit) {
    return this.units.includes(unit);
  }
}

/**
 * 特定Unitが移動・近接攻撃で優先する対象を表す規則。
 */
export class TargetPriorityAIRule {
  constructor({ actors, targets, disableStrategy = false }) {
    this.actors = freezeUniqueUnits(actors, "TARGET_PRIORITY_AI_ACTOR");
    this.targets = freezeUniqueUnits(targets, "TARGET_PRIORITY_AI_TARGET");
    invariant(this.actors.length > 0, "TARGET_PRIORITY_AI_ACTORS_REQUIRED");
    invariant(this.targets.length > 0, "TARGET_PRIORITY_AI_TARGETS_REQUIRED");
    invariant(typeof disableStrategy === "boolean", "TARGET_PRIORITY_AI_STRATEGY_FLAG_INVALID");
    this.disableStrategy = disableStrategy;
    Object.freeze(this);
  }

  hasActor(unit) {
    return this.actors.includes(unit);
  }
}

/**
 * Stage固有AIのruntime参照を保持する。判断と乱数消費はAIServiceが担当する。
 */
export class StageAIConfig {
  constructor({
    adviserUnits = [],
    cautiousElementalUnits = [],
    wideIllusionRules = [],
    pursuitRules = [],
    targetPriorityRules = []
  } = {}) {
    this.adviserUnits = freezeUniqueUnits(adviserUnits, "STAGE_AI_ADVISER");
    this.cautiousElementalUnits = freezeUniqueUnits(
      cautiousElementalUnits,
      "STAGE_AI_CAUTIOUS_ELEMENTAL"
    );
    invariant(
      Array.isArray(wideIllusionRules)
        && wideIllusionRules.every((rule) => rule instanceof WideIllusionAIRule),
      "STAGE_AI_WIDE_ILLUSION_RULES_INVALID"
    );
    invariant(
      Array.isArray(pursuitRules)
        && pursuitRules.every((rule) => rule instanceof PursuitAIRule),
      "STAGE_AI_PURSUIT_RULES_INVALID"
    );
    invariant(
      Array.isArray(targetPriorityRules)
        && targetPriorityRules.every((rule) => rule instanceof TargetPriorityAIRule),
      "STAGE_AI_TARGET_PRIORITY_RULES_INVALID"
    );
    this.wideIllusionRules = Object.freeze([...wideIllusionRules]);
    this.pursuitRules = Object.freeze([...pursuitRules]);
    this.targetPriorityRules = Object.freeze([...targetPriorityRules]);

    invariant(
      new Set(this.wideIllusionRules.map((rule) => rule.actor)).size
        === this.wideIllusionRules.length,
      "STAGE_AI_WIDE_ILLUSION_ACTOR_DUPLICATE"
    );
    const pursuitUnits = this.pursuitRules.flatMap((rule) => rule.units);
    invariant(
      new Set(pursuitUnits).size === pursuitUnits.length,
      "STAGE_AI_PURSUIT_UNIT_DUPLICATE"
    );
    const priorityActors = this.targetPriorityRules.flatMap((rule) => rule.actors);
    invariant(
      new Set(priorityActors).size === priorityActors.length,
      "STAGE_AI_TARGET_PRIORITY_ACTOR_DUPLICATE"
    );
    Object.freeze(this);
  }

  getWideIllusionRule(unit) {
    return this.wideIllusionRules.find((rule) => rule.actor === unit) ?? null;
  }

  getPursuitRule(unit) {
    return this.pursuitRules.find((rule) => rule.has(unit)) ?? null;
  }

  getTargetPriorityRule(unit) {
    return this.targetPriorityRules.find((rule) => rule.hasActor(unit)) ?? null;
  }

  validateRuntime(stage) {
    invariant(
      stage !== null
        && typeof stage === "object"
        && typeof stage.getUnits === "function"
        && stage.map !== null,
      "STAGE_AI_STAGE_REQUIRED"
    );
    const unitSet = new Set(stage.getUnits());
    const referencedUnits = [
      ...this.adviserUnits,
      ...this.cautiousElementalUnits,
      ...this.wideIllusionRules.flatMap((rule) => [rule.actor, rule.suppressor]),
      ...this.pursuitRules.flatMap((rule) => rule.units),
      ...this.targetPriorityRules.flatMap((rule) => [...rule.actors, ...rule.targets])
    ];
    invariant(
      referencedUnits.every((unit) => unitSet.has(unit)),
      "STAGE_AI_UNKNOWN_UNIT"
    );

    for (const rule of this.pursuitRules) {
      invariant(
        rule.gateColumns.every((column) => column < stage.map.width),
        "STAGE_AI_GATE_COLUMN_OUTSIDE"
      );
      invariant(rule.outsideRow < stage.map.height, "STAGE_AI_GATE_ROW_OUTSIDE");
    }
    return true;
  }
}
