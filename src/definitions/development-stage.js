import { Affiliation } from "../domain/army.js";
import { ObjectiveOutcome, ObjectiveType } from "../domain/objective.js";
import { Facing, UnitActionState } from "../domain/unit.js";
import { UnitAbility, UnitUse } from "../domain/unit-ability.js";

/**
 * OO境界とPreviewを検証する専用fixture。
 * 正本人物・正式Stage・ゲームbalanceとして扱わない。
 */
export const DEVELOPMENT_STAGE_DEFINITION = Object.freeze({
  id: "foundation_preview",
  chapterNumber: 0,
  titleKey: "stage.foundation_preview",
  map: Object.freeze([
    Object.freeze(["plain", "plain", "forest", "plain", "plain", "hill", "plain"]),
    Object.freeze(["plain", "wall", "wall", "road", "wall", "wall", "plain"]),
    Object.freeze(["plain", "plain", "plain", "road", "plain", "plain", "plain"]),
    Object.freeze(["plain", "wall", "forest", "swamp", "forest", "wall", "plain"]),
    Object.freeze(["plain", "plain", "plain", "plain", "plain", "plain", "water"])
  ]),
  mobCharacters: Object.freeze([
    Object.freeze({
      id: "development_player",
      name: "Development Player",
      shortName: "P",
      martial: 50,
      command: 50,
      intelligence: 50,
      charisma: 50,
      source: "development_fixture"
    }),
    Object.freeze({
      id: "development_enemy",
      name: "Development Enemy",
      shortName: "E",
      martial: 50,
      command: 50,
      intelligence: 50,
      charisma: 50,
      source: "development_fixture"
    }),
    Object.freeze({
      id: "development_reserve",
      name: "Development Reserve",
      shortName: "R",
      martial: 50,
      command: 50,
      intelligence: 50,
      charisma: 50,
      source: "development_fixture"
    })
  ]),
  units: Object.freeze([
    Object.freeze({
      id: "preview_player",
      characterId: "development_player",
      maxTroops: 125,
      move: 5,
      abilities: Object.freeze([
        UnitAbility.BOW_ATTACK,
        UnitAbility.CHARGE,
        UnitAbility.CONFUSION_LEVEL_3,
        UnitAbility.ILLUSION,
        UnitAbility.WIDE_ILLUSION,
        UnitAbility.FIRE_TACTIC,
        UnitAbility.WATER_TACTIC
      ]),
      maxUses: Object.freeze({
        [UnitUse.PROJECTILE]: 2,
        [UnitUse.CHARGE]: 3,
        [UnitUse.TACTIC]: 6
      }),
      facing: Facing.EAST,
      army: Affiliation.PLAYER,
      position: Object.freeze({ x: 0, y: 2 })
    }),
    Object.freeze({
      id: "preview_enemy",
      characterId: "development_enemy",
      maxTroops: 125,
      move: 4,
      facing: Facing.WEST,
      army: Affiliation.ENEMY,
      position: Object.freeze({ x: 6, y: 2 })
    }),
    Object.freeze({
      id: "preview_reserve",
      characterId: "development_reserve",
      maxTroops: 125,
      move: 4,
      facing: Facing.SOUTH,
      actionState: UnitActionState.FINISHED,
      army: null,
      position: null
    })
  ]),
  speeches: Object.freeze([
    Object.freeze({
      id: "foundation_notice",
      speakerCharacterId: "development_player",
      text: "This is a development fixture, not game content."
    })
  ]),
  dialogues: Object.freeze([
    Object.freeze({
      id: "foundation_intro",
      speechIds: Object.freeze(["foundation_notice"])
    })
  ]),
  events: Object.freeze([]),
  objectives: Object.freeze([
    Object.freeze({
      id: "development_victory",
      type: ObjectiveType.ELIMINATION,
      outcome: ObjectiveOutcome.VICTORY,
      targetArmy: Affiliation.ENEMY
    }),
    Object.freeze({
      id: "development_defeat",
      type: ObjectiveType.ELIMINATION,
      outcome: ObjectiveOutcome.DEFEAT,
      targetArmy: Affiliation.PLAYER
    })
  ]),
  aiConfig: Object.freeze({}),
  hiddenTrapDefinitions: Object.freeze([]),
  unitControlRules: Object.freeze([]),
  introDialogueId: "foundation_intro",
  victoryDialogueId: null,
  defeatDialogueId: null
});
