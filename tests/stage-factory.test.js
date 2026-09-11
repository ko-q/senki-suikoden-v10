import test from "node:test";
import assert from "node:assert/strict";

import { Character, CharacterManager } from "../src/domain/character.js";
import { ObjectiveOutcome, ObjectiveType } from "../src/domain/objective.js";
import { StageEventTrigger, StageEventType } from "../src/domain/stage-event.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createStageDefinition } from "../test-support/fixtures.js";

function createFactory(definition, characters = []) {
  return new StageFactory({
    definitions: [definition],
    characterManager: new CharacterManager(characters),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  });
}

test("StageFactory creates resolved runtime references and immutable Unit order", () => {
  const definition = createStageDefinition({
    id: "factory_test",
    events: [
      {
        id: "second_event",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.AFTER_OPERATION,
        requiredCompletedEventIds: ["first_event"]
      },
      {
        id: "first_event",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START,
        requiredCompletedEventIds: []
      }
    ]
  });
  const stage = createFactory(definition).create("factory_test");
  const secondEvent = stage.eventManager.get("second_event");

  assert.equal(secondEvent.requiredCompletedEvents[0], stage.eventManager.get("first_event"));
  assert.equal(Object.isFrozen(stage.unitOrder), true);
  assert.equal(stage.unitOrder[0], stage.getUnit("factory_test_player"));
  assert.equal(stage.validateRuntime(), true);
});

test("StageFactory rejects StageEvent dependency cycles", () => {
  const definition = createStageDefinition({
    id: "cycle_test",
    events: [
      {
        id: "event_a",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START,
        requiredCompletedEventIds: ["event_b"]
      },
      {
        id: "event_b",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.AFTER_OPERATION,
        requiredCompletedEventIds: ["event_a"]
      }
    ]
  });

  assert.throws(
    () => createFactory(definition).create("cycle_test"),
    { code: "STAGE_EVENT_DEPENDENCY_CYCLE" }
  );
});

test("StageFactory rejects collisions between global and Stage mob character IDs", () => {
  const definition = createStageDefinition({ id: "collision_test" });
  const collidingCharacter = new Character({
    id: "collision_test_player_character",
    name: "Global Character",
    shortName: "G",
    martial: 50,
    command: 50,
    intelligence: 50,
    charisma: 50
  });

  assert.throws(
    () => createFactory(definition, [collidingCharacter]).create("collision_test"),
    { code: "STAGE_CHARACTER_ID_COLLISION" }
  );
});

test("StageFactory resolves concrete Objective Unit and Army references", () => {
  const definition = createStageDefinition({ id: "objective_guard_test" });
  definition.objectives = [
    {
      id: "enemy_eliminated",
      type: ObjectiveType.ELIMINATION,
      outcome: ObjectiveOutcome.VICTORY,
      targetArmy: "ENEMY"
    },
    {
      id: "player_defeated",
      type: ObjectiveType.UNIT_DEFEAT,
      outcome: ObjectiveOutcome.DEFEAT,
      unitIds: ["objective_guard_test_player"]
    }
  ];

  const stage = createFactory(definition).create("objective_guard_test");

  assert.equal(stage.objectiveManager.getAll().length, 2);
  assert.equal(
    stage.objectiveManager.getAll()[0].targetArmy,
    stage.armyManager.enemyArmy
  );
  assert.equal(
    stage.objectiveManager.getAll()[1].units[0],
    stage.getUnit("objective_guard_test_player")
  );
});

test("StageFactory resolves Stage AI IDs to runtime Unit references", () => {
  const definition = createStageDefinition({ id: "ai_config_test" });
  definition.aiConfig = {
    adviserUnitIds: ["ai_config_test_enemy"],
    cautiousElementalUnitIds: ["ai_config_test_enemy"],
    wideIllusionRules: [{
      actorUnitId: "ai_config_test_enemy",
      suppressorUnitId: "ai_config_test_player",
      suppressionRange: 3
    }],
    pursuitRules: [{
      unitIds: ["ai_config_test_enemy"],
      gateColumns: [1, 2],
      insideMaximumRow: 1,
      outsideRow: 2,
      candidateMinimumRow: 1
    }],
    targetPriorityRules: [{
      actorUnitIds: ["ai_config_test_enemy"],
      targetUnitIds: ["ai_config_test_player"],
      disableStrategy: true
    }]
  };

  const stage = createFactory(definition).create("ai_config_test");
  const enemy = stage.getUnit("ai_config_test_enemy");
  const player = stage.getUnit("ai_config_test_player");

  assert.equal(stage.aiConfig.adviserUnits[0], enemy);
  assert.equal(stage.aiConfig.cautiousElementalUnits[0], enemy);
  assert.equal(stage.aiConfig.wideIllusionRules[0].actor, enemy);
  assert.equal(stage.aiConfig.wideIllusionRules[0].suppressor, player);
  assert.equal(stage.aiConfig.pursuitRules[0].units[0], enemy);
  assert.equal(stage.aiConfig.targetPriorityRules[0].actors[0], enemy);
  assert.equal(stage.aiConfig.targetPriorityRules[0].targets[0], player);
  assert.equal(stage.aiConfig.targetPriorityRules[0].disableStrategy, true);
});

test("StageFactory rejects an unknown Stage AI Unit ID", () => {
  const definition = createStageDefinition({ id: "ai_config_unknown" });
  definition.aiConfig = { adviserUnitIds: ["missing_unit"] };

  assert.throws(
    () => createFactory(definition).create("ai_config_unknown"),
    { code: "STAGE_UNIT_NOT_FOUND" }
  );
});
