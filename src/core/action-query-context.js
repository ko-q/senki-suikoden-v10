import { invariant } from "./domain-error.js";
import { Position } from "../domain/position.js";
import { Unit } from "../domain/unit.js";

/**
 * 実位置を変えずにPreview先から行動を照会する一時DTO。
 */
export function createActionQueryContext(actor, originPosition) {
  invariant(actor instanceof Unit, "ACTION_QUERY_ACTOR_REQUIRED");
  return Object.freeze({
    actor,
    originPosition: Position.from(originPosition)
  });
}
