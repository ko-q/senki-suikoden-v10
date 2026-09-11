import { Affiliation } from "../src/domain/army.js";
import { CharacterManager } from "../src/domain/character.js";
import { Facing } from "../src/domain/unit.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";

function createCharacterDefinition(unitDefinition) {
  const character = unitDefinition.character ?? {};
  return {
    id: `${unitDefinition.id}_character`,
    name: character.name ?? unitDefinition.id,
    shortName: character.shortName ?? unitDefinition.id.slice(0, 1).toUpperCase(),
    martial: character.martial ?? 50,
    command: character.command ?? 50,
    intelligence: character.intelligence ?? 50,
    charisma: character.charisma ?? 50,
    source: "test_fixture"
  };
}

/**
 * Combat/Tacticの固定値test専用Stage。正式人物dataとして使用しない。
 */
export function createServiceStage({
  id = "service_stage",
  map = [
    ["plain", "plain", "plain", "plain", "plain"],
    ["plain", "plain", "plain", "plain", "plain"],
    ["plain", "plain", "plain", "plain", "plain"]
  ],
  units,
  aiConfig = {},
  speeches = [],
  dialogues = [],
  events = [],
  objectives = [],
  hiddenTrapDefinitions = [],
  unitControlRules = [],
  introDialogueId = null,
  victoryDialogueId = null,
  defeatDialogueId = null
}) {
  const normalizedUnits = units.map((definition) => ({
    ...definition,
    characterId: `${definition.id}_character`,
    maxTroops: definition.maxTroops ?? 125,
    move: definition.move ?? 4,
    abilities: definition.abilities ?? [],
    facing: definition.facing ?? Facing.SOUTH,
    army: definition.army ?? Affiliation.ENEMY,
    maxUses: definition.maxUses ?? {},
    remainingUses: definition.remainingUses ?? definition.maxUses ?? {}
  }));
  const definition = {
    id,
    chapterNumber: 0,
    titleKey: `stage.${id}`,
    map,
    mobCharacters: units.map(createCharacterDefinition),
    units: normalizedUnits,
    speeches,
    dialogues,
    events,
    objectives,
    aiConfig,
    hiddenTrapDefinitions,
    unitControlRules,
    introDialogueId,
    victoryDialogueId,
    defeatDialogueId
  };
  return new StageFactory({
    definitions: [definition],
    characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  }).create(id);
}

export { Affiliation, Facing };
