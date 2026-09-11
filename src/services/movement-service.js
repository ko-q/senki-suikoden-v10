import { invariant, requireIntegerInRange } from "../core/domain-error.js";
import { Position, comparePositionsByRowThenColumn } from "../domain/position.js";
import { Stage } from "../domain/stage.js";
import { Unit } from "../domain/unit.js";

const MAX_CANDIDATE_PATHS = 3;

class MinPriorityQueue {
  #values;
  #compare;

  constructor(compare) {
    this.#values = [];
    this.#compare = compare;
  }

  get size() {
    return this.#values.length;
  }

  enqueue(value) {
    this.#values.push(value);
    let index = this.#values.length - 1;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.#compare(this.#values[parentIndex], this.#values[index]) <= 0) {
        break;
      }
      [this.#values[parentIndex], this.#values[index]] = [
        this.#values[index],
        this.#values[parentIndex]
      ];
      index = parentIndex;
    }
  }

  dequeue() {
    invariant(this.#values.length > 0, "PRIORITY_QUEUE_EMPTY");
    const first = this.#values[0];
    const last = this.#values.pop();
    if (this.#values.length === 0) {
      return first;
    }
    this.#values[0] = last;
    let index = 0;

    while (true) {
      const leftIndex = index * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = index;
      if (
        leftIndex < this.#values.length
        && this.#compare(this.#values[leftIndex], this.#values[smallestIndex]) < 0
      ) {
        smallestIndex = leftIndex;
      }
      if (
        rightIndex < this.#values.length
        && this.#compare(this.#values[rightIndex], this.#values[smallestIndex]) < 0
      ) {
        smallestIndex = rightIndex;
      }
      if (smallestIndex === index) {
        break;
      }
      [this.#values[index], this.#values[smallestIndex]] = [
        this.#values[smallestIndex],
        this.#values[index]
      ];
      index = smallestIndex;
    }
    return first;
  }
}

function comparePathPositions(leftPath, rightPath) {
  const sharedLength = Math.min(leftPath.length, rightPath.length);
  for (let index = 0; index < sharedLength; index += 1) {
    const comparison = comparePositionsByRowThenColumn(leftPath[index], rightPath[index]);
    if (comparison !== 0) {
      return comparison;
    }
  }
  return leftPath.length - rightPath.length;
}

function comparePathNodes(left, right) {
  if (left.cost !== right.cost) {
    return left.cost - right.cost;
  }
  if (left.path.length !== right.path.length) {
    return left.path.length - right.path.length;
  }
  return comparePathPositions(left.path, right.path);
}

function compareReachableEntries(left, right) {
  if (left.cost !== right.cost) {
    return left.cost - right.cost;
  }
  return comparePositionsByRowThenColumn(left.position, right.position);
}

function freezePath(path) {
  return Object.freeze(path.map((position) => new Position(position.x, position.y)));
}

/**
 * 移動可能範囲と経路を照会するpure service。Domainを一切変更しない。
 */
export class MovementService {
  getReachableCells(unit, stage) {
    const origin = this.#requirePlacedLivingUnit(unit, stage);
    const bestCosts = new Map([[origin.toKey(), 0]]);
    const queue = new MinPriorityQueue((left, right) => {
      if (left.cost !== right.cost) {
        return left.cost - right.cost;
      }
      return comparePositionsByRowThenColumn(left.position, right.position);
    });
    queue.enqueue({ position: origin, cost: 0 });

    while (queue.size > 0) {
      const current = queue.dequeue();
      if (bestCosts.get(current.position.toKey()) !== current.cost) {
        continue;
      }

      for (const neighbor of this.#neighbors(current.position, stage)) {
        const cell = stage.map.getCellAt(neighbor.x, neighbor.y);
        if (!this.#isTraversable(unit, cell)) {
          continue;
        }
        const nextCost = current.cost + cell.terrain.getMoveCost(unit);
        if (nextCost > unit.move) {
          continue;
        }
        const key = neighbor.toKey();
        const previousCost = bestCosts.get(key);
        if (previousCost !== undefined && previousCost <= nextCost) {
          continue;
        }
        bestCosts.set(key, nextCost);
        queue.enqueue({ position: neighbor, cost: nextCost });
      }
    }

    bestCosts.delete(origin.toKey());
    return Object.freeze(
      [...bestCosts.entries()]
        .map(([key, cost]) => {
          const [x, y] = key.split(",").map(Number);
          return Object.freeze({ position: new Position(x, y), cost });
        })
        .sort(compareReachableEntries)
    );
  }

  getCandidatePaths(unit, destinationValue, stage, limit = MAX_CANDIDATE_PATHS) {
    const origin = this.#requirePlacedLivingUnit(unit, stage);
    requireIntegerInRange(limit, 1, MAX_CANDIDATE_PATHS, "MOVEMENT_PATH_LIMIT_INVALID");
    const destination = Position.from(destinationValue);
    const destinationCell = stage.map.getCellAt(destination.x, destination.y);
    if (destinationCell === null) {
      return Object.freeze([]);
    }
    if (destination.equals(origin)) {
      return Object.freeze([Object.freeze([])]);
    }
    if (!this.#isTraversable(unit, destinationCell)) {
      return Object.freeze([]);
    }

    const directDistance = Math.abs(destination.x - origin.x) + Math.abs(destination.y - origin.y);
    if (directDistance === 1) {
      const validation = this.validatePath(unit, [destination], stage);
      return validation.valid
        ? Object.freeze([freezePath([destination])])
        : Object.freeze([]);
    }

    const lowerBounds = this.#createLowerBounds(unit, destination, stage);
    const originLowerBound = lowerBounds.get(origin.toKey());
    if (originLowerBound === undefined || originLowerBound > unit.move) {
      return Object.freeze([]);
    }

    const queue = new MinPriorityQueue(comparePathNodes);
    queue.enqueue({
      position: origin,
      path: [],
      cost: 0,
      visitedKeys: new Set([origin.toKey()])
    });
    const candidates = [];

    while (queue.size > 0 && candidates.length < limit) {
      const current = queue.dequeue();
      if (current.position.equals(destination)) {
        candidates.push(freezePath(current.path));
        continue;
      }

      for (const neighbor of this.#neighbors(current.position, stage)) {
        const key = neighbor.toKey();
        if (current.visitedKeys.has(key)) {
          continue;
        }
        const cell = stage.map.getCellAt(neighbor.x, neighbor.y);
        if (!this.#isTraversable(unit, cell)) {
          continue;
        }
        const nextCost = current.cost + cell.terrain.getMoveCost(unit);
        const lowerBound = lowerBounds.get(key);
        if (
          nextCost > unit.move
          || lowerBound === undefined
          || nextCost + lowerBound > unit.move
        ) {
          continue;
        }
        const nextVisitedKeys = new Set(current.visitedKeys);
        nextVisitedKeys.add(key);
        queue.enqueue({
          position: neighbor,
          path: [...current.path, neighbor],
          cost: nextCost,
          visitedKeys: nextVisitedKeys
        });
      }
    }

    return Object.freeze(candidates);
  }

  /**
   * v9敵AIと同じN/E/S/W展開順で、移動力上限を掛けない最短経路を返す。
   */
  findPathToCell(unit, destinationValue, stage) {
    const origin = this.#requirePlacedLivingUnit(unit, stage);
    const destination = Position.from(destinationValue);
    const destinationCell = stage.map.getCellAt(destination.x, destination.y);
    if (
      destinationCell === null
      || destinationCell.isOccupied()
      || destination.equals(origin)
      || !destinationCell.terrain.canEnter(unit)
    ) {
      return Object.freeze([]);
    }
    const search = this.#findV9CompatiblePaths(unit, stage);
    return this.#reconstructPath(origin, destination, search.parents, search.costs);
  }

  /**
   * v9敵AIと同じ全盤面Dijkstraで、対象に隣接する最小cost経路を返す。
   */
  findPathToAdjacent(unit, target, stage) {
    const origin = this.#requirePlacedLivingUnit(unit, stage);
    invariant(target instanceof Unit, "MOVEMENT_TARGET_REQUIRED");
    invariant(stage.getUnits().includes(target), "MOVEMENT_TARGET_NOT_IN_STAGE");
    invariant(target.hasTroops(), "MOVEMENT_TARGET_DEFEATED");
    const targetPosition = stage.map.getPosition(target);
    invariant(targetPosition !== null, "MOVEMENT_TARGET_NOT_PLACED");
    const search = this.#findV9CompatiblePaths(unit, stage);
    let destination = null;
    let bestCost = Number.POSITIVE_INFINITY;

    for (const candidate of this.#v9Neighbors(targetPosition, stage)) {
      const cell = stage.map.getCellAt(candidate.x, candidate.y);
      const cost = search.costs.get(candidate.toKey());
      if (
        cost === undefined
        || (cell.occupant !== null && cell.occupant !== unit)
        || cost >= bestCost
      ) {
        continue;
      }
      destination = candidate;
      bestCost = cost;
    }
    if (destination === null) {
      return Object.freeze([]);
    }
    return this.#reconstructPath(origin, destination, search.parents, search.costs);
  }

  /**
   * v9敵AIのcalcReachableと同じ探索・挿入順で移動可能cellを返す。
   */
  getReachableCellsInV9SearchOrder(unit, stage) {
    const origin = this.#requirePlacedLivingUnit(unit, stage);
    const costs = new Map([[origin.toKey(), 0]]);
    const open = [{ position: origin, cost: 0 }];

    while (open.length > 0) {
      open.sort((left, right) => left.cost - right.cost);
      const current = open.shift();
      for (const neighbor of this.#v9Neighbors(current.position, stage)) {
        const cell = stage.map.getCellAt(neighbor.x, neighbor.y);
        if (!this.#isTraversable(unit, cell)) {
          continue;
        }
        const nextCost = current.cost + cell.terrain.getMoveCost(unit);
        if (nextCost > unit.move) {
          continue;
        }
        const key = neighbor.toKey();
        const previousCost = costs.get(key) ?? Number.POSITIVE_INFINITY;
        if (nextCost >= previousCost) {
          continue;
        }
        costs.set(key, nextCost);
        open.push({ position: neighbor, cost: nextCost });
      }
    }

    costs.delete(origin.toKey());
    return Object.freeze([...costs.entries()].map(([key, cost]) => {
      const [x, y] = key.split(",").map(Number);
      return Object.freeze({ position: new Position(x, y), cost });
    }));
  }

  /**
   * Unit占有を無視し、仮位置から対象隣接cellまでの最小地形costを返す。
   */
  getMinimumCostToAdjacentIgnoringUnits(unit, originValue, target, stage) {
    this.#requirePlacedLivingUnit(unit, stage);
    invariant(target instanceof Unit, "MOVEMENT_TARGET_REQUIRED");
    invariant(stage.getUnits().includes(target), "MOVEMENT_TARGET_NOT_IN_STAGE");
    invariant(target.hasTroops(), "MOVEMENT_TARGET_DEFEATED");
    const origin = Position.from(originValue);
    const originCell = stage.map.getCellAt(origin.x, origin.y);
    const targetPosition = stage.map.getPosition(target);
    invariant(originCell !== null, "MOVEMENT_ORIGIN_OUTSIDE");
    invariant(originCell.terrain.canEnter(unit), "MOVEMENT_ORIGIN_TERRAIN_FORBIDDEN");
    invariant(targetPosition !== null, "MOVEMENT_TARGET_NOT_PLACED");

    const costs = new Map([[origin.toKey(), 0]]);
    const open = [{ position: origin, cost: 0 }];
    while (open.length > 0) {
      open.sort((left, right) => left.cost - right.cost);
      const current = open.shift();
      if (current.cost !== costs.get(current.position.toKey())) {
        continue;
      }
      for (const neighbor of this.#v9Neighbors(current.position, stage)) {
        const cell = stage.map.getCellAt(neighbor.x, neighbor.y);
        if (!cell.terrain.canEnter(unit)) {
          continue;
        }
        const nextCost = current.cost + cell.terrain.getMoveCost(unit);
        const key = neighbor.toKey();
        const previousCost = costs.get(key) ?? Number.POSITIVE_INFINITY;
        if (nextCost >= previousCost) {
          continue;
        }
        costs.set(key, nextCost);
        open.push({ position: neighbor, cost: nextCost });
      }
    }

    let minimum = Number.POSITIVE_INFINITY;
    for (const adjacent of this.#v9Neighbors(targetPosition, stage)) {
      const cost = costs.get(adjacent.toKey());
      if (cost !== undefined && cost < minimum) {
        minimum = cost;
      }
    }
    return minimum;
  }

  validatePath(unit, path, stage) {
    const origin = this.#requirePlacedLivingUnit(unit, stage);
    return this.#validateFrom(unit, origin, path, stage);
  }

  validateRemainingPath(unit, remainingPath, stage) {
    const currentPosition = this.#requirePlacedLivingUnit(unit, stage);
    return this.#validateFrom(unit, currentPosition, remainingPath, stage);
  }

  #findV9CompatiblePaths(unit, stage) {
    const origin = stage.map.getPosition(unit);
    const costs = new Map([[origin.toKey(), 0]]);
    const parents = new Map();
    const open = [{ position: origin, cost: 0 }];

    while (open.length > 0) {
      open.sort((left, right) => left.cost - right.cost);
      const current = open.shift();
      if (current.cost !== costs.get(current.position.toKey())) {
        continue;
      }
      for (const neighbor of this.#v9Neighbors(current.position, stage)) {
        const cell = stage.map.getCellAt(neighbor.x, neighbor.y);
        if (!this.#isTraversable(unit, cell)) {
          continue;
        }
        const nextCost = current.cost + cell.terrain.getMoveCost(unit);
        const key = neighbor.toKey();
        const previousCost = costs.get(key) ?? Number.POSITIVE_INFINITY;
        if (nextCost >= previousCost) {
          continue;
        }
        costs.set(key, nextCost);
        parents.set(key, current.position);
        open.push({ position: neighbor, cost: nextCost });
      }
    }
    return { costs, parents };
  }

  #reconstructPath(origin, destination, parents, costs) {
    if (!costs.has(destination.toKey())) {
      return Object.freeze([]);
    }
    const path = [];
    let current = destination;
    while (!current.equals(origin)) {
      path.push(current);
      const parent = parents.get(current.toKey());
      if (parent === undefined) {
        return Object.freeze([]);
      }
      current = parent;
    }
    path.reverse();
    return freezePath(path);
  }

  #v9Neighbors(position, stage) {
    return [
      { x: position.x, y: position.y - 1 },
      { x: position.x + 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x - 1, y: position.y }
    ]
      .filter((candidate) => stage.map.getCellAt(candidate.x, candidate.y) !== null)
      .map((candidate) => new Position(candidate.x, candidate.y));
  }

  #validateFrom(unit, origin, path, stage) {
    if (!Array.isArray(path)) {
      return Object.freeze({ valid: false, cost: 0, reason: "PATH_ARRAY_REQUIRED" });
    }
    let previous = origin;
    let cost = 0;
    const visitedKeys = new Set([origin.toKey()]);

    for (const value of path) {
      let position;
      try {
        position = Position.from(value);
      } catch (error) {
        return Object.freeze({ valid: false, cost, reason: "PATH_POSITION_INVALID" });
      }
      const distance = Math.abs(position.x - previous.x) + Math.abs(position.y - previous.y);
      if (distance !== 1) {
        return Object.freeze({ valid: false, cost, reason: "PATH_STEP_NOT_ADJACENT" });
      }
      if (visitedKeys.has(position.toKey())) {
        return Object.freeze({ valid: false, cost, reason: "PATH_REVISITS_CELL" });
      }
      const cell = stage.map.getCellAt(position.x, position.y);
      if (cell === null) {
        return Object.freeze({ valid: false, cost, reason: "PATH_OUTSIDE_MAP" });
      }
      if (!this.#isTraversable(unit, cell)) {
        return Object.freeze({ valid: false, cost, reason: "PATH_CELL_BLOCKED" });
      }
      cost += cell.terrain.getMoveCost(unit);
      if (cost > unit.move) {
        return Object.freeze({ valid: false, cost, reason: "PATH_ALLOWANCE_EXCEEDED" });
      }
      visitedKeys.add(position.toKey());
      previous = position;
    }
    return Object.freeze({ valid: true, cost, reason: null });
  }

  #createLowerBounds(unit, destination, stage) {
    const distances = new Map([[destination.toKey(), 0]]);
    const queue = new MinPriorityQueue((left, right) => {
      if (left.cost !== right.cost) {
        return left.cost - right.cost;
      }
      return comparePositionsByRowThenColumn(left.position, right.position);
    });
    queue.enqueue({ position: destination, cost: 0 });

    while (queue.size > 0) {
      const current = queue.dequeue();
      if (distances.get(current.position.toKey()) !== current.cost) {
        continue;
      }
      const currentCell = stage.map.getCellAt(current.position.x, current.position.y);
      for (const predecessor of this.#neighbors(current.position, stage)) {
        const predecessorCell = stage.map.getCellAt(predecessor.x, predecessor.y);
        if (!this.#isTraversable(unit, predecessorCell)) {
          continue;
        }
        const nextCost = current.cost + currentCell.terrain.getMoveCost(unit);
        const key = predecessor.toKey();
        const previousCost = distances.get(key);
        if (previousCost !== undefined && previousCost <= nextCost) {
          continue;
        }
        distances.set(key, nextCost);
        queue.enqueue({ position: predecessor, cost: nextCost });
      }
    }
    return distances;
  }

  #neighbors(position, stage) {
    return [
      { x: position.x, y: position.y - 1 },
      { x: position.x + 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x - 1, y: position.y }
    ]
      .filter((candidate) => stage.map.getCellAt(candidate.x, candidate.y) !== null)
      .map((candidate) => new Position(candidate.x, candidate.y))
      .sort(comparePositionsByRowThenColumn);
  }

  #isTraversable(unit, cell) {
    if (cell === null || !cell.terrain.canEnter(unit)) {
      return false;
    }
    return cell.occupant === null || cell.occupant === unit;
  }

  #requirePlacedLivingUnit(unit, stage) {
    invariant(unit instanceof Unit, "MOVEMENT_UNIT_REQUIRED");
    invariant(stage instanceof Stage, "MOVEMENT_STAGE_REQUIRED");
    invariant(stage.getUnit(unit.id) === unit, "MOVEMENT_UNIT_NOT_IN_STAGE", { unitId: unit.id });
    invariant(unit.hasTroops(), "MOVEMENT_UNIT_DEFEATED", { unitId: unit.id });
    const position = stage.map.getPosition(unit);
    invariant(position !== null, "MOVEMENT_UNIT_NOT_PLACED", { unitId: unit.id });
    return position;
  }
}
