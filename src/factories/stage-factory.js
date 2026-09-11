import {
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireNonEmptyString
} from "../core/domain-error.js";
import {
  createDialoguePresentationRequest,
  createNoticePresentationRequest,
  PresentationRequestType
} from "../core/presentation-request.js";
import { Affiliation, Army, ArmyManager } from "../domain/army.js";
import { BattleLog } from "../domain/battle-log.js";
import { BattleMap } from "../domain/battle-map.js";
import { Character, CharacterManager } from "../domain/character.js";
import { Dialogue, DialogueManager, Speech, SpeechManager } from "../domain/dialogue.js";
import { HiddenTrapDefinition } from "../domain/hidden-trap.js";
import {
  EliminationObjective,
  ObjectiveManager,
  ObjectiveOutcome,
  ObjectiveType,
  ReachObjective,
  SurviveUntilTurnObjective,
  TurnLimitObjective,
  UnitDefeatMatch,
  UnitDefeatObjective
} from "../domain/objective.js";
import { Position } from "../domain/position.js";
import {
  PursuitAIRule,
  StageAIConfig,
  TargetPriorityAIRule,
  WideIllusionAIRule
} from "../domain/stage-ai-config.js";
import { Stage, StagePhase } from "../domain/stage.js";
import {
  BetrayalEvent,
  DialogueEvent,
  MissionTransitionEvent,
  ReinforcementEvent,
  StageEventManager,
  StageEventType
} from "../domain/stage-event.js";
import { TerrainCatalog } from "../domain/terrain.js";
import { UnitControlRule } from "../domain/unit-control-rule.js";
import { Facing, Unit, UnitActionState } from "../domain/unit.js";

function optionalArray(value, code) {
  const normalized = value ?? [];
  invariant(Array.isArray(normalized), code);
  return normalized;
}

function optionalObject(value, code) {
  const normalized = value ?? {};
  invariant(normalized !== null && typeof normalized === "object" && !Array.isArray(normalized), code);
  return normalized;
}

/**
 * data-only Stage Definitionから完全なruntime graphを生成する。
 * Save復元と乱数消費は意図的に担当しない。
 */
export class StageFactory {
  #definitionsById;
  #characterManager;
  #terrainCatalog;

  constructor({ definitions, characterManager, terrainCatalog }) {
    invariant(Array.isArray(definitions) && definitions.length > 0, "STAGE_DEFINITIONS_REQUIRED");
    invariant(characterManager instanceof CharacterManager, "STAGE_FACTORY_CHARACTER_MANAGER_REQUIRED");
    invariant(terrainCatalog instanceof TerrainCatalog, "STAGE_FACTORY_TERRAIN_CATALOG_REQUIRED");
    this.#definitionsById = new Map();
    this.#characterManager = characterManager;
    this.#terrainCatalog = terrainCatalog;

    for (const definition of definitions) {
      invariant(definition !== null && typeof definition === "object", "STAGE_DEFINITION_INVALID");
      const stageId = requireIdentifier(definition.id, "STAGE_DEFINITION_ID_INVALID");
      invariant(!this.#definitionsById.has(stageId), "STAGE_DEFINITION_ID_DUPLICATE", { stageId });
      this.#definitionsById.set(stageId, definition);
    }
  }

  create(stageId) {
    const definition = this.#definitionsById.get(stageId);
    invariant(definition !== undefined, "STAGE_DEFINITION_NOT_FOUND", { stageId });
    this.#validateBasicDefinition(definition);

    // 2. Stage固有mob人物を生成する。
    const mobCharacters = this.#createMobCharacters(definition);
    const runtimeCharactersById = new Map(
      this.#characterManager.getAll().map((character) => [character.id, character])
    );
    for (const character of mobCharacters) {
      invariant(!runtimeCharactersById.has(character.id), "STAGE_CHARACTER_ID_COLLISION", {
        characterId: character.id
      });
      runtimeCharactersById.set(character.id, character);
    }

    // 3. 将来増援を含む全Unitとimmutable Definition順を生成する。
    const units = definition.units.map((unitDefinition) => this.#createUnit(
      unitDefinition,
      runtimeCharactersById
    ));
    const unitsById = new Map();
    for (const unit of units) {
      invariant(!unitsById.has(unit.id), "STAGE_UNIT_ID_DUPLICATE", { unitId: unit.id });
      unitsById.set(unit.id, unit);
    }
    const unitOrder = Object.freeze([...units]);

    // 4. Terrain ref解決済みBattleMapを生成する。
    const terrainRows = definition.map.map((row) => row.map((terrainId) => {
      requireIdentifier(terrainId, "STAGE_TERRAIN_ID_INVALID");
      return this.#terrainCatalog.get(terrainId);
    }));
    const map = new BattleMap(terrainRows);

    // 5. Army graphを生成する。
    const playerArmy = new Army({ id: "player_army", affiliation: Affiliation.PLAYER });
    const enemyArmy = new Army({ id: "enemy_army", affiliation: Affiliation.ENEMY });
    const armyManager = new ArmyManager({ playerArmy, enemyArmy });

    // 6. 初期所属を登録する。
    for (const unitDefinition of definition.units) {
      const unit = unitsById.get(unitDefinition.id);
      const affiliation = unitDefinition.army ?? null;
      if (affiliation === null) {
        continue;
      }
      requireEnumValue(affiliation, Affiliation, "STAGE_UNIT_ARMY_INVALID");
      const army = affiliation === Affiliation.PLAYER ? playerArmy : enemyArmy;
      armyManager.addUnit(unit, army);
    }

    // 7. 初期配置を行う。Preview情報は生成しない。
    for (const unitDefinition of definition.units) {
      const unit = unitsById.get(unitDefinition.id);
      const positionValue = unitDefinition.position ?? null;
      if (positionValue === null) {
        continue;
      }
      const position = Position.from(positionValue);
      invariant(armyManager.getArmy(unit) !== null, "STAGE_PLACED_UNIT_WITHOUT_ARMY", { unitId: unit.id });
      const cell = map.getCellAt(position.x, position.y);
      invariant(cell !== null, "STAGE_UNIT_POSITION_OUTSIDE", { unitId: unit.id });
      invariant(cell.terrain.canEnter(unit), "STAGE_UNIT_TERRAIN_FORBIDDEN", { unitId: unit.id });
      map.placeUnit(unit, position);
    }

    // 8-9. SpeechとDialogueをruntime refで接続する。
    const speeches = optionalArray(definition.speeches, "STAGE_SPEECH_DEFINITIONS_INVALID").map(
      (speechDefinition) => new Speech({
        id: speechDefinition.id,
        speaker: this.#getCharacter(runtimeCharactersById, speechDefinition.speakerCharacterId),
        text: speechDefinition.text,
        actionLabel: speechDefinition.actionLabel
      })
    );
    const speechManager = new SpeechManager(speeches);
    const dialogues = optionalArray(definition.dialogues, "STAGE_DIALOGUE_DEFINITIONS_INVALID").map(
      (dialogueDefinition) => new Dialogue({
        id: dialogueDefinition.id,
        speeches: optionalArray(dialogueDefinition.speechIds, "STAGE_DIALOGUE_SPEECH_IDS_INVALID")
          .map((speechId) => speechManager.get(speechId))
      })
    );
    const dialogueManager = new DialogueManager(dialogues);

    // 10-12. Event instanceを全生成してからID refと循環を解決する。
    const events = optionalArray(definition.events, "STAGE_EVENT_DEFINITIONS_INVALID").map(
      (eventDefinition) => this.#createEvent(
        eventDefinition,
        unitsById,
        armyManager,
        dialogueManager
      )
    );
    const eventManager = new StageEventManager(events);

    // 13-14. ObjectiveのUnit/Event/Army IDをruntime refへ解決する。
    const objectiveDefinitions = optionalArray(
      definition.objectives,
      "STAGE_OBJECTIVE_DEFINITIONS_INVALID"
    );
    const objectives = objectiveDefinitions.map((objectiveDefinition) => this.#createObjective(
      objectiveDefinition,
      unitsById,
      armyManager,
      eventManager
    ));
    const objectiveManager = new ObjectiveManager(objectives);

    // 15. Stage固有AIのUnit IDをruntime参照へ解決する。
    const aiConfigDefinition = optionalObject(definition.aiConfig, "STAGE_AI_CONFIG_INVALID");
    const aiConfig = this.#createAIConfig(aiConfigDefinition, unitsById);

    // 16. Trap候補定義だけを作る。active Trap生成で乱数を消費しない。
    const hiddenTrapDefinitions = optionalArray(
      definition.hiddenTrapDefinitions,
      "STAGE_TRAP_DEFINITIONS_INVALID"
    ).map((trapDefinition) => new HiddenTrapDefinition(trapDefinition));

    // 17. Unit controlとStage Dialogue linkを解決する。
    const unitControlRules = optionalArray(
      definition.unitControlRules,
      "STAGE_UNIT_CONTROL_DEFINITIONS_INVALID"
    ).map((ruleDefinition) => new UnitControlRule({
      unit: this.#getUnit(unitsById, ruleDefinition.unitId),
      alwaysInactive: ruleDefinition.alwaysInactive === true,
      inactiveUntilEvent: ruleDefinition.inactiveUntilEventId === undefined
        || ruleDefinition.inactiveUntilEventId === null
        ? null
        : eventManager.get(ruleDefinition.inactiveUntilEventId),
      activateOnCompletionDuringOwnPhase: ruleDefinition.activateOnCompletionDuringOwnPhase === true,
      actionLabel: ruleDefinition.actionLabel
    }));

    const getDialogueLink = (dialogueId) => {
      if (dialogueId === undefined || dialogueId === null) {
        return null;
      }
      return dialogueManager.get(dialogueId);
    };

    // 18. 元Definitionを保持しない完成Stageを生成する。
    const stage = new Stage({
      id: definition.id,
      chapterNumber: definition.chapterNumber,
      titleKey: definition.titleKey,
      turn: 1,
      phase: StagePhase.PLAYER,
      map,
      units,
      unitOrder,
      armyManager,
      speechManager,
      dialogueManager,
      eventManager,
      objectiveManager,
      aiConfig,
      mobCharacters,
      unitControlRules,
      hiddenTrapDefinitions,
      hiddenTraps: [],
      battleLog: new BattleLog(),
      introDialogue: getDialogueLink(definition.introDialogueId),
      victoryDialogue: getDialogueLink(definition.victoryDialogueId),
      defeatDialogue: getDialogueLink(definition.defeatDialogueId)
    });

    // 19-20. graph全体を検証してからだけ返す。
    stage.validateRuntime();
    return stage;
  }

  #createEvent(definition, unitsById, armyManager, dialogueManager) {
    invariant(
      definition !== null && typeof definition === "object" && !Array.isArray(definition),
      "STAGE_EVENT_DEFINITION_INVALID"
    );
    const type = requireEnumValue(
      definition.type,
      StageEventType,
      "STAGE_EVENT_DEFINITION_TYPE_INVALID"
    );
    const common = {
      id: definition.id,
      ...(definition.triggers === undefined
        ? { trigger: definition.trigger }
        : { triggers: definition.triggers }),
      requiredCompletedEventIds: definition.requiredCompletedEventIds ?? [],
      interruptMovement: definition.interruptMovement ?? false,
      presentationRequests: this.#createPresentationRequests(
        definition.presentationRequests ?? [],
        dialogueManager
      )
    };

    if (type === StageEventType.REINFORCEMENT) {
      return new ReinforcementEvent({
        ...common,
        deployments: optionalArray(
          definition.deployments,
          "REINFORCEMENT_DEPLOYMENT_DEFINITIONS_INVALID"
        ).map((deployment) => ({
          unit: this.#getUnit(unitsById, deployment.unitId),
          preferredPosition: deployment.preferredPosition
        })),
        targetArmy: this.#getArmy(armyManager, definition.targetArmy),
        turnAtLeast: definition.turnAtLeast ?? null,
        triggerUnit: this.#getOptionalUnit(unitsById, definition.triggerUnitId),
        requiredDefeatedUnits: optionalArray(
          definition.requiredDefeatedUnitIds,
          "REINFORCEMENT_REQUIRED_DEFEATED_IDS_INVALID"
        ).map((unitId) => this.#getUnit(unitsById, unitId))
      });
    }

    if (type === StageEventType.BETRAYAL) {
      const confusionTargetArmy = definition.confusionTargetArmy === undefined
        || definition.confusionTargetArmy === null
        ? null
        : this.#getArmy(armyManager, definition.confusionTargetArmy);
      return new BetrayalEvent({
        ...common,
        units: optionalArray(
          definition.unitIds,
          "BETRAYAL_UNIT_IDS_INVALID"
        ).map((unitId) => this.#getUnit(unitsById, unitId)),
        targetArmy: this.#getArmy(armyManager, definition.targetArmy),
        turnAtLeast: definition.turnAtLeast ?? null,
        newFacing: definition.newFacing ?? null,
        confusionTargetArmy,
        confusionTurns: definition.confusionTurns ?? 0
      });
    }

    if (type === StageEventType.MISSION_TRANSITION) {
      return new MissionTransitionEvent({
        ...common,
        requiredDefeatedUnits: optionalArray(
          definition.requiredDefeatedUnitIds,
          "MISSION_TRANSITION_UNIT_IDS_INVALID"
        ).map((unitId) => this.#getUnit(unitsById, unitId)),
        turnAtLeast: definition.turnAtLeast ?? null
      });
    }

    return new DialogueEvent({
      ...common,
      trapKinds: optionalArray(definition.trapKinds, "DIALOGUE_EVENT_TRAP_KINDS_INVALID"),
      triggerUnit: this.#getOptionalUnit(unitsById, definition.triggerUnitId),
      turnAtLeast: definition.turnAtLeast ?? null
    });
  }

  #createObjective(definition, unitsById, armyManager, eventManager) {
    invariant(
      definition !== null && typeof definition === "object" && !Array.isArray(definition),
      "STAGE_OBJECTIVE_DEFINITION_INVALID"
    );
    const type = requireEnumValue(
      definition.type,
      ObjectiveType,
      "STAGE_OBJECTIVE_DEFINITION_TYPE_INVALID"
    );
    const common = {
      id: definition.id,
      activeAfterEvent: this.#getOptionalEvent(eventManager, definition.activeAfterEventId),
      inactiveAfterEvent: this.#getOptionalEvent(eventManager, definition.inactiveAfterEventId)
    };

    if (type === ObjectiveType.ELIMINATION) {
      return new EliminationObjective({
        ...common,
        outcome: requireEnumValue(
          definition.outcome,
          ObjectiveOutcome,
          "STAGE_OBJECTIVE_OUTCOME_INVALID"
        ),
        targetArmy: this.#getArmy(armyManager, definition.targetArmy)
      });
    }

    if (type === ObjectiveType.REACH) {
      return new ReachObjective({
        ...common,
        outcome: requireEnumValue(
          definition.outcome,
          ObjectiveOutcome,
          "STAGE_OBJECTIVE_OUTCOME_INVALID"
        ),
        units: optionalArray(
          definition.unitIds,
          "REACH_OBJECTIVE_UNIT_IDS_INVALID"
        ).map((unitId) => this.#getUnit(unitsById, unitId)),
        destination: definition.destination,
        radius: definition.radius ?? 0
      });
    }

    if (type === ObjectiveType.UNIT_DEFEAT) {
      return new UnitDefeatObjective({
        ...common,
        outcome: requireEnumValue(
          definition.outcome,
          ObjectiveOutcome,
          "STAGE_OBJECTIVE_OUTCOME_INVALID"
        ),
        units: optionalArray(
          definition.unitIds,
          "UNIT_DEFEAT_OBJECTIVE_UNIT_IDS_INVALID"
        ).map((unitId) => this.#getUnit(unitsById, unitId)),
        match: definition.match ?? UnitDefeatMatch.ANY
      });
    }

    if (type === ObjectiveType.TURN_LIMIT) {
      invariant(
        definition.outcome === undefined || definition.outcome === ObjectiveOutcome.DEFEAT,
        "TURN_LIMIT_OBJECTIVE_OUTCOME_INVALID"
      );
      return new TurnLimitObjective({
        ...common,
        maxTurn: definition.maxTurn
      });
    }

    invariant(
      definition.outcome === undefined || definition.outcome === ObjectiveOutcome.VICTORY,
      "SURVIVE_OBJECTIVE_OUTCOME_INVALID"
    );
    return new SurviveUntilTurnObjective({
      ...common,
      targetTurn: definition.targetTurn
    });
  }

  #createPresentationRequests(definitions, dialogueManager) {
    invariant(Array.isArray(definitions), "PRESENTATION_REQUEST_DEFINITIONS_INVALID");
    return definitions.map((definition) => {
      invariant(
        definition !== null && typeof definition === "object" && !Array.isArray(definition),
        "PRESENTATION_REQUEST_DEFINITION_INVALID"
      );
      const type = requireEnumValue(
        definition.type,
        PresentationRequestType,
        "PRESENTATION_REQUEST_DEFINITION_TYPE_INVALID"
      );
      invariant(
        type === PresentationRequestType.DIALOGUE || type === PresentationRequestType.NOTICE,
        "STAGE_EVENT_PRESENTATION_TYPE_INVALID"
      );
      if (type === PresentationRequestType.DIALOGUE) {
        return createDialoguePresentationRequest(dialogueManager.get(definition.dialogueId));
      }
      return createNoticePresentationRequest(
        definition.messageKey,
        definition.parameters ?? {}
      );
    });
  }

  #createAIConfig(definition, unitsById) {
    const adviserUnits = optionalArray(
      definition.adviserUnitIds,
      "STAGE_AI_ADVISER_IDS_INVALID"
    ).map((unitId) => this.#getUnit(unitsById, unitId));
    const cautiousElementalUnits = optionalArray(
      definition.cautiousElementalUnitIds,
      "STAGE_AI_CAUTIOUS_ELEMENTAL_IDS_INVALID"
    ).map((unitId) => this.#getUnit(unitsById, unitId));
    const wideIllusionRules = optionalArray(
      definition.wideIllusionRules,
      "STAGE_AI_WIDE_ILLUSION_DEFINITIONS_INVALID"
    ).map((rule) => {
      invariant(
        rule !== null && typeof rule === "object" && !Array.isArray(rule),
        "STAGE_AI_WIDE_ILLUSION_DEFINITION_INVALID"
      );
      return new WideIllusionAIRule({
        actor: this.#getUnit(unitsById, rule.actorUnitId),
        suppressor: this.#getUnit(unitsById, rule.suppressorUnitId),
        suppressionRange: rule.suppressionRange ?? 3
      });
    });
    const pursuitRules = optionalArray(
      definition.pursuitRules,
      "STAGE_AI_PURSUIT_DEFINITIONS_INVALID"
    ).map((rule) => {
      invariant(
        rule !== null && typeof rule === "object" && !Array.isArray(rule),
        "STAGE_AI_PURSUIT_DEFINITION_INVALID"
      );
      return new PursuitAIRule({
        units: optionalArray(rule.unitIds, "STAGE_AI_PURSUIT_UNIT_IDS_INVALID")
          .map((unitId) => this.#getUnit(unitsById, unitId)),
        gateColumns: rule.gateColumns,
        insideMaximumRow: rule.insideMaximumRow,
        outsideRow: rule.outsideRow,
        candidateMinimumRow: rule.candidateMinimumRow ?? 1
      });
    });
    const targetPriorityRules = optionalArray(
      definition.targetPriorityRules,
      "STAGE_AI_TARGET_PRIORITY_DEFINITIONS_INVALID"
    ).map((rule) => {
      invariant(
        rule !== null && typeof rule === "object" && !Array.isArray(rule),
        "STAGE_AI_TARGET_PRIORITY_DEFINITION_INVALID"
      );
      return new TargetPriorityAIRule({
        actors: optionalArray(rule.actorUnitIds, "STAGE_AI_TARGET_PRIORITY_ACTOR_IDS_INVALID")
          .map((unitId) => this.#getUnit(unitsById, unitId)),
        targets: optionalArray(rule.targetUnitIds, "STAGE_AI_TARGET_PRIORITY_TARGET_IDS_INVALID")
          .map((unitId) => this.#getUnit(unitsById, unitId)),
        disableStrategy: rule.disableStrategy ?? false
      });
    });
    return new StageAIConfig({
      adviserUnits,
      cautiousElementalUnits,
      wideIllusionRules,
      pursuitRules,
      targetPriorityRules
    });
  }

  #getOptionalEvent(eventManager, eventId) {
    if (eventId === undefined || eventId === null) {
      return null;
    }
    return eventManager.get(eventId);
  }

  #getArmy(armyManager, affiliation) {
    const normalized = requireEnumValue(affiliation, Affiliation, "STAGE_ARMY_AFFILIATION_INVALID");
    if (normalized === Affiliation.PLAYER) {
      return armyManager.playerArmy;
    }
    return armyManager.enemyArmy;
  }

  #getOptionalUnit(unitsById, unitId) {
    if (unitId === undefined || unitId === null) {
      return null;
    }
    return this.#getUnit(unitsById, unitId);
  }

  #validateBasicDefinition(definition) {
    requireIdentifier(definition.id, "STAGE_DEFINITION_ID_INVALID");
    requireNonEmptyString(definition.titleKey, "STAGE_TITLE_KEY_INVALID");
    invariant(Number.isInteger(definition.chapterNumber) && definition.chapterNumber >= 0, "STAGE_CHAPTER_INVALID");
    invariant(Array.isArray(definition.map) && definition.map.length > 0, "STAGE_MAP_REQUIRED");
    invariant(Array.isArray(definition.map[0]) && definition.map[0].length > 0, "STAGE_MAP_ROW_INVALID");
    const width = definition.map[0].length;
    invariant(
      definition.map.every((row) => Array.isArray(row) && row.length === width),
      "STAGE_MAP_NOT_RECTANGULAR"
    );
    invariant(Array.isArray(definition.units) && definition.units.length > 0, "STAGE_UNITS_REQUIRED");
  }

  #createMobCharacters(definition) {
    return optionalArray(definition.mobCharacters, "STAGE_MOB_DEFINITIONS_INVALID")
      .map((characterDefinition) => new Character(characterDefinition));
  }

  #createUnit(definition, charactersById) {
    invariant(definition !== null && typeof definition === "object", "STAGE_UNIT_DEFINITION_INVALID");
    return new Unit({
      id: definition.id,
      character: this.#getCharacter(charactersById, definition.characterId),
      maxTroops: definition.maxTroops,
      troops: definition.troops ?? definition.maxTroops,
      move: definition.move,
      abilities: definition.abilities ?? [],
      facing: definition.facing ?? Facing.SOUTH,
      actionState: definition.actionState ?? UnitActionState.READY,
      statusEffects: definition.statusEffects ?? [],
      maxUses: definition.maxUses ?? {},
      remainingUses: definition.remainingUses ?? definition.maxUses ?? {}
    });
  }

  #getCharacter(charactersById, characterId) {
    const character = charactersById.get(characterId);
    invariant(character !== undefined, "STAGE_CHARACTER_NOT_FOUND", { characterId });
    return character;
  }

  #getUnit(unitsById, unitId) {
    const unit = unitsById.get(unitId);
    invariant(unit !== undefined, "STAGE_UNIT_NOT_FOUND", { unitId });
    return unit;
  }
}
