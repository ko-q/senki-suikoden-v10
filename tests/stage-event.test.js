import test from "node:test";
import assert from "node:assert/strict";

import { Affiliation } from "../src/domain/army.js";
import { CharacterManager } from "../src/domain/character.js";
import { PresentationRequestType } from "../src/core/presentation-request.js";
import { HiddenTrap, HiddenTrapKind } from "../src/domain/hidden-trap.js";
import { Position } from "../src/domain/position.js";
import { StageEventTrigger, StageEventType } from "../src/domain/stage-event.js";
import { Facing, UnitStatus } from "../src/domain/unit.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createStage, createStageDefinition } from "../test-support/fixtures.js";

test("StageEventManager resolves dependencies to a fixed point without stopping on interrupt", () => {
  const stage = createStage({
    id: "event_chain_test",
    events: [
      {
        id: "dependent",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START,
        requiredCompletedEventIds: ["prerequisite"],
        presentationRequests: [
          { type: PresentationRequestType.NOTICE, messageKey: "notice.dependent" }
        ]
      },
      {
        id: "prerequisite",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START,
        interruptMovement: true,
        presentationRequests: [
          { type: PresentationRequestType.NOTICE, messageKey: "notice.prerequisite" }
        ]
      }
    ]
  });

  const result = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.PHASE_START,
    stage
  });

  assert.deepEqual(result.completedEvents.map((event) => event.id), [
    "prerequisite",
    "dependent"
  ]);
  assert.equal(result.interruptMovement, true);
  assert.deepEqual(result.presentationRequests.map((request) => request.messageKey), [
    "notice.prerequisite",
    "notice.dependent"
  ]);
  assert.deepEqual(stage.eventManager.getCompletedEventIds(), ["dependent", "prerequisite"]);
});

test("StageEventManager terminal callback latches the chain after an irreversible Event", () => {
  const stage = createStage({
    id: "event_terminal_test",
    events: [
      {
        id: "first",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.AFTER_OPERATION
      },
      {
        id: "second",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.AFTER_OPERATION,
        requiredCompletedEventIds: ["first"]
      }
    ]
  });

  const result = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.AFTER_OPERATION,
    stage,
    afterEventCompleted: (event) => event.id === "first"
  });

  assert.equal(result.stopped, true);
  assert.deepEqual(result.completedEvents.map((event) => event.id), ["first"]);
  assert.deepEqual(stage.eventManager.getCompletedEventIds(), ["first"]);
});

test("StageEvent can complete once from either of multiple declared triggers", () => {
  const stage = createStage({
    id: "event_multiple_triggers_test",
    events: [
      {
        id: "turn_five_reinforcement_window",
        type: StageEventType.MISSION_TRANSITION,
        triggers: [
          StageEventTrigger.PHASE_START,
          StageEventTrigger.AFTER_OPERATION
        ],
        turnAtLeast: 5
      }
    ]
  });
  const event = stage.eventManager.get("turn_five_reinforcement_window");
  stage.setTurnAndPhase(5, stage.phase);

  assert.equal(event.trigger, null);
  assert.deepEqual(event.triggers, [
    StageEventTrigger.PHASE_START,
    StageEventTrigger.AFTER_OPERATION
  ]);
  assert.deepEqual(
    stage.eventManager.getByTrigger(StageEventTrigger.AFTER_OPERATION),
    [event]
  );

  const first = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.AFTER_OPERATION,
    stage
  });
  const second = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.PHASE_START,
    stage
  });

  assert.deepEqual(first.completedEvents, [event]);
  assert.deepEqual(second.completedEvents, []);
});

test("ReinforcementEvent deploys a reserve with the v9 fixed nearest-cell scan", () => {
  const id = "reinforcement_deploy_test";
  const definition = createStageDefinition({
    id,
    playerPosition: { x: 1, y: 1 },
    enemyPosition: { x: 2, y: 2 }
  });
  definition.mobCharacters.push({
    id: `${id}_reserve_character`,
    name: "Test Reserve",
    shortName: "R",
    martial: 50,
    command: 50,
    intelligence: 50,
    charisma: 50,
    source: "test_fixture"
  });
  definition.units.push({
    id: `${id}_reserve`,
    characterId: `${id}_reserve_character`,
    maxTroops: 125,
    move: 4,
    facing: Facing.SOUTH,
    army: null,
    position: null
  });
  definition.events = [
    {
      id: "reinforcement",
      type: StageEventType.REINFORCEMENT,
      trigger: StageEventTrigger.PHASE_START,
      deployments: [
        {
          unitId: `${id}_reserve`,
          preferredPosition: { x: 1, y: 1 }
        }
      ],
      targetArmy: Affiliation.PLAYER
    }
  ];
  const stage = new StageFactory({
    definitions: [definition],
    characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  }).create(id);
  const reserve = stage.getUnit(`${id}_reserve`);
  const originalOrder = [...stage.unitOrder];

  const result = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.PHASE_START,
    stage
  });

  assert.deepEqual(result.completedEvents.map((event) => event.id), ["reinforcement"]);
  assert.deepEqual(stage.map.getPosition(reserve), new Position(1, 0));
  assert.equal(stage.armyManager.getAffiliation(reserve), Affiliation.PLAYER);
  assert.deepEqual(stage.unitOrder, originalOrder);
});

test("ReinforcementEvent completes while an unplaceable reserve stays unassigned", () => {
  const id = "reinforcement_failure_test";
  const definition = createStageDefinition({
    id,
    map: [["plain", "plain"]],
    playerPosition: { x: 0, y: 0 },
    enemyPosition: { x: 1, y: 0 }
  });
  definition.mobCharacters.push({
    id: `${id}_reserve_character`,
    name: "Test Reserve",
    shortName: "R",
    martial: 50,
    command: 50,
    intelligence: 50,
    charisma: 50,
    source: "test_fixture"
  });
  definition.units.push({
    id: `${id}_reserve`,
    characterId: `${id}_reserve_character`,
    maxTroops: 125,
    move: 4,
    facing: Facing.SOUTH,
    army: null,
    position: null
  });
  definition.events = [
    {
      id: "blocked_reinforcement",
      type: StageEventType.REINFORCEMENT,
      trigger: StageEventTrigger.PHASE_START,
      deployments: [
        {
          unitId: `${id}_reserve`,
          preferredPosition: { x: 0, y: 0 }
        }
      ],
      targetArmy: Affiliation.PLAYER
    }
  ];
  const stage = new StageFactory({
    definitions: [definition],
    characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  }).create(id);
  const reserve = stage.getUnit(`${id}_reserve`);

  const result = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.PHASE_START,
    stage
  });

  assert.deepEqual(result.completedEvents.map((event) => event.id), ["blocked_reinforcement"]);
  assert.equal(stage.armyManager.getArmy(reserve), null);
  assert.equal(stage.map.getPosition(reserve), null);
});

test("BetrayalEvent transfers only living units and applies configured confusion", () => {
  const id = "betrayal_event_test";
  const stage = createStage({
    id,
    events: [
      {
        id: "betrayal",
        type: StageEventType.BETRAYAL,
        trigger: StageEventTrigger.PHASE_START,
        unitIds: [`${id}_enemy`],
        targetArmy: Affiliation.PLAYER,
        turnAtLeast: 4,
        newFacing: Facing.NORTH,
        confusionTargetArmy: Affiliation.PLAYER,
        confusionTurns: 1
      }
    ]
  });
  const originalOrder = [...stage.unitOrder];
  const enemy = stage.getUnit(`${id}_enemy`);

  stage.setTurnAndPhase(4, stage.phase);
  const result = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.PHASE_START,
    stage
  });

  assert.deepEqual(result.completedEvents.map((event) => event.id), ["betrayal"]);
  assert.equal(stage.armyManager.getAffiliation(enemy), Affiliation.PLAYER);
  assert.equal(enemy.facing, Facing.NORTH);
  assert.equal(enemy.getStatusTurns(UnitStatus.CONFUSED), 1);
  assert.deepEqual(stage.unitOrder, originalOrder);
});

test("DialogueEvent filters TRAP_TRIGGERED by kind and completes only once", () => {
  const id = "dialogue_event_test";
  const definition = createStageDefinition({ id });
  definition.speeches = [
    {
      id: "spell_warning_speech",
      speakerCharacterId: `${id}_player_character`,
      text: "Watch the ground."
    }
  ];
  definition.dialogues = [
    {
      id: "spell_warning",
      speechIds: ["spell_warning_speech"]
    }
  ];
  definition.events = [
    {
      id: "first_spell_warning",
      type: StageEventType.DIALOGUE,
      trigger: StageEventTrigger.TRAP_TRIGGERED,
      trapKinds: [HiddenTrapKind.SPELL],
      presentationRequests: [
        { type: PresentationRequestType.DIALOGUE, dialogueId: "spell_warning" }
      ]
    }
  ];
  const stage = new StageFactory({
    definitions: [definition],
    characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  }).create(id);
  const trap = new HiddenTrap({
    id: "spell_trap",
    kind: HiddenTrapKind.SPELL,
    position: { x: 1, y: 1 },
    triggerAffiliations: [Affiliation.PLAYER]
  });
  stage.addHiddenTrap(trap);

  const first = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.TRAP_TRIGGERED,
    stage,
    payload: { unit: stage.getUnit(`${id}_player`), trap }
  });
  const second = stage.eventManager.resolveChain({
    trigger: StageEventTrigger.TRAP_TRIGGERED,
    stage,
    payload: { unit: stage.getUnit(`${id}_player`), trap }
  });

  assert.deepEqual(first.completedEvents.map((event) => event.id), ["first_spell_warning"]);
  assert.equal(
    first.presentationRequests[0].dialogue,
    stage.dialogueManager.get("spell_warning")
  );
  assert.equal(second.completedEvents.length, 0);
});
