import { invariant } from "../core/domain-error.js";
import { Position } from "../domain/position.js";
import { Stage } from "../domain/stage.js";
import { Facing, Unit } from "../domain/unit.js";

export function manhattanDistance(left, right) {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

/**
 * v10承認仕様の45度tie東西優先で向きを求める。
 */
export function directionBetween(from, to) {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) {
    return deltaX >= 0 ? Facing.EAST : Facing.WEST;
  }
  return deltaY >= 0 ? Facing.SOUTH : Facing.NORTH;
}

export function oppositeFacing(facing) {
  if (facing === Facing.NORTH) {
    return Facing.SOUTH;
  }
  if (facing === Facing.SOUTH) {
    return Facing.NORTH;
  }
  if (facing === Facing.EAST) {
    return Facing.WEST;
  }
  return Facing.EAST;
}

/**
 * v9.7.75と同じ格子線判定。角に触れるだけの城壁は遮断扱いにしない。
 */
export function hasClearLineOfSight(stage, sourceValue, targetValue) {
  invariant(stage instanceof Stage, "TARGETING_STAGE_REQUIRED");
  const source = Position.from(sourceValue);
  const target = Position.from(targetValue);
  if (
    stage.map.getCellAt(source.x, source.y) === null
    || stage.map.getCellAt(target.x, target.y) === null
  ) {
    return false;
  }

  const deltaX = target.x - source.x;
  const deltaY = target.y - source.y;
  const stepCountX = Math.abs(deltaX);
  const stepCountY = Math.abs(deltaY);
  const stepX = Math.sign(deltaX);
  const stepY = Math.sign(deltaY);
  let x = source.x;
  let y = source.y;
  let progressedX = 0;
  let progressedY = 0;

  while (progressedX < stepCountX || progressedY < stepCountY) {
    const decision = (1 + 2 * progressedX) * stepCountY
      - (1 + 2 * progressedY) * stepCountX;

    if (decision === 0) {
      x += stepX;
      y += stepY;
      progressedX += 1;
      progressedY += 1;
    } else if (decision < 0) {
      x += stepX;
      progressedX += 1;
    } else {
      y += stepY;
      progressedY += 1;
    }

    if (x === target.x && y === target.y) {
      break;
    }
    if (stage.map.getCellAt(x, y).terrain.id === "wall") {
      return false;
    }
  }
  return true;
}

export function isUnitInStage(unit, stage) {
  return unit instanceof Unit
    && stage instanceof Stage
    && stage.getUnits().includes(unit);
}

export function isPlacedLivingUnit(unit, stage) {
  return isUnitInStage(unit, stage)
    && unit.hasTroops()
    && stage.map.getPosition(unit) !== null
    && stage.armyManager.getArmy(unit) !== null;
}

export function getQueryOrigin(actor, stage, actionQueryContext = null) {
  if (!isPlacedLivingUnit(actor, stage)) {
    return null;
  }
  if (actionQueryContext === null) {
    return stage.map.getPosition(actor);
  }
  invariant(
    actionQueryContext !== null
    && typeof actionQueryContext === "object"
    && actionQueryContext.actor === actor,
    "ACTION_QUERY_CONTEXT_MISMATCH"
  );
  const origin = Position.from(actionQueryContext.originPosition);
  if (stage.map.getCellAt(origin.x, origin.y) === null) {
    return null;
  }
  return origin;
}

export function getLivingUnitsInOrder(stage) {
  invariant(stage instanceof Stage, "TARGETING_STAGE_REQUIRED");
  return stage.unitOrder.filter((unit) => isPlacedLivingUnit(unit, stage));
}

export function getUnitPosition(stage, unit) {
  if (!isPlacedLivingUnit(unit, stage)) {
    return null;
  }
  return stage.map.getPosition(unit);
}
