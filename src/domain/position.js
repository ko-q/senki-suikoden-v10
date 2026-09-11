import { invariant, requireIntegerInRange } from "../core/domain-error.js";

/**
 * 盤面座標を表すimmutable value object。
 */
export class Position {
  constructor(x, y) {
    this.x = requireIntegerInRange(x, 0, Number.MAX_SAFE_INTEGER, "POSITION_X_INVALID");
    this.y = requireIntegerInRange(y, 0, Number.MAX_SAFE_INTEGER, "POSITION_Y_INVALID");
    Object.freeze(this);
  }

  static from(value) {
    invariant(value !== null && typeof value === "object", "POSITION_REQUIRED");
    return new Position(value.x, value.y);
  }

  equals(other) {
    return other instanceof Position && this.x === other.x && this.y === other.y;
  }

  manhattanDistanceTo(other) {
    invariant(other instanceof Position, "POSITION_DISTANCE_TARGET_REQUIRED");
    return Math.abs(this.x - other.x) + Math.abs(this.y - other.y);
  }

  toKey() {
    return `${this.x},${this.y}`;
  }
}

export function comparePositionsByRowThenColumn(left, right) {
  if (left.y !== right.y) {
    return left.y - right.y;
  }
  return left.x - right.x;
}
