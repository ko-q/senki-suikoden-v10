import { invariant } from "../core/domain-error.js";
import { StageEvent, StageEventManager } from "./stage-event.js";
import { Unit } from "./unit.js";

/**
 * Unit本体を汚さずに非行動・Event待ちを表すruntime rule。
 */
export class UnitControlRule {
  constructor({
    unit,
    alwaysInactive = false,
    inactiveUntilEvent = null,
    activateOnCompletionDuringOwnPhase = false,
    actionLabel = undefined
  }) {
    invariant(unit instanceof Unit, "UNIT_CONTROL_UNIT_REQUIRED");
    invariant(typeof alwaysInactive === "boolean", "UNIT_CONTROL_ALWAYS_INACTIVE_INVALID");
    invariant(
      inactiveUntilEvent === null || inactiveUntilEvent instanceof StageEvent,
      "UNIT_CONTROL_EVENT_INVALID"
    );
    invariant(
      typeof activateOnCompletionDuringOwnPhase === "boolean",
      "UNIT_CONTROL_ACTIVATION_INVALID"
    );
    invariant(!(alwaysInactive && inactiveUntilEvent !== null), "UNIT_CONTROL_RULE_CONFLICT");

    this.unit = unit;
    this.alwaysInactive = alwaysInactive;
    this.inactiveUntilEvent = inactiveUntilEvent;
    this.activateOnCompletionDuringOwnPhase = activateOnCompletionDuringOwnPhase;
    this.actionLabel = actionLabel === undefined ? undefined : String(actionLabel);
    Object.freeze(this);
  }

  canAct(eventManager) {
    invariant(eventManager instanceof StageEventManager, "UNIT_CONTROL_EVENT_MANAGER_REQUIRED");
    if (this.alwaysInactive) {
      return false;
    }
    if (this.inactiveUntilEvent === null) {
      return true;
    }
    return eventManager.isCompleted(this.inactiveUntilEvent);
  }
}
