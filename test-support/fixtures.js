import { Affiliation } from "../src/domain/army.js";
import { CharacterManager } from "../src/domain/character.js";
import { Facing } from "../src/domain/unit.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";

export function createStageDefinition({
  id = "test_stage",
  map = [
    ["plain", "plain", "plain"],
    ["plain", "plain", "plain"],
    ["plain", "plain", "plain"]
  ],
  playerPosition = { x: 0, y: 1 },
  enemyPosition = { x: 2, y: 1 },
  playerMove = 4,
  playerAbilities = [],
  events = [],
  objectives = [],
  hiddenTrapDefinitions = []
} = {}) {
  return {
    id,
    chapterNumber: 0,
    titleKey: `stage.${id}`,
    map,
    mobCharacters: [
      {
        id: `${id}_player_character`,
        name: "Test Player",
        shortName: "P",
        martial: 50,
        command: 50,
        intelligence: 50,
        charisma: 50,
        source: "test_fixture"
      },
      {
        id: `${id}_enemy_character`,
        name: "Test Enemy",
        shortName: "E",
        martial: 50,
        command: 50,
        intelligence: 50,
        charisma: 50,
        source: "test_fixture"
      }
    ],
    units: [
      {
        id: `${id}_player`,
        characterId: `${id}_player_character`,
        maxTroops: 125,
        move: playerMove,
        abilities: playerAbilities,
        facing: Facing.EAST,
        army: Affiliation.PLAYER,
        position: playerPosition
      },
      {
        id: `${id}_enemy`,
        characterId: `${id}_enemy_character`,
        maxTroops: 125,
        move: 4,
        facing: Facing.WEST,
        army: Affiliation.ENEMY,
        position: enemyPosition
      }
    ],
    speeches: [],
    dialogues: [],
    events,
    objectives,
    aiConfig: {},
    hiddenTrapDefinitions,
    unitControlRules: []
  };
}

export function createStage(options = {}) {
  const definition = createStageDefinition(options);
  const factory = new StageFactory({
    definitions: [definition],
    characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  });
  return factory.create(definition.id);
}

export function createStageDigest(stage) {
  return JSON.stringify(stage.unitOrder.map((unit) => ({
    id: unit.id,
    troops: unit.troops,
    position: stage.map.getPosition(unit),
    affiliation: stage.armyManager.getAffiliation(unit),
    facing: unit.facing,
    actionState: unit.actionState,
    statusEffects: unit.statusEffects,
    remainingUses: unit.remainingUses
  })));
}
