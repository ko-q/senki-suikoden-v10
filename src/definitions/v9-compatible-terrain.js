import { Terrain, TerrainCatalog, UnitAbility } from "../domain/terrain.js";

/**
 * v9.7.75の実ファイルから転記した地形値。
 * 表示名はPresentation側で解決するため、ここではlocale非依存keyを使う。
 */
export function createV9CompatibleTerrainCatalog() {
  return new TerrainCatalog([
    new Terrain({
      id: "plain",
      nameKey: "terrain.plain",
      moveCost: 1,
      passable: true,
      combatModifiers: { damageRate: 0, damageFixed: 0, attackBonus: 0 }
    }),
    new Terrain({
      id: "road",
      nameKey: "terrain.road",
      moveCost: 1,
      passable: true,
      combatModifiers: { damageRate: 0, damageFixed: 0, attackBonus: 0 }
    }),
    new Terrain({
      id: "forest",
      nameKey: "terrain.forest",
      moveCost: 2,
      passable: true,
      movementOverrides: [
        { abilityId: UnitAbility.WILD_TERRAIN_AFFINITY, moveCost: 1 }
      ],
      combatModifiers: { damageRate: 0.3, damageFixed: 8, attackBonus: 0 }
    }),
    new Terrain({
      id: "hill",
      nameKey: "terrain.hill",
      moveCost: 2,
      passable: true,
      movementOverrides: [
        { abilityId: UnitAbility.WILD_TERRAIN_AFFINITY, moveCost: 1 }
      ],
      combatModifiers: { damageRate: 0.15, damageFixed: 4, attackBonus: 3 }
    }),
    new Terrain({
      id: "mountain",
      nameKey: "terrain.mountain",
      moveCost: 3,
      passable: true,
      movementOverrides: [
        { abilityId: UnitAbility.WILD_TERRAIN_AFFINITY, moveCost: 2 }
      ],
      combatModifiers: { damageRate: 0.6, damageFixed: 16, attackBonus: 3 }
    }),
    new Terrain({
      id: "wall",
      nameKey: "terrain.wall",
      moveCost: 99,
      passable: false,
      combatModifiers: { damageRate: 0, damageFixed: 0, attackBonus: 0 }
    }),
    new Terrain({
      id: "swamp",
      nameKey: "terrain.swamp",
      moveCost: 3,
      passable: true,
      movementOverrides: [
        { abilityId: UnitAbility.WATER_TERRAIN_AFFINITY, moveCost: 1 },
        { abilityId: UnitAbility.WILD_TERRAIN_AFFINITY, moveCost: 2 }
      ],
      combatModifiers: {
        damageRate: 0,
        damageFixed: 0,
        attackBonus: 0,
        attackPenaltyRate: 0.3,
        attackPenaltyFixed: 8,
        defensePenaltyRate: 0.3,
        defensePenaltyFixed: 8
      }
    }),
    new Terrain({
      id: "water",
      nameKey: "terrain.water",
      moveCost: 99,
      passable: false,
      enterAbilityIds: [UnitAbility.WATER_TERRAIN_AFFINITY],
      movementOverrides: [
        {
          abilityId: UnitAbility.WATER_TERRAIN_AFFINITY,
          moveCost: 1,
          allowsEntry: true
        }
      ],
      combatModifiers: { damageRate: 0, damageFixed: 0, attackBonus: 0 }
    })
  ]);
}
