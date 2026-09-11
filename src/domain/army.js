import { invariant, requireEnumValue, requireIdentifier } from "../core/domain-error.js";
import { Unit } from "./unit.js";

export const Affiliation = Object.freeze({
  PLAYER: "PLAYER",
  ENEMY: "ENEMY"
});

const ARMY_UNITS = new WeakMap();

/**
 * Unit集合の読み取りview。所属変更はArmyManagerだけが行う。
 */
export class Army {
  constructor({ id, affiliation }) {
    this.id = requireIdentifier(id, "ARMY_ID_INVALID");
    this.affiliation = requireEnumValue(affiliation, Affiliation, "ARMY_AFFILIATION_INVALID");
    ARMY_UNITS.set(this, []);
    Object.freeze(this);
  }

  getUnits() {
    return Object.freeze([...ARMY_UNITS.get(this)]);
  }

  has(unit) {
    return ARMY_UNITS.get(this).includes(unit);
  }

  get size() {
    return ARMY_UNITS.get(this).length;
  }
}

function addToArmy(army, unit) {
  ARMY_UNITS.get(army).push(unit);
}

function removeFromArmy(army, unit) {
  const units = ARMY_UNITS.get(army);
  const index = units.indexOf(unit);
  invariant(index >= 0, "ARMY_UNIT_NOT_FOUND", { armyId: army.id, unitId: unit.id });
  units.splice(index, 1);
}

/**
 * Unit所属の唯一の正本。複数Armyへの重複所属を禁止する。
 */
export class ArmyManager {
  #armyByUnit;

  constructor({ playerArmy, enemyArmy }) {
    invariant(playerArmy instanceof Army, "PLAYER_ARMY_REQUIRED");
    invariant(enemyArmy instanceof Army, "ENEMY_ARMY_REQUIRED");
    invariant(playerArmy !== enemyArmy, "ARMIES_MUST_DIFFER");
    invariant(playerArmy.affiliation === Affiliation.PLAYER, "PLAYER_ARMY_AFFILIATION_INVALID");
    invariant(enemyArmy.affiliation === Affiliation.ENEMY, "ENEMY_ARMY_AFFILIATION_INVALID");
    invariant(playerArmy.size === 0 && enemyArmy.size === 0, "ARMY_MUST_START_EMPTY");

    this.playerArmy = playerArmy;
    this.enemyArmy = enemyArmy;
    this.#armyByUnit = new Map();
  }

  addUnit(unit, targetArmy) {
    invariant(unit instanceof Unit, "ARMY_UNIT_REQUIRED");
    this.#requireManagedArmy(targetArmy);
    invariant(!this.#armyByUnit.has(unit), "ARMY_UNIT_ALREADY_ASSIGNED", { unitId: unit.id });
    addToArmy(targetArmy, unit);
    this.#armyByUnit.set(unit, targetArmy);
  }

  removeUnit(unit) {
    invariant(unit instanceof Unit, "ARMY_UNIT_REQUIRED");
    const currentArmy = this.#armyByUnit.get(unit);
    if (currentArmy === undefined) {
      return false;
    }
    removeFromArmy(currentArmy, unit);
    this.#armyByUnit.delete(unit);
    return true;
  }

  getArmy(unit) {
    invariant(unit instanceof Unit, "ARMY_UNIT_REQUIRED");
    return this.#armyByUnit.get(unit) ?? null;
  }

  getAffiliation(unit) {
    return this.getArmy(unit)?.affiliation ?? null;
  }

  areAllies(left, right) {
    const leftArmy = this.getArmy(left);
    return leftArmy !== null && leftArmy === this.getArmy(right);
  }

  areEnemies(left, right) {
    const leftArmy = this.getArmy(left);
    const rightArmy = this.getArmy(right);
    return leftArmy !== null && rightArmy !== null && leftArmy !== rightArmy;
  }

  transferUnit(unit, targetArmy) {
    invariant(unit instanceof Unit, "ARMY_UNIT_REQUIRED");
    this.#requireManagedArmy(targetArmy);
    const currentArmy = this.#armyByUnit.get(unit);
    invariant(currentArmy !== undefined, "ARMY_UNIT_NOT_ASSIGNED", { unitId: unit.id });
    if (currentArmy === targetArmy) {
      return false;
    }

    removeFromArmy(currentArmy, unit);
    addToArmy(targetArmy, unit);
    this.#armyByUnit.set(unit, targetArmy);
    return true;
  }

  validateMembership(expectedUnits) {
    const expectedSet = new Set(expectedUnits);
    const observed = new Set();

    for (const army of [this.playerArmy, this.enemyArmy]) {
      for (const unit of army.getUnits()) {
        invariant(expectedSet.has(unit), "ARMY_UNKNOWN_UNIT", { unitId: unit.id });
        invariant(!observed.has(unit), "ARMY_UNIT_DUPLICATE", { unitId: unit.id });
        invariant(this.#armyByUnit.get(unit) === army, "ARMY_INDEX_MISMATCH", { unitId: unit.id });
        observed.add(unit);
      }
    }

    invariant(observed.size === this.#armyByUnit.size, "ARMY_MEMBERSHIP_COUNT_MISMATCH");
    return true;
  }

  #requireManagedArmy(army) {
    invariant(
      army === this.playerArmy || army === this.enemyArmy,
      "ARMY_NOT_MANAGED",
      { armyId: army?.id }
    );
  }
}
