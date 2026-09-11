import {
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireIntegerInRange,
  requireNonEmptyString
} from "../core/domain-error.js";
import { ArmyManager } from "./army.js";
import { BattleLog } from "./battle-log.js";
import { BattleMap } from "./battle-map.js";
import { Character } from "./character.js";
import { Dialogue, DialogueManager, SpeechManager } from "./dialogue.js";
import { HiddenTrap, HiddenTrapDefinition } from "./hidden-trap.js";
import { ObjectiveManager } from "./objective.js";
import { StageEventManager } from "./stage-event.js";
import { StageAIConfig } from "./stage-ai-config.js";
import { UnitControlRule } from "./unit-control-rule.js";
import { Unit } from "./unit.js";

export const StagePhase = Object.freeze({
  PLAYER: "PLAYER",
  ENEMY: "ENEMY"
});

/**
 * 1戦闘のruntime object graphの根。
 */
export class Stage {
  #turn;
  #phase;
  #unitsById;
  #hiddenTraps;

  constructor({
    id,
    chapterNumber,
    titleKey,
    turn = 1,
    phase = StagePhase.PLAYER,
    map,
    units,
    unitOrder,
    armyManager,
    speechManager,
    dialogueManager,
    eventManager,
    objectiveManager,
    aiConfig = new StageAIConfig(),
    mobCharacters = [],
    unitControlRules = [],
    hiddenTrapDefinitions = [],
    hiddenTraps = [],
    battleLog = new BattleLog(),
    introDialogue = null,
    victoryDialogue = null,
    defeatDialogue = null
  }) {
    this.id = requireIdentifier(id, "STAGE_ID_INVALID");
    this.chapterNumber = requireIntegerInRange(
      chapterNumber,
      0,
      Number.MAX_SAFE_INTEGER,
      "STAGE_CHAPTER_INVALID"
    );
    this.titleKey = requireNonEmptyString(titleKey, "STAGE_TITLE_KEY_INVALID");
    this.#turn = requireIntegerInRange(turn, 1, Number.MAX_SAFE_INTEGER, "STAGE_TURN_INVALID");
    this.#phase = requireEnumValue(phase, StagePhase, "STAGE_PHASE_INVALID");
    invariant(map instanceof BattleMap, "STAGE_MAP_REQUIRED");
    this.map = map;

    invariant(Array.isArray(units) && units.every((unit) => unit instanceof Unit), "STAGE_UNITS_INVALID");
    this.#unitsById = new Map();
    for (const unit of units) {
      invariant(!this.#unitsById.has(unit.id), "STAGE_UNIT_ID_DUPLICATE", { unitId: unit.id });
      this.#unitsById.set(unit.id, unit);
    }

    invariant(Array.isArray(unitOrder), "STAGE_UNIT_ORDER_INVALID");
    this.unitOrder = Object.freeze([...unitOrder]);
    invariant(armyManager instanceof ArmyManager, "STAGE_ARMY_MANAGER_REQUIRED");
    invariant(speechManager instanceof SpeechManager, "STAGE_SPEECH_MANAGER_REQUIRED");
    invariant(dialogueManager instanceof DialogueManager, "STAGE_DIALOGUE_MANAGER_REQUIRED");
    invariant(eventManager instanceof StageEventManager, "STAGE_EVENT_MANAGER_REQUIRED");
    invariant(objectiveManager instanceof ObjectiveManager, "STAGE_OBJECTIVE_MANAGER_REQUIRED");
    invariant(battleLog instanceof BattleLog, "STAGE_BATTLE_LOG_REQUIRED");
    this.armyManager = armyManager;
    this.speechManager = speechManager;
    this.dialogueManager = dialogueManager;
    this.eventManager = eventManager;
    this.objectiveManager = objectiveManager;
    invariant(aiConfig instanceof StageAIConfig, "STAGE_AI_CONFIG_REQUIRED");
    this.aiConfig = aiConfig;

    invariant(
      Array.isArray(mobCharacters) && mobCharacters.every((character) => character instanceof Character),
      "STAGE_MOB_CHARACTERS_INVALID"
    );
    this.mobCharacters = Object.freeze([...mobCharacters]);
    invariant(
      Array.isArray(unitControlRules) && unitControlRules.every((rule) => rule instanceof UnitControlRule),
      "STAGE_UNIT_CONTROL_RULES_INVALID"
    );
    this.unitControlRules = Object.freeze([...unitControlRules]);
    invariant(
      Array.isArray(hiddenTrapDefinitions)
        && hiddenTrapDefinitions.every((definition) => definition instanceof HiddenTrapDefinition),
      "STAGE_TRAP_DEFINITIONS_INVALID"
    );
    this.hiddenTrapDefinitions = Object.freeze([...hiddenTrapDefinitions]);
    invariant(
      Array.isArray(hiddenTraps) && hiddenTraps.every((trap) => trap instanceof HiddenTrap),
      "STAGE_HIDDEN_TRAPS_INVALID"
    );
    this.#hiddenTraps = [...hiddenTraps];
    this.battleLog = battleLog;

    for (const dialogue of [introDialogue, victoryDialogue, defeatDialogue]) {
      invariant(dialogue === null || dialogue instanceof Dialogue, "STAGE_DIALOGUE_LINK_INVALID");
    }
    this.introDialogue = introDialogue;
    this.victoryDialogue = victoryDialogue;
    this.defeatDialogue = defeatDialogue;
  }

  get turn() {
    return this.#turn;
  }

  get phase() {
    return this.#phase;
  }

  get unitsById() {
    return new Map(this.#unitsById);
  }

  getUnit(unitId) {
    const unit = this.#unitsById.get(unitId);
    invariant(unit !== undefined, "STAGE_UNIT_NOT_FOUND", { unitId });
    return unit;
  }

  getUnits() {
    return Object.freeze([...this.#unitsById.values()]);
  }

  getHiddenTraps() {
    return Object.freeze([...this.#hiddenTraps]);
  }

  addHiddenTrap(trap) {
    invariant(trap instanceof HiddenTrap, "STAGE_HIDDEN_TRAP_REQUIRED");
    invariant(!this.#hiddenTraps.some((item) => item.id === trap.id), "STAGE_HIDDEN_TRAP_ID_DUPLICATE");
    invariant(
      !this.#hiddenTraps.some((item) => item.position.equals(trap.position)),
      "STAGE_HIDDEN_TRAP_POSITION_DUPLICATE"
    );
    invariant(this.map.getCellAt(trap.position.x, trap.position.y) !== null, "STAGE_HIDDEN_TRAP_OUTSIDE");
    this.#hiddenTraps.push(trap);
  }

  clearHiddenTraps() {
    this.#hiddenTraps = [];
  }

  setTurnAndPhase(turn, phase) {
    this.#turn = requireIntegerInRange(turn, 1, Number.MAX_SAFE_INTEGER, "STAGE_TURN_INVALID");
    this.#phase = requireEnumValue(phase, StagePhase, "STAGE_PHASE_INVALID");
  }

  validateRuntime() {
    const units = this.getUnits();
    const unitSet = new Set(units);
    invariant(this.unitOrder.length === units.length, "STAGE_UNIT_ORDER_LENGTH_MISMATCH");
    invariant(new Set(this.unitOrder).size === units.length, "STAGE_UNIT_ORDER_DUPLICATE");
    invariant(this.unitOrder.every((unit) => unitSet.has(unit)), "STAGE_UNIT_ORDER_UNKNOWN_UNIT");
    this.map.validateConsistency(units);
    this.armyManager.validateMembership(units);

    for (const unit of units) {
      const army = this.armyManager.getArmy(unit);
      const position = this.map.getPosition(unit);
      if (!unit.hasTroops()) {
        invariant(army !== null && position === null, "STAGE_DEFEATED_UNIT_STATE_INVALID", {
          unitId: unit.id
        });
        continue;
      }
      invariant(
        (army === null && position === null) || (army !== null && position !== null),
        "STAGE_LIVING_UNIT_STATE_INVALID",
        { unitId: unit.id }
      );
    }

    invariant(
      this.unitControlRules.every((rule) => unitSet.has(rule.unit)),
      "STAGE_UNIT_CONTROL_UNKNOWN_UNIT"
    );
    for (const rule of this.unitControlRules) {
      if (rule.inactiveUntilEvent !== null) {
        invariant(
          this.eventManager.has(rule.inactiveUntilEvent.id)
            && this.eventManager.get(rule.inactiveUntilEvent.id) === rule.inactiveUntilEvent,
          "STAGE_UNIT_CONTROL_EVENT_NOT_IN_STAGE",
          { unitId: rule.unit.id }
        );
      }
    }

    for (const event of this.eventManager.getAll()) {
      event.validateRuntime(this);
    }
    for (const objective of this.objectiveManager.getAll()) {
      for (const gateEvent of [objective.activeAfterEvent, objective.inactiveAfterEvent]) {
        if (gateEvent !== null) {
          invariant(
            this.eventManager.has(gateEvent.id) && this.eventManager.get(gateEvent.id) === gateEvent,
            "OBJECTIVE_EVENT_NOT_IN_STAGE",
            { objectiveId: objective.id }
          );
        }
      }
      objective.validateRuntime(this);
    }

    this.aiConfig.validateRuntime(this);

    const trapDefinitionIds = new Set();
    for (const definition of this.hiddenTrapDefinitions) {
      invariant(
        !trapDefinitionIds.has(definition.id),
        "STAGE_TRAP_DEFINITION_ID_DUPLICATE",
        { trapDefinitionId: definition.id }
      );
      trapDefinitionIds.add(definition.id);
      for (const position of definition.candidatePositions) {
        invariant(
          this.map.getCellAt(position.x, position.y) !== null,
          "STAGE_TRAP_DEFINITION_OUTSIDE",
          { trapDefinitionId: definition.id }
        );
      }
    }

    const trapIds = new Set();
    const trapPositionKeys = new Set();
    for (const trap of this.#hiddenTraps) {
      invariant(this.map.getCellAt(trap.position.x, trap.position.y) !== null, "STAGE_HIDDEN_TRAP_OUTSIDE");
      invariant(!trapIds.has(trap.id), "STAGE_HIDDEN_TRAP_ID_DUPLICATE", { trapId: trap.id });
      invariant(
        !trapPositionKeys.has(trap.position.toKey()),
        "STAGE_HIDDEN_TRAP_POSITION_DUPLICATE",
        { trapId: trap.id }
      );
      trapIds.add(trap.id);
      trapPositionKeys.add(trap.position.toKey());
    }
    return true;
  }
}
