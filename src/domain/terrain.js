import {
  copyFrozenArray,
  invariant,
  requireIdentifier,
  requireIntegerInRange,
  requireNonEmptyString
} from "../core/domain-error.js";
import { UnitAbility } from "./unit-ability.js";

export { UnitAbility } from "./unit-ability.js";

function normalizeMovementOverride(override) {
  invariant(override !== null && typeof override === "object", "TERRAIN_OVERRIDE_INVALID");
  return Object.freeze({
    abilityId: requireIdentifier(override.abilityId, "TERRAIN_OVERRIDE_ABILITY_INVALID"),
    moveCost: requireIntegerInRange(
      override.moveCost,
      1,
      Number.MAX_SAFE_INTEGER,
      "TERRAIN_OVERRIDE_COST_INVALID"
    ),
    allowsEntry: override.allowsEntry === true
  });
}

/**
 * 地形の不変なrule値。移動能力による例外もdataとして保持する。
 */
export class Terrain {
  constructor({
    id,
    nameKey,
    moveCost,
    passable,
    enterAbilityIds = [],
    movementOverrides = [],
    combatModifiers = {}
  }) {
    this.id = requireIdentifier(id, "TERRAIN_ID_INVALID");
    this.nameKey = requireNonEmptyString(nameKey, "TERRAIN_NAME_KEY_INVALID");
    this.moveCost = requireIntegerInRange(
      moveCost,
      1,
      Number.MAX_SAFE_INTEGER,
      "TERRAIN_MOVE_COST_INVALID"
    );
    this.passable = passable === true;
    this.enterAbilityIds = copyFrozenArray(
      enterAbilityIds.map((abilityId) => requireIdentifier(abilityId, "TERRAIN_ENTRY_ABILITY_INVALID"))
    );
    this.movementOverrides = copyFrozenArray(movementOverrides.map(normalizeMovementOverride));
    this.combatModifiers = Object.freeze({ ...combatModifiers });
    Object.freeze(this);
  }

  canEnter(unit) {
    if (this.passable) {
      return true;
    }
    return this.enterAbilityIds.some((abilityId) => unit.hasAbility(abilityId))
      || this.movementOverrides.some(
        (override) => override.allowsEntry && unit.hasAbility(override.abilityId)
      );
  }

  getMoveCost(unit) {
    const override = this.movementOverrides.find((candidate) => unit.hasAbility(candidate.abilityId));
    if (override !== undefined) {
      return override.moveCost;
    }
    return this.moveCost;
  }
}

/**
 * TerrainをIDで引く読み取り専用catalog。
 */
export class TerrainCatalog {
  #terrainsById;

  constructor(terrains) {
    invariant(Array.isArray(terrains) && terrains.length > 0, "TERRAINS_REQUIRED");
    this.#terrainsById = new Map();

    for (const terrain of terrains) {
      invariant(terrain instanceof Terrain, "TERRAIN_INSTANCE_REQUIRED");
      invariant(!this.#terrainsById.has(terrain.id), "TERRAIN_ID_DUPLICATE", {
        terrainId: terrain.id
      });
      this.#terrainsById.set(terrain.id, terrain);
    }
  }

  get(terrainId) {
    const terrain = this.#terrainsById.get(terrainId);
    invariant(terrain !== undefined, "TERRAIN_NOT_FOUND", { terrainId });
    return terrain;
  }

  has(terrainId) {
    return this.#terrainsById.has(terrainId);
  }

  getAll() {
    return Object.freeze([...this.#terrainsById.values()]);
  }
}
