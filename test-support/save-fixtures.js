import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { Affiliation } from "../src/domain/army.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { CharacterManager } from "../src/domain/character.js";
import { HiddenTrap, HiddenTrapKind } from "../src/domain/hidden-trap.js";
import { StageEventTrigger, StageEventType } from "../src/domain/stage-event.js";
import { Facing, UnitActionState, UnitStatus } from "../src/domain/unit.js";
import { UnitUse } from "../src/domain/unit-ability.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";

function characterDefinition(id, shortName) {
  return {
    id: `${id}_character`,
    name: id,
    shortName,
    martial: 50,
    command: 50,
    intelligence: 50,
    charisma: 50,
    source: "test_fixture"
  };
}

export function createSaveStageDefinition(id = "save_stage") {
  return {
    id,
    chapterNumber: 0,
    titleKey: `stage.${id}`,
    map: [["plain", "plain", "plain", "plain", "plain"]],
    mobCharacters: [
      characterDefinition("save_player", "P"),
      characterDefinition("save_enemy", "E"),
      characterDefinition("save_defeated", "D"),
      characterDefinition("save_reserve", "R")
    ],
    units: [
      {
        id: "save_player",
        characterId: "save_player_character",
        maxTroops: 125,
        move: 4,
        facing: Facing.EAST,
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        maxUses: { [UnitUse.PROJECTILE]: 2, [UnitUse.TACTIC]: 3 }
      },
      {
        id: "save_enemy",
        characterId: "save_enemy_character",
        maxTroops: 125,
        move: 4,
        facing: Facing.WEST,
        army: Affiliation.ENEMY,
        position: { x: 4, y: 0 }
      },
      {
        id: "save_defeated",
        characterId: "save_defeated_character",
        maxTroops: 125,
        move: 4,
        facing: Facing.WEST,
        army: Affiliation.ENEMY,
        position: { x: 3, y: 0 }
      },
      {
        id: "save_reserve",
        characterId: "save_reserve_character",
        maxTroops: 125,
        move: 4,
        facing: Facing.SOUTH,
        actionState: UnitActionState.FINISHED,
        army: null,
        position: null
      }
    ],
    speeches: [],
    dialogues: [],
    events: [
      {
        id: "save_event",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START
      }
    ],
    objectives: [],
    aiConfig: {},
    hiddenTrapDefinitions: [
      {
        id: "route_trap",
        kind: HiddenTrapKind.NORMAL,
        candidatePositions: [{ x: 1, y: 0 }, { x: 2, y: 0 }],
        count: 2,
        triggerAffiliations: [Affiliation.PLAYER]
      }
    ],
    unitControlRules: [],
    introDialogueId: null,
    victoryDialogueId: null,
    defeatDialogueId: null
  };
}

export function createSaveStageFactory(id = "save_stage") {
  return new StageFactory({
    definitions: [createSaveStageDefinition(id)],
    characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  });
}

export function createPopulatedSaveBattle(id = "save_stage") {
  const stageFactory = createSaveStageFactory(id);
  const stage = stageFactory.create(id);
  const player = stage.getUnit("save_player");
  const formerEnemy = stage.getUnit("save_enemy");
  const defeated = stage.getUnit("save_defeated");

  player.restoreTroops(91);
  player.setFacing(Facing.NORTH);
  player.setStatus(UnitStatus.CONFUSED, 2);
  player.setStatus(UnitStatus.ILLUSION, 1);
  player.consumeUse(UnitUse.PROJECTILE);
  player.consumeUse(UnitUse.TACTIC, 2);
  player.transitionActionState(UnitActionState.TACTIC_COMMITTED);

  stage.armyManager.transferUnit(formerEnemy, stage.armyManager.playerArmy);
  formerEnemy.transitionActionState(UnitActionState.FINISHED);
  defeated.applyDamage(defeated.troops);
  stage.map.removeUnit(defeated);
  defeated.transitionActionState(UnitActionState.FINISHED);
  stage.setTurnAndPhase(4, "PLAYER");
  stage.eventManager.markCompleted(stage.eventManager.get("save_event"));

  const firstTrap = new HiddenTrap({
    id: "route_trap_1",
    kind: HiddenTrapKind.NORMAL,
    position: { x: 1, y: 0 },
    active: true,
    triggerAffiliations: [Affiliation.PLAYER]
  });
  const secondTrap = new HiddenTrap({
    id: "route_trap_2",
    kind: HiddenTrapKind.NORMAL,
    position: { x: 2, y: 0 },
    active: true,
    triggerAffiliations: [Affiliation.PLAYER]
  });
  secondTrap.deactivate();
  stage.addHiddenTrap(firstTrap);
  stage.addHiddenTrap(secondTrap);
  stage.battleLog.append({
    turn: 4,
    phase: "PLAYER",
    type: "test",
    text: "Restorable log entry.",
    unitIds: [player.id, defeated.id]
  });

  const battleRandom = new BattleRandom(123456789);
  battleRandom.next();
  const battle = createBattleSaveData(stage, battleRandom);
  stage.validateRuntime();
  return { stageFactory, stage, battleRandom, battle };
}
