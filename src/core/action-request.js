import { invariant, requireEnumValue } from "./domain-error.js";
import { Unit } from "../domain/unit.js";

export const ActionType = Object.freeze({
  NORMAL_ATTACK: "NORMAL_ATTACK",
  BOW_ATTACK: "BOW_ATTACK",
  CHARGE: "CHARGE",
  CONFUSION_LV1: "CONFUSION_LV1",
  CONFUSION_LV2: "CONFUSION_LV2",
  CONFUSION_LV3: "CONFUSION_LV3",
  ILLUSION: "ILLUSION",
  WIDE_ILLUSION: "WIDE_ILLUSION",
  FIRE: "FIRE",
  WATER: "WATER"
});

export const COMBAT_ACTION_TYPES = Object.freeze([
  ActionType.NORMAL_ATTACK,
  ActionType.BOW_ATTACK,
  ActionType.CHARGE
]);

export const TACTIC_ACTION_TYPES = Object.freeze([
  ActionType.CONFUSION_LV1,
  ActionType.CONFUSION_LV2,
  ActionType.CONFUSION_LV3,
  ActionType.ILLUSION,
  ActionType.WIDE_ILLUSION,
  ActionType.FIRE,
  ActionType.WATER
]);

/**
 * Controller、UI、AIの境界で共有する最小ActionRequestを生成する。
 * WIDE_ILLUSIONは対象選択を持たないためactor自身をtargetとして渡す。
 */
export function createActionRequest(type, actor, target) {
  requireEnumValue(type, ActionType, "ACTION_TYPE_INVALID");
  invariant(actor instanceof Unit, "ACTION_ACTOR_REQUIRED");
  invariant(target instanceof Unit, "ACTION_TARGET_REQUIRED");
  return Object.freeze({ type, actor, target });
}
