import { CharacterManager } from "../src/domain/character.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";

// Terrain-only fixtures: no invented official character values or objectives.
export function createMapStage(definition, overrides = {}) {
  const stageDefinition = {
    id: definition.stageId, chapterNumber: definition.chapterNumber,
    titleKey: definition.title, map: definition.map,
    mobCharacters: [{ id: "map_fixture_character", name: "Map fixture", shortName: "T",
      martial: 50, command: 50, intelligence: 50, charisma: 50, source: "map_test_fixture" }],
    units: [{ id: "map_fixture_reserve", characterId: "map_fixture_character",
      maxTroops: 1, move: 0, army: null, position: null }], ...overrides
  };
  return new StageFactory({ definitions: [stageDefinition], characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog() }).create(stageDefinition.id);
}
