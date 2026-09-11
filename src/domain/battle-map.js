import { invariant } from "../core/domain-error.js";
import { Position } from "./position.js";
import { Terrain } from "./terrain.js";
import { Unit } from "./unit.js";

const OCCUPANTS = new WeakMap();

/**
 * 盤面の1cell。占有変更手段は同module内のBattleMapだけが持つ。
 */
export class MapCell {
  constructor(position, terrain) {
    invariant(position instanceof Position, "MAP_CELL_POSITION_REQUIRED");
    invariant(terrain instanceof Terrain, "MAP_CELL_TERRAIN_REQUIRED");
    this.position = position;
    this.terrain = terrain;
    OCCUPANTS.set(this, null);
    Object.freeze(this);
  }

  get occupant() {
    return OCCUPANTS.get(this);
  }

  isOccupied() {
    return this.occupant !== null;
  }
}

function setOccupant(cell, unit) {
  OCCUPANTS.set(cell, unit);
}

/**
 * 実Unit位置の唯一の正本。cell占有と位置indexを常に同期更新する。
 */
export class BattleMap {
  #cells;
  #positionsByUnit;

  constructor(terrainRows) {
    invariant(Array.isArray(terrainRows) && terrainRows.length > 0, "MAP_ROWS_REQUIRED");
    invariant(Array.isArray(terrainRows[0]) && terrainRows[0].length > 0, "MAP_COLUMNS_REQUIRED");

    const width = terrainRows[0].length;
    invariant(
      terrainRows.every((row) => Array.isArray(row) && row.length === width),
      "MAP_NOT_RECTANGULAR"
    );

    this.width = width;
    this.height = terrainRows.length;
    this.#cells = terrainRows.map((row, y) => Object.freeze(
      row.map((terrain, x) => {
        invariant(terrain instanceof Terrain, "MAP_TERRAIN_REQUIRED", { x, y });
        return new MapCell(new Position(x, y), terrain);
      })
    ));
    Object.freeze(this.#cells);
    this.#positionsByUnit = new Map();
  }

  getCellAt(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return null;
    }
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
      return null;
    }
    return this.#cells[y][x];
  }

  getPosition(unit) {
    invariant(unit instanceof Unit, "MAP_UNIT_REQUIRED");
    const position = this.#positionsByUnit.get(unit);
    if (position === undefined) {
      return null;
    }
    return new Position(position.x, position.y);
  }

  getCellForUnit(unit) {
    const position = this.getPosition(unit);
    if (position === null) {
      return null;
    }
    return this.getCellAt(position.x, position.y);
  }

  placeUnit(unit, positionValue) {
    invariant(unit instanceof Unit, "MAP_UNIT_REQUIRED");
    invariant(unit.hasTroops(), "MAP_DEFEATED_UNIT_FORBIDDEN", { unitId: unit.id });
    invariant(!this.#positionsByUnit.has(unit), "MAP_UNIT_ALREADY_PLACED", { unitId: unit.id });

    const position = Position.from(positionValue);
    const destinationCell = this.getCellAt(position.x, position.y);
    invariant(destinationCell !== null, "MAP_POSITION_OUTSIDE", { position });
    invariant(!destinationCell.isOccupied(), "MAP_CELL_OCCUPIED", { position });

    setOccupant(destinationCell, unit);
    this.#positionsByUnit.set(unit, position);
    return this.getPosition(unit);
  }

  moveUnit(unit, destinationValue) {
    invariant(unit instanceof Unit, "MAP_UNIT_REQUIRED");
    invariant(unit.hasTroops(), "MAP_DEFEATED_UNIT_FORBIDDEN", { unitId: unit.id });
    const origin = this.#positionsByUnit.get(unit);
    invariant(origin !== undefined, "MAP_UNIT_NOT_PLACED", { unitId: unit.id });

    const destination = Position.from(destinationValue);
    invariant(!origin.equals(destination), "MAP_DESTINATION_UNCHANGED", { unitId: unit.id });
    const originCell = this.getCellAt(origin.x, origin.y);
    const destinationCell = this.getCellAt(destination.x, destination.y);
    invariant(destinationCell !== null, "MAP_POSITION_OUTSIDE", { destination });
    invariant(!destinationCell.isOccupied(), "MAP_CELL_OCCUPIED", { destination });
    invariant(originCell.occupant === unit, "MAP_INDEX_CELL_MISMATCH", { unitId: unit.id });

    setOccupant(originCell, null);
    setOccupant(destinationCell, unit);
    this.#positionsByUnit.set(unit, destination);
    return this.getPosition(unit);
  }

  removeUnit(unit) {
    invariant(unit instanceof Unit, "MAP_UNIT_REQUIRED");
    const position = this.#positionsByUnit.get(unit);
    if (position === undefined) {
      return false;
    }

    const cell = this.getCellAt(position.x, position.y);
    invariant(cell.occupant === unit, "MAP_INDEX_CELL_MISMATCH", { unitId: unit.id });
    setOccupant(cell, null);
    this.#positionsByUnit.delete(unit);
    return true;
  }

  clearUnits() {
    for (const [unit, position] of this.#positionsByUnit) {
      const cell = this.getCellAt(position.x, position.y);
      invariant(cell.occupant === unit, "MAP_INDEX_CELL_MISMATCH", { unitId: unit.id });
      setOccupant(cell, null);
    }
    this.#positionsByUnit.clear();
  }

  validateConsistency(expectedUnits = undefined) {
    const expectedSet = expectedUnits === undefined ? null : new Set(expectedUnits);
    let occupiedCellCount = 0;

    for (const row of this.#cells) {
      for (const cell of row) {
        const occupant = cell.occupant;
        if (occupant === null) {
          continue;
        }
        occupiedCellCount += 1;
        invariant(occupant instanceof Unit, "MAP_CELL_OCCUPANT_INVALID");
        if (expectedSet !== null) {
          invariant(expectedSet.has(occupant), "MAP_UNKNOWN_UNIT", { unitId: occupant.id });
        }
        const indexedPosition = this.#positionsByUnit.get(occupant);
        invariant(
          indexedPosition !== undefined && indexedPosition.equals(cell.position),
          "MAP_CELL_INDEX_MISMATCH",
          { unitId: occupant.id }
        );
      }
    }

    invariant(occupiedCellCount === this.#positionsByUnit.size, "MAP_OCCUPANCY_COUNT_MISMATCH");
    for (const [unit, position] of this.#positionsByUnit) {
      const cell = this.getCellAt(position.x, position.y);
      invariant(cell !== null && cell.occupant === unit, "MAP_INDEX_CELL_MISMATCH", {
        unitId: unit.id
      });
    }
    return true;
  }

  createPositionSnapshot() {
    return Object.freeze(
      [...this.#positionsByUnit.entries()]
        .map(([unit, position]) => Object.freeze({
          unitId: unit.id,
          position: new Position(position.x, position.y)
        }))
        .sort((left, right) => left.unitId.localeCompare(right.unitId))
    );
  }
}
