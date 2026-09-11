import {
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireIntegerInRange
} from "../core/domain-error.js";
import { Army } from "./army.js";
import { Position } from "./position.js";
import { StageEvent, StageEventManager } from "./stage-event.js";
import { Unit } from "./unit.js";

export const ObjectiveOutcome = Object.freeze({
  VICTORY: "VICTORY",
  DEFEAT: "DEFEAT"
});

export const ObjectiveType = Object.freeze({
  ELIMINATION: "ELIMINATION",
  REACH: "REACH",
  UNIT_DEFEAT: "UNIT_DEFEAT",
  TURN_LIMIT: "TURN_LIMIT",
  SURVIVE_UNTIL_TURN: "SURVIVE_UNTIL_TURN"
});

export const UnitDefeatMatch = Object.freeze({
  ANY: "ANY",
  ALL: "ALL"
});

function normalizeUnits(units, codePrefix) {
  invariant(Array.isArray(units) && units.length > 0, `${codePrefix}_UNITS_REQUIRED`);
  invariant(units.every((unit) => unit instanceof Unit), `${codePrefix}_UNIT_INVALID`);
  invariant(new Set(units).size === units.length, `${codePrefix}_UNIT_DUPLICATE`);
  return Object.freeze([...units]);
}

/**
 * 具体Objectiveの共通gatingを保持する基底。
 */
export class Objective {
  constructor({
    id,
    type,
    outcome,
    activeAfterEvent = null,
    inactiveAfterEvent = null
  }) {
    this.id = requireIdentifier(id, "OBJECTIVE_ID_INVALID");
    this.type = requireEnumValue(type, ObjectiveType, "OBJECTIVE_TYPE_INVALID");
    this.outcome = requireEnumValue(outcome, ObjectiveOutcome, "OBJECTIVE_OUTCOME_INVALID");
    invariant(
      activeAfterEvent === null || activeAfterEvent instanceof StageEvent,
      "OBJECTIVE_ACTIVE_EVENT_INVALID"
    );
    invariant(
      inactiveAfterEvent === null || inactiveAfterEvent instanceof StageEvent,
      "OBJECTIVE_INACTIVE_EVENT_INVALID"
    );
    invariant(
      activeAfterEvent === null || inactiveAfterEvent === null || activeAfterEvent !== inactiveAfterEvent,
      "OBJECTIVE_EVENT_GATE_CONFLICT"
    );
    this.activeAfterEvent = activeAfterEvent;
    this.inactiveAfterEvent = inactiveAfterEvent;
  }

  isActive(eventManager) {
    invariant(eventManager instanceof StageEventManager, "OBJECTIVE_EVENT_MANAGER_REQUIRED");
    if (this.activeAfterEvent !== null && !eventManager.isCompleted(this.activeAfterEvent)) {
      return false;
    }
    if (this.inactiveAfterEvent !== null && eventManager.isCompleted(this.inactiveAfterEvent)) {
      return false;
    }
    return true;
  }

  evaluate() {
    throw new Error("OBJECTIVE_EVALUATION_NOT_IMPLEMENTED");
  }

  validateRuntime() {
    return true;
  }
}

/**
 * 現在所属する指定Armyから生存Unitがいなくなった時に成立する。
 */
export class EliminationObjective extends Objective {
  constructor({ id, outcome, targetArmy, activeAfterEvent = null, inactiveAfterEvent = null }) {
    super({
      id,
      type: ObjectiveType.ELIMINATION,
      outcome,
      activeAfterEvent,
      inactiveAfterEvent
    });
    invariant(targetArmy instanceof Army, "ELIMINATION_OBJECTIVE_ARMY_REQUIRED");
    this.targetArmy = targetArmy;
    Object.freeze(this);
  }

  evaluate() {
    return this.targetArmy.getUnits().every((unit) => !unit.hasTroops());
  }

  validateRuntime(stage) {
    invariant(
      this.targetArmy === stage.armyManager.playerArmy
        || this.targetArmy === stage.armyManager.enemyArmy,
      "OBJECTIVE_ARMY_NOT_MANAGED",
      { objectiveId: this.id }
    );
    return true;
  }
}

/**
 * 指定Unit全員が現在位置で同じ到達範囲に入った時に成立する。
 */
export class ReachObjective extends Objective {
  constructor({
    id,
    outcome,
    units,
    destination,
    radius = 0,
    activeAfterEvent = null,
    inactiveAfterEvent = null
  }) {
    super({
      id,
      type: ObjectiveType.REACH,
      outcome,
      activeAfterEvent,
      inactiveAfterEvent
    });
    this.units = normalizeUnits(units, "REACH_OBJECTIVE");
    this.destination = Position.from(destination);
    this.radius = requireIntegerInRange(
      radius,
      0,
      Number.MAX_SAFE_INTEGER,
      "REACH_OBJECTIVE_RADIUS_INVALID"
    );
    Object.freeze(this);
  }

  evaluate(stage) {
    return this.units.every((unit) => {
      if (!unit.hasTroops()) {
        return false;
      }
      const position = stage.map.getPosition(unit);
      return position !== null && position.manhattanDistanceTo(this.destination) <= this.radius;
    });
  }

  validateRuntime(stage) {
    const stageUnits = new Set(stage.getUnits());
    invariant(
      this.units.every((unit) => stageUnits.has(unit)),
      "OBJECTIVE_UNIT_NOT_IN_STAGE",
      { objectiveId: this.id }
    );
    invariant(
      stage.map.getCellAt(this.destination.x, this.destination.y) !== null,
      "REACH_OBJECTIVE_DESTINATION_OUTSIDE",
      { objectiveId: this.id }
    );
    return true;
  }
}

/**
 * 指定UnitのうちANYまたはALLが敗走した時に成立する。
 */
export class UnitDefeatObjective extends Objective {
  constructor({
    id,
    outcome,
    units,
    match = UnitDefeatMatch.ANY,
    activeAfterEvent = null,
    inactiveAfterEvent = null
  }) {
    super({
      id,
      type: ObjectiveType.UNIT_DEFEAT,
      outcome,
      activeAfterEvent,
      inactiveAfterEvent
    });
    this.units = normalizeUnits(units, "UNIT_DEFEAT_OBJECTIVE");
    this.match = requireEnumValue(match, UnitDefeatMatch, "UNIT_DEFEAT_OBJECTIVE_MATCH_INVALID");
    Object.freeze(this);
  }

  evaluate() {
    if (this.match === UnitDefeatMatch.ALL) {
      return this.units.every((unit) => !unit.hasTroops());
    }
    return this.units.some((unit) => !unit.hasTroops());
  }

  validateRuntime(stage) {
    const stageUnits = new Set(stage.getUnits());
    invariant(
      this.units.every((unit) => stageUnits.has(unit)),
      "OBJECTIVE_UNIT_NOT_IN_STAGE",
      { objectiveId: this.id }
    );
    return true;
  }
}

/**
 * 最終Player Turn終了時だけ評価する敗北条件。
 */
export class TurnLimitObjective extends Objective {
  constructor({ id, maxTurn, activeAfterEvent = null, inactiveAfterEvent = null }) {
    super({
      id,
      type: ObjectiveType.TURN_LIMIT,
      outcome: ObjectiveOutcome.DEFEAT,
      activeAfterEvent,
      inactiveAfterEvent
    });
    this.maxTurn = requireIntegerInRange(
      maxTurn,
      1,
      Number.MAX_SAFE_INTEGER,
      "TURN_LIMIT_OBJECTIVE_TURN_INVALID"
    );
    Object.freeze(this);
  }

  evaluate(stage) {
    return stage.turn >= this.maxTurn;
  }
}

/**
 * 指定Player phase開始時だけ評価する勝利条件。
 */
export class SurviveUntilTurnObjective extends Objective {
  constructor({ id, targetTurn, activeAfterEvent = null, inactiveAfterEvent = null }) {
    super({
      id,
      type: ObjectiveType.SURVIVE_UNTIL_TURN,
      outcome: ObjectiveOutcome.VICTORY,
      activeAfterEvent,
      inactiveAfterEvent
    });
    this.targetTurn = requireIntegerInRange(
      targetTurn,
      1,
      Number.MAX_SAFE_INTEGER,
      "SURVIVE_OBJECTIVE_TURN_INVALID"
    );
    Object.freeze(this);
  }

  evaluate(stage) {
    return stage.turn >= this.targetTurn;
  }
}

/**
 * Definition順を保ち、通常・phase端点の評価時機を分離する。
 */
export class ObjectiveManager {
  #objectives;

  constructor(objectives = []) {
    invariant(Array.isArray(objectives), "OBJECTIVES_ARRAY_REQUIRED");
    const ids = new Set();
    for (const objective of objectives) {
      invariant(objective instanceof Objective, "OBJECTIVE_INSTANCE_REQUIRED");
      invariant(!ids.has(objective.id), "OBJECTIVE_ID_DUPLICATE", { objectiveId: objective.id });
      ids.add(objective.id);
    }
    this.#objectives = Object.freeze([...objectives]);
  }

  getAll() {
    return this.#objectives;
  }

  evaluateVictory(stage) {
    return this.#evaluateFirst(stage, (objective) => (
      objective.outcome === ObjectiveOutcome.VICTORY
      && !(objective instanceof SurviveUntilTurnObjective)
    ));
  }

  evaluateDefeat(stage) {
    return this.#evaluateFirst(stage, (objective) => (
      objective.outcome === ObjectiveOutcome.DEFEAT
      && !(objective instanceof TurnLimitObjective)
    ));
  }

  evaluatePlayerPhaseEndDefeat(stage) {
    return this.#evaluateFirst(stage, (objective) => objective instanceof TurnLimitObjective);
  }

  evaluatePlayerPhaseStartVictory(stage) {
    return this.#evaluateFirst(stage, (objective) => objective instanceof SurviveUntilTurnObjective);
  }

  #evaluateFirst(stage, predicate) {
    for (const objective of this.#objectives) {
      if (!predicate(objective) || !objective.isActive(stage.eventManager)) {
        continue;
      }
      if (objective.evaluate(stage)) {
        return objective;
      }
    }
    return null;
  }
}
