import {
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireIntegerInRange,
  requireNonEmptyString
} from "../core/domain-error.js";
import {
  normalizePresentationRequests,
  PresentationRequestType
} from "../core/presentation-request.js";
import { Army } from "./army.js";
import { HiddenTrap } from "./hidden-trap.js";
import { Position } from "./position.js";
import { Facing, Unit, UnitStatus } from "./unit.js";

export const StageEventTrigger = Object.freeze({
  PHASE_START: "PHASE_START",
  AFTER_OPERATION: "AFTER_OPERATION",
  UNIT_DEFEATED: "UNIT_DEFEATED",
  UNIT_REACHED: "UNIT_REACHED",
  TRAP_TRIGGERED: "TRAP_TRIGGERED"
});

export const StageEventType = Object.freeze({
  REINFORCEMENT: "REINFORCEMENT",
  BETRAYAL: "BETRAYAL",
  MISSION_TRANSITION: "MISSION_TRANSITION",
  DIALOGUE: "DIALOGUE"
});

function normalizeOptionalTurn(turn, code) {
  if (turn === null || turn === undefined) {
    return null;
  }
  return requireIntegerInRange(turn, 1, Number.MAX_SAFE_INTEGER, code);
}

function normalizeTriggers(trigger, triggers) {
  const hasTrigger = trigger !== undefined && trigger !== null;
  const hasTriggers = triggers !== undefined && triggers !== null;
  invariant(hasTrigger !== hasTriggers, "STAGE_EVENT_TRIGGER_SOURCE_INVALID");
  const values = hasTrigger ? [trigger] : triggers;
  invariant(Array.isArray(values) && values.length > 0, "STAGE_EVENT_TRIGGERS_REQUIRED");
  const normalized = values.map((value) => requireEnumValue(
    value,
    StageEventTrigger,
    "STAGE_EVENT_TRIGGER_INVALID"
  ));
  invariant(new Set(normalized).size === normalized.length, "STAGE_EVENT_TRIGGER_DUPLICATE");
  return Object.freeze(normalized);
}

function normalizeUnits(units, codePrefix, allowEmpty = true) {
  invariant(Array.isArray(units), `${codePrefix}_UNITS_ARRAY_REQUIRED`);
  if (!allowEmpty) {
    invariant(units.length > 0, `${codePrefix}_UNITS_REQUIRED`);
  }
  invariant(units.every((unit) => unit instanceof Unit), `${codePrefix}_UNIT_INVALID`);
  invariant(new Set(units).size === units.length, `${codePrefix}_UNIT_DUPLICATE`);
  return Object.freeze([...units]);
}

function normalizeEventResult(result) {
  invariant(
    result !== null && typeof result === "object" && !Array.isArray(result),
    "STAGE_EVENT_RESULT_INVALID"
  );
  invariant(typeof result.completed === "boolean", "STAGE_EVENT_RESULT_COMPLETED_INVALID");
  invariant(
    typeof result.interruptMovement === "boolean",
    "STAGE_EVENT_RESULT_INTERRUPT_INVALID"
  );
  return Object.freeze({
    completed: result.completed,
    interruptMovement: result.interruptMovement,
    presentationRequests: normalizePresentationRequests(result.presentationRequests ?? [])
  });
}

export function createStageEventResult({
  completed,
  interruptMovement = false,
  presentationRequests = []
}) {
  return normalizeEventResult({ completed, interruptMovement, presentationRequests });
}

/**
 * 具体Event実装が継承する依存解決済みruntime基底。
 */
export class StageEvent {
  #requiredCompletedEvents;
  #referencesResolved;

  constructor({
    id,
    type,
    trigger = undefined,
    triggers = undefined,
    requiredCompletedEventIds = [],
    interruptMovement = false,
    presentationRequests = []
  }) {
    this.id = requireIdentifier(id, "STAGE_EVENT_ID_INVALID");
    this.type = requireEnumValue(type, StageEventType, "STAGE_EVENT_TYPE_INVALID");
    this.triggers = normalizeTriggers(trigger, triggers);
    // 単一triggerを参照する既存コード向けの互換property。複数時は曖昧さを残さない。
    this.trigger = this.triggers.length === 1 ? this.triggers[0] : null;
    invariant(Array.isArray(requiredCompletedEventIds), "STAGE_EVENT_DEPENDENCIES_INVALID");
    this.requiredCompletedEventIds = Object.freeze(
      requiredCompletedEventIds.map((eventId) => requireIdentifier(
        eventId,
        "STAGE_EVENT_DEPENDENCY_ID_INVALID"
      ))
    );
    invariant(
      new Set(this.requiredCompletedEventIds).size === this.requiredCompletedEventIds.length,
      "STAGE_EVENT_DEPENDENCY_DUPLICATE",
      { eventId: this.id }
    );
    invariant(typeof interruptMovement === "boolean", "STAGE_EVENT_INTERRUPT_INVALID");
    this.interruptMovement = interruptMovement;
    this.presentationRequests = normalizePresentationRequests(presentationRequests);
    this.#requiredCompletedEvents = Object.freeze([]);
    this.#referencesResolved = false;
  }

  resolveReferences(eventsById) {
    invariant(!this.#referencesResolved, "STAGE_EVENT_ALREADY_RESOLVED", { eventId: this.id });
    this.#requiredCompletedEvents = Object.freeze(this.requiredCompletedEventIds.map((eventId) => {
      invariant(eventId !== this.id, "STAGE_EVENT_SELF_DEPENDENCY", { eventId: this.id });
      const event = eventsById.get(eventId);
      invariant(event !== undefined, "STAGE_EVENT_DEPENDENCY_NOT_FOUND", {
        eventId: this.id,
        dependencyId: eventId
      });
      return event;
    }));
    this.#referencesResolved = true;
  }

  get requiredCompletedEvents() {
    invariant(this.#referencesResolved, "STAGE_EVENT_REFERENCES_UNRESOLVED", { eventId: this.id });
    return this.#requiredCompletedEvents;
  }

  canExecute() {
    return false;
  }

  execute() {
    throw new Error("STAGE_EVENT_EXECUTION_NOT_IMPLEMENTED");
  }

  validateRuntime(stage) {
    const stageDialogues = new Set(stage.dialogueManager.getAll());
    for (const request of this.presentationRequests) {
      if (request.type === PresentationRequestType.DIALOGUE) {
        invariant(stageDialogues.has(request.dialogue), "STAGE_EVENT_DIALOGUE_NOT_IN_STAGE", {
          eventId: this.id
        });
      }
    }
    return true;
  }

  createCompletedResult() {
    return createStageEventResult({
      completed: true,
      interruptMovement: this.interruptMovement,
      presentationRequests: this.presentationRequests
    });
  }
}

/**
 * 将来増援として生成済みのUnitを固定順でArmyとMapへ加える。
 */
export class ReinforcementEvent extends StageEvent {
  constructor({
    id,
    trigger = undefined,
    triggers = undefined,
    requiredCompletedEventIds = [],
    deployments,
    targetArmy,
    turnAtLeast = null,
    triggerUnit = null,
    requiredDefeatedUnits = [],
    interruptMovement = false,
    presentationRequests = []
  }) {
    super({
      id,
      type: StageEventType.REINFORCEMENT,
      trigger,
      triggers,
      requiredCompletedEventIds,
      interruptMovement,
      presentationRequests
    });
    invariant(Array.isArray(deployments) && deployments.length > 0, "REINFORCEMENT_DEPLOYMENTS_REQUIRED");
    const deploymentUnits = new Set();
    this.deployments = Object.freeze(deployments.map((deployment) => {
      invariant(
        deployment !== null && typeof deployment === "object" && !Array.isArray(deployment),
        "REINFORCEMENT_DEPLOYMENT_INVALID"
      );
      invariant(deployment.unit instanceof Unit, "REINFORCEMENT_UNIT_INVALID");
      invariant(!deploymentUnits.has(deployment.unit), "REINFORCEMENT_UNIT_DUPLICATE");
      deploymentUnits.add(deployment.unit);
      return Object.freeze({
        unit: deployment.unit,
        preferredPosition: Position.from(deployment.preferredPosition)
      });
    }));
    invariant(targetArmy instanceof Army, "REINFORCEMENT_TARGET_ARMY_REQUIRED");
    this.targetArmy = targetArmy;
    this.turnAtLeast = normalizeOptionalTurn(turnAtLeast, "REINFORCEMENT_TURN_INVALID");
    invariant(triggerUnit === null || triggerUnit instanceof Unit, "REINFORCEMENT_TRIGGER_UNIT_INVALID");
    invariant(
      triggerUnit === null
        || (this.triggers.length === 1 && this.triggers[0] === StageEventTrigger.UNIT_DEFEATED),
      "REINFORCEMENT_TRIGGER_UNIT_CONTEXT_INVALID"
    );
    this.triggerUnit = triggerUnit;
    this.requiredDefeatedUnits = normalizeUnits(requiredDefeatedUnits, "REINFORCEMENT_REQUIRED_DEFEATED");
    Object.freeze(this);
  }

  canExecute(stage, payload = {}) {
    if (this.turnAtLeast !== null && stage.turn < this.turnAtLeast) {
      return false;
    }
    if (this.triggerUnit !== null && payload.unit !== this.triggerUnit) {
      return false;
    }
    return this.requiredDefeatedUnits.every((unit) => !unit.hasTroops());
  }

  execute(stage, payload = {}) {
    invariant(this.canExecute(stage, payload), "REINFORCEMENT_EVENT_NOT_EXECUTABLE");
    const managedArmies = [stage.armyManager.playerArmy, stage.armyManager.enemyArmy];
    invariant(managedArmies.includes(this.targetArmy), "REINFORCEMENT_ARMY_NOT_MANAGED");

    const planned = [];
    const reservedPositionKeys = new Set();
    for (const deployment of this.deployments) {
      const { unit, preferredPosition } = deployment;
      if (!unit.hasTroops()) {
        continue;
      }
      invariant(stage.armyManager.getArmy(unit) === null, "REINFORCEMENT_UNIT_ALREADY_ASSIGNED", {
        unitId: unit.id
      });
      invariant(stage.map.getPosition(unit) === null, "REINFORCEMENT_UNIT_ALREADY_PLACED", {
        unitId: unit.id
      });
      const position = this.#findOpenCellNear(stage, unit, preferredPosition, reservedPositionKeys);
      if (position === null) {
        continue;
      }
      planned.push(Object.freeze({ unit, position }));
      reservedPositionKeys.add(position.toKey());
    }

    for (const deployment of planned) {
      stage.armyManager.addUnit(deployment.unit, this.targetArmy);
      try {
        stage.map.placeUnit(deployment.unit, deployment.position);
      } catch (error) {
        stage.armyManager.removeUnit(deployment.unit);
        throw error;
      }
    }
    return this.createCompletedResult();
  }

  validateRuntime(stage) {
    super.validateRuntime(stage);
    const stageUnits = new Set(stage.getUnits());
    invariant(
      this.deployments.every((deployment) => stageUnits.has(deployment.unit)),
      "STAGE_EVENT_UNIT_NOT_IN_STAGE",
      { eventId: this.id }
    );
    invariant(
      this.deployments.every((deployment) => stage.map.getCellAt(
        deployment.preferredPosition.x,
        deployment.preferredPosition.y
      ) !== null),
      "REINFORCEMENT_POSITION_OUTSIDE",
      { eventId: this.id }
    );
    invariant(
      this.targetArmy === stage.armyManager.playerArmy
        || this.targetArmy === stage.armyManager.enemyArmy,
      "STAGE_EVENT_ARMY_NOT_MANAGED",
      { eventId: this.id }
    );
    invariant(
      this.triggerUnit === null || stageUnits.has(this.triggerUnit),
      "STAGE_EVENT_UNIT_NOT_IN_STAGE",
      { eventId: this.id }
    );
    invariant(
      this.requiredDefeatedUnits.every((unit) => stageUnits.has(unit)),
      "STAGE_EVENT_UNIT_NOT_IN_STAGE",
      { eventId: this.id }
    );
    return true;
  }

  #findOpenCellNear(stage, unit, origin, reservedPositionKeys) {
    for (let radius = 0; radius <= 4; radius += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (Math.abs(dx) + Math.abs(dy) !== radius) {
            continue;
          }
          const x = origin.x + dx;
          const y = origin.y + dy;
          const cell = stage.map.getCellAt(x, y);
          if (cell === null || cell.isOccupied()) {
            continue;
          }
          const positionKey = `${x},${y}`;
          if (reservedPositionKeys.has(positionKey) || !cell.terrain.canEnter(unit)) {
            continue;
          }
          return new Position(x, y);
        }
      }
    }
    return null;
  }
}

/**
 * 生存中の指定Unitを現在Armyから対象Armyへ移す。
 */
export class BetrayalEvent extends StageEvent {
  constructor({
    id,
    trigger = undefined,
    triggers = undefined,
    requiredCompletedEventIds = [],
    units,
    targetArmy,
    turnAtLeast = null,
    newFacing = null,
    confusionTargetArmy = null,
    confusionTurns = 0,
    interruptMovement = false,
    presentationRequests = []
  }) {
    super({
      id,
      type: StageEventType.BETRAYAL,
      trigger,
      triggers,
      requiredCompletedEventIds,
      interruptMovement,
      presentationRequests
    });
    this.units = normalizeUnits(units, "BETRAYAL", false);
    invariant(targetArmy instanceof Army, "BETRAYAL_TARGET_ARMY_REQUIRED");
    this.targetArmy = targetArmy;
    this.turnAtLeast = normalizeOptionalTurn(turnAtLeast, "BETRAYAL_TURN_INVALID");
    this.newFacing = newFacing === null
      ? null
      : requireEnumValue(newFacing, Facing, "BETRAYAL_FACING_INVALID");
    invariant(
      confusionTargetArmy === null || confusionTargetArmy instanceof Army,
      "BETRAYAL_CONFUSION_ARMY_INVALID"
    );
    this.confusionTargetArmy = confusionTargetArmy;
    this.confusionTurns = requireIntegerInRange(
      confusionTurns,
      0,
      Number.MAX_SAFE_INTEGER,
      "BETRAYAL_CONFUSION_TURNS_INVALID"
    );
    invariant(
      (this.confusionTargetArmy === null && this.confusionTurns === 0)
        || (this.confusionTargetArmy !== null && this.confusionTurns > 0),
      "BETRAYAL_CONFUSION_CONFIG_INVALID"
    );
    Object.freeze(this);
  }

  canExecute(stage) {
    return this.turnAtLeast === null || stage.turn >= this.turnAtLeast;
  }

  execute(stage) {
    invariant(this.canExecute(stage), "BETRAYAL_EVENT_NOT_EXECUTABLE");
    const managedArmies = [stage.armyManager.playerArmy, stage.armyManager.enemyArmy];
    invariant(managedArmies.includes(this.targetArmy), "BETRAYAL_ARMY_NOT_MANAGED");
    invariant(
      this.confusionTargetArmy === null || managedArmies.includes(this.confusionTargetArmy),
      "BETRAYAL_CONFUSION_ARMY_NOT_MANAGED"
    );

    for (const unit of this.units) {
      if (!unit.hasTroops()) {
        continue;
      }
      invariant(stage.armyManager.getArmy(unit) !== null, "BETRAYAL_UNIT_NOT_ASSIGNED", {
        unitId: unit.id
      });
    }

    for (const unit of this.units) {
      if (!unit.hasTroops()) {
        continue;
      }
      stage.armyManager.transferUnit(unit, this.targetArmy);
      if (this.newFacing !== null) {
        unit.setFacing(this.newFacing);
      }
    }

    if (this.confusionTargetArmy !== null) {
      for (const unit of this.confusionTargetArmy.getUnits()) {
        if (!unit.hasTroops()) {
          continue;
        }
        unit.setStatus(
          UnitStatus.CONFUSED,
          Math.max(unit.getStatusTurns(UnitStatus.CONFUSED), this.confusionTurns)
        );
      }
    }
    return this.createCompletedResult();
  }

  validateRuntime(stage) {
    super.validateRuntime(stage);
    const stageUnits = new Set(stage.getUnits());
    invariant(
      this.units.every((unit) => stageUnits.has(unit)),
      "STAGE_EVENT_UNIT_NOT_IN_STAGE",
      { eventId: this.id }
    );
    const managedArmies = [stage.armyManager.playerArmy, stage.armyManager.enemyArmy];
    invariant(managedArmies.includes(this.targetArmy), "STAGE_EVENT_ARMY_NOT_MANAGED", {
      eventId: this.id
    });
    invariant(
      this.confusionTargetArmy === null || managedArmies.includes(this.confusionTargetArmy),
      "STAGE_EVENT_ARMY_NOT_MANAGED",
      { eventId: this.id }
    );
    return true;
  }
}

/**
 * Unit状態から任務段階の完了だけを確定する。
 */
export class MissionTransitionEvent extends StageEvent {
  constructor({
    id,
    trigger = undefined,
    triggers = undefined,
    requiredCompletedEventIds = [],
    requiredDefeatedUnits = [],
    turnAtLeast = null,
    interruptMovement = false,
    presentationRequests = []
  }) {
    super({
      id,
      type: StageEventType.MISSION_TRANSITION,
      trigger,
      triggers,
      requiredCompletedEventIds,
      interruptMovement,
      presentationRequests
    });
    this.requiredDefeatedUnits = normalizeUnits(
      requiredDefeatedUnits,
      "MISSION_TRANSITION_REQUIRED_DEFEATED"
    );
    this.turnAtLeast = normalizeOptionalTurn(turnAtLeast, "MISSION_TRANSITION_TURN_INVALID");
    Object.freeze(this);
  }

  canExecute(stage) {
    if (this.turnAtLeast !== null && stage.turn < this.turnAtLeast) {
      return false;
    }
    return this.requiredDefeatedUnits.every((unit) => !unit.hasTroops());
  }

  execute(stage) {
    invariant(this.canExecute(stage), "MISSION_TRANSITION_EVENT_NOT_EXECUTABLE");
    return this.createCompletedResult();
  }

  validateRuntime(stage) {
    super.validateRuntime(stage);
    const stageUnits = new Set(stage.getUnits());
    invariant(
      this.requiredDefeatedUnits.every((unit) => stageUnits.has(unit)),
      "STAGE_EVENT_UNIT_NOT_IN_STAGE",
      { eventId: this.id }
    );
    return true;
  }
}

/**
 * 一度きりのDialogue/Noticeを具体trigger条件で発行する。
 */
export class DialogueEvent extends StageEvent {
  constructor({
    id,
    trigger = undefined,
    triggers = undefined,
    requiredCompletedEventIds = [],
    trapKinds = [],
    triggerUnit = null,
    turnAtLeast = null,
    interruptMovement = false,
    presentationRequests = []
  }) {
    super({
      id,
      type: StageEventType.DIALOGUE,
      trigger,
      triggers,
      requiredCompletedEventIds,
      interruptMovement,
      presentationRequests
    });
    invariant(presentationRequests.length > 0, "DIALOGUE_EVENT_PRESENTATION_REQUIRED");
    invariant(Array.isArray(trapKinds), "DIALOGUE_EVENT_TRAP_KINDS_INVALID");
    this.trapKinds = Object.freeze(trapKinds.map((kind) => requireNonEmptyString(
      kind,
      "DIALOGUE_EVENT_TRAP_KIND_INVALID"
    )));
    invariant(new Set(this.trapKinds).size === this.trapKinds.length, "DIALOGUE_EVENT_TRAP_KIND_DUPLICATE");
    invariant(
      this.trapKinds.length === 0
        || (this.triggers.length === 1 && this.triggers[0] === StageEventTrigger.TRAP_TRIGGERED),
      "DIALOGUE_EVENT_TRAP_CONTEXT_INVALID"
    );
    invariant(triggerUnit === null || triggerUnit instanceof Unit, "DIALOGUE_EVENT_TRIGGER_UNIT_INVALID");
    this.triggerUnit = triggerUnit;
    this.turnAtLeast = normalizeOptionalTurn(turnAtLeast, "DIALOGUE_EVENT_TURN_INVALID");
    Object.freeze(this);
  }

  canExecute(stage, payload = {}) {
    if (this.turnAtLeast !== null && stage.turn < this.turnAtLeast) {
      return false;
    }
    if (this.triggerUnit !== null && payload.unit !== this.triggerUnit) {
      return false;
    }
    if (this.trapKinds.length > 0) {
      if (!(payload.trap instanceof HiddenTrap)) {
        return false;
      }
      if (!this.trapKinds.includes(payload.trap.kind)) {
        return false;
      }
    }
    return true;
  }

  execute(stage, payload = {}) {
    invariant(this.canExecute(stage, payload), "DIALOGUE_EVENT_NOT_EXECUTABLE");
    return this.createCompletedResult();
  }

  validateRuntime(stage) {
    super.validateRuntime(stage);
    if (this.triggerUnit !== null) {
      invariant(stage.getUnits().includes(this.triggerUnit), "STAGE_EVENT_UNIT_NOT_IN_STAGE", {
        eventId: this.id
      });
    }
    return true;
  }
}

/**
 * Definition順と完了IDを保持し、依存循環とfixed-point連鎖を管理する。
 */
export class StageEventManager {
  #events;
  #eventsById;
  #completedEventIds;

  constructor(events = []) {
    invariant(Array.isArray(events), "STAGE_EVENTS_ARRAY_REQUIRED");
    this.#events = Object.freeze([...events]);
    this.#eventsById = new Map();
    this.#completedEventIds = new Set();

    for (const event of this.#events) {
      invariant(event instanceof StageEvent, "STAGE_EVENT_INSTANCE_REQUIRED");
      invariant(!this.#eventsById.has(event.id), "STAGE_EVENT_ID_DUPLICATE", { eventId: event.id });
      this.#eventsById.set(event.id, event);
    }
    for (const event of this.#events) {
      event.resolveReferences(this.#eventsById);
    }
    this.#validateNoCycles();
  }

  get(eventId) {
    const event = this.#eventsById.get(eventId);
    invariant(event !== undefined, "STAGE_EVENT_NOT_FOUND", { eventId });
    return event;
  }

  has(eventId) {
    return this.#eventsById.has(eventId);
  }

  getAll() {
    return this.#events;
  }

  getByTrigger(trigger) {
    requireEnumValue(trigger, StageEventTrigger, "STAGE_EVENT_TRIGGER_INVALID");
    return Object.freeze(this.#events.filter((event) => event.triggers.includes(trigger)));
  }

  isCompleted(eventOrId) {
    const eventId = eventOrId instanceof StageEvent ? eventOrId.id : eventOrId;
    return this.#completedEventIds.has(eventId);
  }

  markCompleted(event) {
    invariant(event instanceof StageEvent && this.#eventsById.get(event.id) === event, "STAGE_EVENT_NOT_MANAGED");
    invariant(!this.#completedEventIds.has(event.id), "STAGE_EVENT_ALREADY_COMPLETED", { eventId: event.id });
    this.#completedEventIds.add(event.id);
  }

  resolveChain({
    trigger,
    stage,
    payload = {},
    afterEventCompleted = () => false
  }) {
    requireEnumValue(trigger, StageEventTrigger, "STAGE_EVENT_TRIGGER_INVALID");
    invariant(stage?.eventManager === this, "STAGE_EVENT_MANAGER_STAGE_MISMATCH");
    invariant(
      payload !== null && typeof payload === "object" && !Array.isArray(payload),
      "STAGE_EVENT_PAYLOAD_INVALID"
    );
    invariant(typeof afterEventCompleted === "function", "STAGE_EVENT_CALLBACK_INVALID");

    const completedEvents = [];
    const presentationRequests = [];
    const attemptedWithoutCompletion = new Set();
    let interruptMovement = false;
    let stopped = false;

    while (!stopped) {
      const event = this.#findNextExecutable(
        trigger,
        stage,
        payload,
        attemptedWithoutCompletion
      );
      if (event === null) {
        break;
      }

      const result = normalizeEventResult(event.execute(stage, payload));
      if (!result.completed) {
        attemptedWithoutCompletion.add(event);
        continue;
      }

      this.markCompleted(event);
      completedEvents.push(event);
      presentationRequests.push(...result.presentationRequests);
      interruptMovement ||= result.interruptMovement;
      attemptedWithoutCompletion.clear();

      const shouldStop = afterEventCompleted(event, result) === true;
      if (shouldStop) {
        stopped = true;
      }
    }

    return Object.freeze({
      completedEvents: Object.freeze(completedEvents),
      interruptMovement,
      presentationRequests: Object.freeze(presentationRequests),
      stopped
    });
  }

  restoreCompletedEventIds(eventIds) {
    invariant(Array.isArray(eventIds), "COMPLETED_EVENT_IDS_ARRAY_REQUIRED");
    const restored = new Set();
    for (const eventId of eventIds) {
      requireIdentifier(eventId, "COMPLETED_EVENT_ID_INVALID");
      invariant(this.#eventsById.has(eventId), "COMPLETED_EVENT_ID_UNKNOWN", { eventId });
      invariant(!restored.has(eventId), "COMPLETED_EVENT_ID_DUPLICATE", { eventId });
      restored.add(eventId);
    }
    this.#completedEventIds = restored;
  }

  getCompletedEventIds() {
    return Object.freeze(this.#events
      .filter((event) => this.#completedEventIds.has(event.id))
      .map((event) => event.id));
  }

  #findNextExecutable(trigger, stage, payload, attemptedWithoutCompletion) {
    for (const event of this.#events) {
      if (
        !event.triggers.includes(trigger)
        || this.isCompleted(event)
        || attemptedWithoutCompletion.has(event)
      ) {
        continue;
      }
      if (!event.requiredCompletedEvents.every((dependency) => this.isCompleted(dependency))) {
        continue;
      }
      if (event.canExecute(stage, payload)) {
        return event;
      }
    }
    return null;
  }

  #validateNoCycles() {
    const states = new Map();

    const visit = (event) => {
      const state = states.get(event) ?? "UNVISITED";
      invariant(state !== "VISITING", "STAGE_EVENT_DEPENDENCY_CYCLE", { eventId: event.id });
      if (state === "VISITED") {
        return;
      }
      states.set(event, "VISITING");
      for (const dependency of event.requiredCompletedEvents) {
        visit(dependency);
      }
      states.set(event, "VISITED");
    };

    for (const event of this.#events) {
      visit(event);
    }
  }
}
