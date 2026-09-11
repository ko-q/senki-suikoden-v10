import {
  NullBattleCheckpointPort,
  NullBattlePresentationPort,
  requireBattleCheckpointPort,
  requireBattlePresentationPort
} from "../boundary/battle-ports.js";
import { createActionQueryContext } from "../core/action-query-context.js";
import {
  ActionType,
  COMBAT_ACTION_TYPES,
  TACTIC_ACTION_TYPES
} from "../core/action-request.js";
import { BattleOutcome, createBattleResult } from "../core/battle-result.js";
import { createBattleSaveData } from "../core/battle-save-data.js";
import { BattleFlowState } from "../core/battle-flow-state.js";
import { invariant } from "../core/domain-error.js";
import {
  createDialoguePresentationRequest,
  createSemanticPresentationRequest,
  PresentationRequestType,
  validatePresentationRequest
} from "../core/presentation-request.js";
import { BattleRandom } from "../domain/battle-random.js";
import { Position } from "../domain/position.js";
import { Stage, StagePhase } from "../domain/stage.js";
import { StageEventTrigger } from "../domain/stage-event.js";
import { Facing, Unit, UnitActionState } from "../domain/unit.js";
import {
  AIService,
  EnemyTurnPlanKind,
  ForcedActionType
} from "../services/ai-service.js";
import { CombatService } from "../services/combat-service.js";
import {
  findTriggerableHiddenTrap,
  generateHiddenTraps,
  resolveHiddenTrap
} from "../services/hidden-trap-rules.js";
import { MovementService } from "../services/movement-service.js";
import {
  PhaseStartStatusResult,
  StatusService
} from "../services/status-service.js";
import { TacticService } from "../services/tactic-service.js";

export { BattleFlowState };

const ALL_ACTION_TYPES = Object.freeze(Object.values(ActionType));
const COMBAT_ACTION_TYPE_SET = new Set(COMBAT_ACTION_TYPES);
const TACTIC_ACTION_TYPE_SET = new Set(TACTIC_ACTION_TYPES);

function createAbortError() {
  const error = new Error("BATTLE_DISPOSED");
  error.name = "AbortError";
  return error;
}

function copyPath(path) {
  return Object.freeze(path.map((position) => new Position(position.x, position.y)));
}

function positionPayload(position) {
  if (position === null) {
    return null;
  }
  return { x: position.x, y: position.y };
}

function statusEffectsPayload(unit) {
  return unit.statusEffects.map((effect) => ({
    type: effect.type,
    remainingTurns: effect.remainingTurns
  }));
}

/**
 * Domain更新順、非同期Presentation、phase進行を一か所で直列化する。
 */
export class BattleController {
  #stage;
  #battleRandom;
  #movementService;
  #combatService;
  #tacticService;
  #statusService;
  #aiService;
  #presentationPort;
  #checkpointPort;
  #abortController;
  #flowState;
  #started;
  #disposed;
  #latchedResult;
  #completionPromise;
  #resolveCompletion;
  #rejectCompletion;
  #completionSettled;
  #diagnostics;

  constructor({
    stage,
    battleRandom,
    movementService,
    combatService,
    tacticService,
    statusService,
    aiService,
    presentationPort = new NullBattlePresentationPort(),
    checkpointPort = new NullBattleCheckpointPort()
  }) {
    invariant(stage instanceof Stage, "BATTLE_CONTROLLER_STAGE_REQUIRED");
    invariant(battleRandom instanceof BattleRandom, "BATTLE_CONTROLLER_RANDOM_REQUIRED");
    invariant(
      movementService instanceof MovementService,
      "BATTLE_CONTROLLER_MOVEMENT_SERVICE_REQUIRED"
    );
    invariant(combatService instanceof CombatService, "BATTLE_CONTROLLER_COMBAT_SERVICE_REQUIRED");
    invariant(tacticService instanceof TacticService, "BATTLE_CONTROLLER_TACTIC_SERVICE_REQUIRED");
    invariant(statusService instanceof StatusService, "BATTLE_CONTROLLER_STATUS_SERVICE_REQUIRED");
    invariant(aiService instanceof AIService, "BATTLE_CONTROLLER_AI_SERVICE_REQUIRED");
    this.#stage = stage;
    this.#battleRandom = battleRandom;
    this.#movementService = movementService;
    this.#combatService = combatService;
    this.#tacticService = tacticService;
    this.#statusService = statusService;
    this.#aiService = aiService;
    this.#presentationPort = requireBattlePresentationPort(presentationPort);
    this.#checkpointPort = requireBattleCheckpointPort(checkpointPort);
    this.#abortController = new AbortController();
    this.#flowState = BattleFlowState.IDLE;
    this.#started = false;
    this.#disposed = false;
    this.#latchedResult = null;
    this.#completionSettled = false;
    this.#diagnostics = [];
    this.#completionPromise = new Promise((resolve, reject) => {
      this.#resolveCompletion = resolve;
      this.#rejectCompletion = reject;
    });
    // 呼出側が後からPromiseを受け取る場合でも、内部rejectを未処理にしない。
    this.#completionPromise.catch(() => {});
  }

  get flowState() {
    return this.#flowState;
  }

  get isDisposed() {
    return this.#disposed;
  }

  getStage() {
    return this.#stage;
  }

  getBattleResult() {
    return this.#latchedResult;
  }

  getDiagnostics() {
    return Object.freeze([...this.#diagnostics]);
  }

  startNewBattle() {
    this.#claimStart();
    this.#flowState = BattleFlowState.TURN_TRANSITION;
    this.#launch(this.#initializeNewBattle());
    return this.#completionPromise;
  }

  resumeLoadedBattle() {
    this.#claimStart();
    this.#flowState = BattleFlowState.TURN_TRANSITION;
    this.#launch(this.#resumeLoadedBattle());
    return this.#completionPromise;
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#abortController.abort();
    if (!this.#completionSettled) {
      this.#completionSettled = true;
      this.#rejectCompletion(createAbortError());
    }
  }

  getReachableCells(unit) {
    if (!this.#canIssuePlayerCommand(unit)) {
      return Object.freeze([]);
    }
    return this.#movementService.getReachableCells(unit, this.#stage);
  }

  getCandidatePaths(unit, destination) {
    if (!this.#canIssuePlayerCommand(unit)) {
      return Object.freeze([]);
    }
    return this.#movementService.getCandidatePaths(unit, destination, this.#stage);
  }

  getAvailableActions(actionQueryContext) {
    if (!this.#canUseActionQueryContext(actionQueryContext)) {
      return Object.freeze([]);
    }
    return Object.freeze(ALL_ACTION_TYPES.filter((actionType) => (
      this.getActionTargets(actionQueryContext, actionType).length > 0
    )));
  }

  getActionTargets(actionQueryContext, actionType) {
    if (
      !ALL_ACTION_TYPES.includes(actionType)
      || !this.#canUseActionQueryContext(actionQueryContext)
    ) {
      return Object.freeze([]);
    }
    if (COMBAT_ACTION_TYPE_SET.has(actionType)) {
      return this.#combatService.inspectTargets(actionType, actionQueryContext, this.#stage);
    }
    return this.#tacticService.inspectTargets(actionType, actionQueryContext, this.#stage);
  }

  async executeAction(request, selectedPath = []) {
    if (!this.#canAcceptAction(request, selectedPath, true)) {
      return false;
    }
    const path = copyPath(selectedPath);
    this.#flowState = BattleFlowState.RESOLVING_ACTION;
    try {
      await this.#executePlannedAction(request, path, true);
      this.#returnToIdleAndCheckpoint();
      return true;
    } catch (error) {
      this.#handleMutationFailure(error);
      throw error;
    }
  }

  async executeWait(actor, selectedPath = [], finalFacing) {
    if (!this.#canAcceptWait(actor, selectedPath, finalFacing, true)) {
      return false;
    }
    const path = copyPath(selectedPath);
    this.#flowState = BattleFlowState.RESOLVING_ACTION;
    try {
      await this.#executeWaitPlan(actor, path, finalFacing);
      this.#returnToIdleAndCheckpoint();
      return true;
    } catch (error) {
      this.#handleMutationFailure(error);
      throw error;
    }
  }

  async finalizeTacticFacing(actor, facing) {
    if (!this.#canFinalizeTacticFacing(actor, facing)) {
      return false;
    }
    this.#flowState = BattleFlowState.RESOLVING_ACTION;
    try {
      actor.setFacing(facing);
      actor.transitionActionState(UnitActionState.FINISHED);
      this.#returnToIdleAndCheckpoint();
      return true;
    } catch (error) {
      this.#handleMutationFailure(error);
      throw error;
    }
  }

  async endPlayerTurn() {
    if (!this.#canEndPlayerTurn()) {
      return false;
    }
    this.#flowState = BattleFlowState.TURN_TRANSITION;
    try {
      for (const unit of this.#stage.armyManager.playerArmy.getUnits()) {
        if (unit.actionState === UnitActionState.READY) {
          unit.transitionActionState(UnitActionState.FINISHED);
        }
      }

      if (this.#resolveVictory()) {
        await this.#finishBattle();
        return true;
      }
      const turnLimit = this.#stage.objectiveManager.evaluatePlayerPhaseEndDefeat(this.#stage);
      if (turnLimit !== null) {
        this.#latchResult(BattleOutcome.DEFEAT, turnLimit);
        await this.#finishBattle();
        return true;
      }

      const phaseStarted = await this.#startPhase(this.#stage.turn, StagePhase.ENEMY);
      if (phaseStarted) {
        await this.#runEnemyPhase();
      }
      return true;
    } catch (error) {
      this.#handleMutationFailure(error);
      throw error;
    }
  }

  isStableForSave() {
    if (
      !this.#started
      || this.#disposed
      || this.#latchedResult !== null
      || this.#flowState !== BattleFlowState.IDLE
    ) {
      return false;
    }

    const committed = [];
    for (const unit of this.#stage.unitOrder) {
      if (unit.actionState === UnitActionState.MOVED) {
        return false;
      }
      if (unit.actionState === UnitActionState.TACTIC_COMMITTED) {
        committed.push(unit);
        continue;
      }
      if (
        unit.actionState !== UnitActionState.READY
        && unit.actionState !== UnitActionState.FINISHED
      ) {
        return false;
      }

      const army = this.#stage.armyManager.getArmy(unit);
      const position = this.#stage.map.getPosition(unit);
      if ((army === null || position === null || !unit.hasTroops())
        && unit.actionState !== UnitActionState.FINISHED) {
        return false;
      }
    }

    if (committed.length === 0) {
      return true;
    }
    if (committed.length !== 1 || this.#stage.phase !== StagePhase.PLAYER) {
      return false;
    }
    const unit = committed[0];
    return unit.hasTroops()
      && this.#stage.map.getPosition(unit) !== null
      && this.#stage.armyManager.playerArmy.has(unit);
  }

  createSaveSnapshot() {
    invariant(this.isStableForSave(), "BATTLE_SAVE_STATE_UNSTABLE");
    return createBattleSaveData(this.#stage, this.#battleRandom);
  }

  async #initializeNewBattle() {
    this.#throwIfDisposed();
    this.#stage.validateRuntime();
    invariant(this.#stage.getHiddenTraps().length === 0, "BATTLE_NEW_TRAPS_ALREADY_PRESENT");
    for (const trap of generateHiddenTraps(this.#stage, this.#battleRandom)) {
      this.#stage.addHiddenTrap(trap);
    }

    if (this.#stage.introDialogue !== null) {
      await this.#present(createDialoguePresentationRequest(this.#stage.introDialogue));
    }
    await this.#startPhase(1, StagePhase.PLAYER);
  }

  async #resumeLoadedBattle() {
    this.#throwIfDisposed();
    this.#stage.validateRuntime();
    this.#validateResumeState();
    this.#flowState = BattleFlowState.IDLE;
    this.#notifyCheckpointIfStable();
    if (this.#stage.phase === StagePhase.ENEMY) {
      await this.#runEnemyPhase();
    }
  }

  async #startPhase(turn, phase) {
    this.#throwIfDisposed();
    this.#flowState = BattleFlowState.TURN_TRANSITION;
    this.#stage.setTurnAndPhase(turn, phase);
    await this.#present(createSemanticPresentationRequest(
      PresentationRequestType.PHASE,
      { turn, phase }
    ));

    await this.#resolveStageEventChain(StageEventTrigger.PHASE_START, { turn, phase });
    if (this.#latchedResult !== null) {
      await this.#finishBattle();
      return false;
    }

    this.#resetUnitsForPhase();
    await this.#processPhaseStartStatuses();
    if (this.#latchedResult !== null) {
      return false;
    }

    if (phase === StagePhase.PLAYER) {
      const surviveObjective = this.#stage.objectiveManager
        .evaluatePlayerPhaseStartVictory(this.#stage);
      if (surviveObjective !== null) {
        this.#latchResult(BattleOutcome.VICTORY, surviveObjective);
        await this.#finishBattle();
        return false;
      }
    }

    this.#flowState = BattleFlowState.IDLE;
    this.#notifyCheckpointIfStable();
    return true;
  }

  #resetUnitsForPhase() {
    const activeArmy = this.#activeArmy();
    for (const unit of this.#stage.unitOrder) {
      const canAct = unit.hasTroops()
        && this.#stage.map.getPosition(unit) !== null
        && activeArmy.has(unit)
        && this.#canActByControlRule(unit);
      unit.setReadyForPhase(canAct);
    }
  }

  async #processPhaseStartStatuses() {
    const activeArmy = this.#activeArmy();
    const processedUnitIds = new Set();

    while (true) {
      const unit = this.#stage.unitOrder.find((candidate) => (
        !processedUnitIds.has(candidate.id)
        && activeArmy.has(candidate)
        && candidate.hasTroops()
        && this.#stage.map.getPosition(candidate) !== null
      ));
      if (unit === undefined) {
        break;
      }
      processedUnitIds.add(unit.id);
      const statusResult = this.#statusService.processPhaseStart(unit);
      if (statusResult === PhaseStartStatusResult.NONE) {
        continue;
      }

      await this.#present(createSemanticPresentationRequest(
        PresentationRequestType.STATUS,
        {
          reason: "PHASE_START",
          unitId: unit.id,
          statusResult,
          statusEffects: statusEffectsPayload(unit)
        }
      ));
      if (unit.actionState !== UnitActionState.READY) {
        continue;
      }

      if (statusResult === PhaseStartStatusResult.CONFUSION_SKIP) {
        unit.transitionActionState(UnitActionState.FINISHED);
        continue;
      }

      this.#flowState = BattleFlowState.RESOLVING_ACTION;
      const plan = this.#aiService.planIllusionAction(unit, this.#stage);
      await this.#executeForcedAction(unit, plan);
      if (this.#latchedResult !== null) {
        return;
      }
      this.#flowState = BattleFlowState.TURN_TRANSITION;
    }
  }

  async #runEnemyPhase() {
    while (!this.#disposed && this.#latchedResult === null) {
      this.#flowState = BattleFlowState.IDLE;
      this.#notifyCheckpointIfStable();
      const unit = this.#aiService.selectNextEnemyUnit(this.#stage);
      if (unit === null) {
        break;
      }

      this.#flowState = BattleFlowState.RESOLVING_ACTION;
      const plan = this.#aiService.planEnemyTurn(unit, this.#stage);
      if (plan.kind === EnemyTurnPlanKind.ACTION) {
        invariant(
          this.#canAcceptAction(plan.request, plan.selectedPath, false),
          "BATTLE_AI_ACTION_PLAN_INVALID"
        );
        await this.#executePlannedAction(plan.request, plan.selectedPath, false);
      } else {
        invariant(
          this.#canAcceptWait(unit, plan.selectedPath, plan.finalFacing, false),
          "BATTLE_AI_WAIT_PLAN_INVALID"
        );
        await this.#executeWaitPlan(unit, plan.selectedPath, plan.finalFacing);
      }
    }

    if (this.#latchedResult !== null || this.#disposed) {
      return;
    }
    await this.#startPhase(this.#stage.turn + 1, StagePhase.PLAYER);
  }

  async #executePlannedAction(request, path, keepPlayerTacticFacing) {
    const movement = await this.#executeCommittedMovement(request.actor, path);
    if (movement.terminal) {
      return;
    }
    if (!movement.completed) {
      await this.#completeAcceptedWithoutAction(request.actor, request.type);
      return;
    }

    if (!this.#canExecuteActionAtCurrentPosition(request)) {
      await this.#completeAcceptedWithoutAction(request.actor, request.type);
      return;
    }

    await this.#presentAction(request.type, request.actor, request.target, false);
    const result = COMBAT_ACTION_TYPE_SET.has(request.type)
      ? this.#combatService.execute(request, this.#stage, this.#battleRandom)
      : this.#tacticService.execute(request, this.#stage, this.#battleRandom);
    const keepFacingSelection = keepPlayerTacticFacing
      && TACTIC_ACTION_TYPE_SET.has(request.type)
      && request.actor.hasTroops();
    this.#setActionCompletedState(request.actor, keepFacingSelection);
    await this.#resolveActionConsequences(request.actor, request.type, result);
  }

  async #executeWaitPlan(actor, path, finalFacing) {
    const movement = await this.#executeCommittedMovement(actor, path);
    if (movement.terminal) {
      return;
    }
    if (!movement.completed) {
      await this.#completeAcceptedWithoutAction(actor, "WAIT");
      return;
    }

    if (finalFacing !== null && finalFacing !== undefined) {
      actor.setFacing(finalFacing);
    }
    this.#finishUnitAction(actor);
    await this.#presentAction("WAIT", actor, null, false);
    await this.#completeAfterOperation(actor, "WAIT", null);
  }

  async #executeForcedAction(actor, plan) {
    if (plan.request.type === ForcedActionType.ILLUSION_WAIT) {
      this.#finishUnitAction(actor);
      await this.#presentAction("ILLUSION_WAIT", actor, null, true);
      await this.#completeAfterOperation(actor, "ILLUSION_WAIT", null);
      return;
    }

    const movement = await this.#executeCommittedMovement(actor, plan.selectedPath);
    if (movement.terminal) {
      return;
    }
    if (
      !movement.completed
      || !this.#combatService.canExecuteForcedNormalAttack(
        actor,
        plan.request.target,
        this.#stage
      )
    ) {
      await this.#completeAcceptedWithoutAction(actor, "ILLUSION_ATTACK");
      return;
    }

    await this.#presentAction(
      ActionType.NORMAL_ATTACK,
      actor,
      plan.request.target,
      true
    );
    const result = this.#combatService.executeForcedNormalAttack(
      actor,
      plan.request.target,
      this.#stage,
      this.#battleRandom
    );
    this.#finishUnitAction(actor);
    await this.#resolveActionConsequences(actor, "ILLUSION_ATTACK", result);
  }

  async #executeCommittedMovement(unit, path) {
    for (let index = 0; index < path.length; index += 1) {
      this.#throwIfDisposed();
      const remainingPath = path.slice(index);
      const validation = this.#movementService.validateRemainingPath(
        unit,
        remainingPath,
        this.#stage
      );
      if (!validation.valid) {
        return Object.freeze({ completed: false, terminal: false });
      }

      const from = this.#stage.map.getPosition(unit);
      const to = path[index];
      this.#stage.map.moveUnit(unit, to);
      if (unit.actionState === UnitActionState.READY) {
        unit.transitionActionState(UnitActionState.MOVED);
      }
      await this.#present(createSemanticPresentationRequest(
        PresentationRequestType.MOVE,
        {
          unitId: unit.id,
          from: positionPayload(from),
          to: positionPayload(to)
        }
      ));

      const trapResult = await this.#resolveTrapAtCurrentCell(unit);
      if (trapResult.terminal) {
        return Object.freeze({ completed: false, terminal: true });
      }

      if (unit.hasTroops() && this.#stage.map.getPosition(unit) !== null) {
        await this.#resolveStageEventChain(StageEventTrigger.UNIT_REACHED, {
          unit,
          position: this.#stage.map.getPosition(unit)
        });
        if (this.#latchedResult !== null) {
          await this.#finishBattle();
          return Object.freeze({ completed: false, terminal: true });
        }
        if (this.#resolveVictory()) {
          await this.#finishBattle();
          return Object.freeze({ completed: false, terminal: true });
        }
      }

      if (
        trapResult.interruptMovement
        || !this.#canContinueMovement(unit)
      ) {
        return Object.freeze({ completed: false, terminal: false });
      }
    }
    return Object.freeze({ completed: true, terminal: false });
  }

  async #resolveTrapAtCurrentCell(unit) {
    const trap = findTriggerableHiddenTrap(this.#stage, unit);
    if (trap === null) {
      return Object.freeze({ interruptMovement: false, terminal: false });
    }

    const result = resolveHiddenTrap(this.#stage, unit, trap);
    if (result.defeated) {
      this.#stage.map.removeUnit(unit);
    }
    const defeated = this.#resolveDefeatCheckpoint();
    await this.#presentTrapResult(result);
    if (defeated) {
      await this.#finishBattle();
      return Object.freeze({ interruptMovement: true, terminal: true });
    }

    await this.#resolveStageEventChain(StageEventTrigger.TRAP_TRIGGERED, {
      unit,
      trap,
      result
    });
    if (this.#latchedResult !== null) {
      await this.#finishBattle();
      return Object.freeze({ interruptMovement: true, terminal: true });
    }
    return Object.freeze({
      interruptMovement: result.interruptMovement,
      terminal: false
    });
  }

  async #resolveActionConsequences(actor, operationType, result) {
    const defeatedUnits = this.#defeatedUnitsFromResult(result);
    for (const unit of defeatedUnits) {
      this.#stage.map.removeUnit(unit);
    }

    const defeated = this.#resolveDefeatCheckpoint();
    await this.#presentActionResult(actor, operationType, result);
    if (defeated) {
      await this.#finishBattle();
      return;
    }

    for (const unit of defeatedUnits) {
      await this.#resolveStageEventChain(StageEventTrigger.UNIT_DEFEATED, {
        unit,
        actor,
        result
      });
      if (this.#latchedResult !== null) {
        await this.#finishBattle();
        return;
      }
    }
    await this.#completeAfterOperation(actor, operationType, result);
  }

  async #completeAcceptedWithoutAction(actor, operationType) {
    this.#finishUnitAction(actor);
    await this.#completeAfterOperation(actor, operationType, null, true);
  }

  async #completeAfterOperation(actor, operationType, result, canceled = false) {
    await this.#resolveStageEventChain(StageEventTrigger.AFTER_OPERATION, {
      unit: actor,
      operationType,
      result,
      canceled
    });
    if (this.#latchedResult !== null) {
      await this.#finishBattle();
      return;
    }

    if (
      actor.actionState === UnitActionState.TACTIC_COMMITTED
      && !this.#stage.armyManager.playerArmy.has(actor)
    ) {
      actor.transitionActionState(UnitActionState.FINISHED);
    }
    if (this.#resolveVictory()) {
      await this.#finishBattle();
    }
  }

  async #resolveStageEventChain(trigger, payload) {
    const chain = this.#stage.eventManager.resolveChain({
      trigger,
      stage: this.#stage,
      payload,
      afterEventCompleted: (event) => {
        this.#activateControlledUnits(event);
        return this.#resolveDefeatCheckpoint();
      }
    });
    await this.#presentAll(chain.presentationRequests);
    return chain;
  }

  #activateControlledUnits(completedEvent) {
    const activeArmy = this.#activeArmy();
    for (const rule of this.#stage.unitControlRules) {
      if (
        rule.inactiveUntilEvent !== completedEvent
        || !rule.activateOnCompletionDuringOwnPhase
        || !activeArmy.has(rule.unit)
        || !rule.unit.hasTroops()
        || this.#stage.map.getPosition(rule.unit) === null
        || rule.unit.actionState !== UnitActionState.FINISHED
      ) {
        continue;
      }
      rule.unit.transitionActionState(UnitActionState.READY);
    }
  }

  #resolveDefeatCheckpoint() {
    if (this.#latchedResult !== null) {
      return this.#latchedResult.outcome === BattleOutcome.DEFEAT;
    }
    const objective = this.#stage.objectiveManager.evaluateDefeat(this.#stage);
    if (objective === null) {
      return false;
    }
    this.#latchResult(BattleOutcome.DEFEAT, objective);
    return true;
  }

  #resolveVictory() {
    if (this.#latchedResult !== null) {
      return this.#latchedResult.outcome === BattleOutcome.VICTORY;
    }
    const objective = this.#stage.objectiveManager.evaluateVictory(this.#stage);
    if (objective === null) {
      return false;
    }
    this.#latchResult(BattleOutcome.VICTORY, objective);
    return true;
  }

  #latchResult(outcome, objective) {
    invariant(this.#latchedResult === null, "BATTLE_RESULT_ALREADY_LATCHED");
    this.#latchedResult = createBattleResult({
      stage: this.#stage,
      outcome,
      objective
    });
  }

  async #finishBattle() {
    if (this.#completionSettled) {
      return;
    }
    invariant(this.#latchedResult !== null, "BATTLE_RESULT_NOT_LATCHED");
    this.#flowState = BattleFlowState.FINISHING;
    const resultDialogue = this.#latchedResult.outcome === BattleOutcome.VICTORY
      ? this.#stage.victoryDialogue
      : this.#stage.defeatDialogue;
    if (resultDialogue !== null) {
      await this.#present(createDialoguePresentationRequest(resultDialogue));
    }
    await this.#present(createSemanticPresentationRequest(
      PresentationRequestType.BATTLE_RESULT,
      this.#latchedResult
    ));
    this.#throwIfDisposed();
    this.#completionSettled = true;
    this.#resolveCompletion(this.#latchedResult);
  }

  async #presentAction(actionType, actor, target, forced) {
    await this.#present(createSemanticPresentationRequest(
      PresentationRequestType.ACTION,
      {
        actionType,
        actorId: actor.id,
        targetId: target?.id ?? null,
        actorPosition: positionPayload(this.#stage.map.getPosition(actor)),
        targetPosition: target === null
          ? null
          : positionPayload(this.#stage.map.getPosition(target)),
        actorAffiliation: this.#stage.armyManager.getAffiliation(actor),
        actorIsMob: this.#stage.mobCharacters.includes(actor.character),
        forced
      }
    ));
  }

  async #presentActionResult(actor, operationType, result) {
    const targetResults = result.targetResults ?? [result];
    const entries = targetResults.map((entry) => ({
      unitId: (entry.unit ?? entry.target).id,
      position: positionPayload(entry.position ?? entry.targetPosition),
      beforeTroops: entry.troops.before,
      afterTroops: entry.troops.after,
      damage: entry.damage,
      defeated: entry.defeated
    }));
    if (entries.some((entry) => entry.damage > 0)) {
      await this.#present(createSemanticPresentationRequest(
        PresentationRequestType.DAMAGE,
        { operationType, actorId: actor.id, entries }
      ));
    }

    const statusEntries = targetResults
      .filter((entry) => JSON.stringify(entry.statusEffects.before)
        !== JSON.stringify(entry.statusEffects.after))
      .map((entry) => ({
        unitId: (entry.unit ?? entry.target).id,
        before: entry.statusEffects.before,
        after: entry.statusEffects.after
      }));
    if (statusEntries.length > 0) {
      await this.#present(createSemanticPresentationRequest(
        PresentationRequestType.STATUS,
        { reason: operationType, actorId: actor.id, entries: statusEntries }
      ));
    }
  }

  async #presentTrapResult(result) {
    await this.#present(createSemanticPresentationRequest(
      PresentationRequestType.TRAP,
      {
        trapId: result.trap.id,
        trapKind: result.trap.kind,
        unitId: result.unit.id,
        neutralized: result.neutralized,
        damage: result.damage,
        beforeTroops: result.beforeTroops,
        afterTroops: result.afterTroops,
        defeated: result.defeated,
        statusChange: result.statusChange
      }
    ));
    if (result.damage > 0) {
      await this.#present(createSemanticPresentationRequest(
        PresentationRequestType.DAMAGE,
        {
          operationType: "TRAP",
          actorId: null,
          entries: [{
            unitId: result.unit.id,
            position: positionPayload(result.trap.position),
            beforeTroops: result.beforeTroops,
            afterTroops: result.afterTroops,
            damage: result.damage,
            defeated: result.defeated
          }]
        }
      ));
    }
    if (result.statusChange !== null) {
      await this.#present(createSemanticPresentationRequest(
        PresentationRequestType.STATUS,
        {
          reason: "TRAP",
          unitId: result.unit.id,
          statusChange: result.statusChange
        }
      ));
    }
  }

  async #presentAll(requests) {
    for (const request of requests) {
      await this.#present(request);
    }
  }

  async #present(request) {
    this.#throwIfDisposed();
    validatePresentationRequest(request);
    try {
      await this.#presentationPort.present(request, this.#abortController.signal);
    } catch (error) {
      if (this.#isAbortError(error)) {
        throw createAbortError();
      }
      this.#recordDiagnostic("PRESENTATION", error);
    }
    this.#throwIfDisposed();
  }

  #notifyCheckpointIfStable() {
    if (!this.isStableForSave()) {
      return;
    }
    const snapshot = this.createSaveSnapshot();
    try {
      const pending = this.#checkpointPort.requestRecoverySave(snapshot);
      if (pending !== null && typeof pending?.then === "function") {
        pending.catch((error) => {
          if (!this.#disposed) {
            this.#recordDiagnostic("CHECKPOINT", error);
          }
        });
      }
    } catch (error) {
      this.#recordDiagnostic("CHECKPOINT", error);
    }
  }

  #returnToIdleAndCheckpoint() {
    if (
      this.#disposed
      || this.#latchedResult !== null
      || this.#flowState === BattleFlowState.FAULTED
      || this.#flowState === BattleFlowState.FINISHING
    ) {
      return;
    }
    this.#flowState = BattleFlowState.IDLE;
    this.#notifyCheckpointIfStable();
  }

  #canAcceptAction(request, selectedPath, requirePlayer) {
    if (
      request === null
      || typeof request !== "object"
      || !(request.actor instanceof Unit)
      || !(request.target instanceof Unit)
      || !ALL_ACTION_TYPES.includes(request.type)
      || !this.#isKnownUnit(request.actor)
      || !this.#isKnownUnit(request.target)
      || !Array.isArray(selectedPath)
      || !this.#canCommitActiveUnit(request.actor, requirePlayer)
    ) {
      return false;
    }
    const pathValidation = this.#movementService.validatePath(
      request.actor,
      selectedPath,
      this.#stage
    );
    if (!pathValidation.valid) {
      return false;
    }
    const originPosition = selectedPath.at(-1)
      ?? this.#stage.map.getPosition(request.actor);
    const queryContext = createActionQueryContext(request.actor, originPosition);
    if (COMBAT_ACTION_TYPE_SET.has(request.type)) {
      return this.#combatService.canExecute(request, this.#stage, queryContext);
    }
    return this.#tacticService.canExecute(request, this.#stage, queryContext);
  }

  #canAcceptWait(actor, selectedPath, finalFacing, requirePlayer) {
    if (
      !(actor instanceof Unit)
      || !this.#isKnownUnit(actor)
      || !Array.isArray(selectedPath)
      || !this.#canCommitActiveUnit(actor, requirePlayer)
    ) {
      return false;
    }
    if (
      requirePlayer
      && !Object.values(Facing).includes(finalFacing)
    ) {
      return false;
    }
    if (
      !requirePlayer
      && finalFacing !== null
      && finalFacing !== undefined
      && !Object.values(Facing).includes(finalFacing)
    ) {
      return false;
    }
    return this.#movementService.validatePath(actor, selectedPath, this.#stage).valid;
  }

  #canCommitActiveUnit(unit, requirePlayer) {
    const requiredFlowState = requirePlayer
      ? BattleFlowState.IDLE
      : BattleFlowState.RESOLVING_ACTION;
    if (
      !this.#started
      || this.#disposed
      || this.#latchedResult !== null
      || this.#flowState !== requiredFlowState
      || !unit.hasTroops()
      || unit.actionState !== UnitActionState.READY
      || this.#stage.map.getPosition(unit) === null
      || !this.#canActByControlRule(unit)
    ) {
      return false;
    }
    const activeArmy = this.#activeArmy();
    if (!activeArmy.has(unit)) {
      return false;
    }
    return requirePlayer
      ? this.#stage.phase === StagePhase.PLAYER
      : this.#stage.phase === StagePhase.ENEMY;
  }

  #canExecuteActionAtCurrentPosition(request) {
    if (
      !request.actor.hasTroops()
      || this.#stage.map.getPosition(request.actor) === null
      || !this.#activeArmy().has(request.actor)
    ) {
      return false;
    }
    if (COMBAT_ACTION_TYPE_SET.has(request.type)) {
      return this.#combatService.canExecute(request, this.#stage);
    }
    return this.#tacticService.canExecute(request, this.#stage);
  }

  #canContinueMovement(unit) {
    return unit.hasTroops()
      && this.#stage.map.getPosition(unit) !== null
      && this.#activeArmy().has(unit)
      && unit.actionState === UnitActionState.MOVED;
  }

  #canIssuePlayerCommand(unit) {
    return unit instanceof Unit
      && this.#isKnownUnit(unit)
      && this.#canCommitActiveUnit(unit, true);
  }

  #canUseActionQueryContext(context) {
    if (
      context === null
      || typeof context !== "object"
      || !(context.actor instanceof Unit)
      || !this.#canIssuePlayerCommand(context.actor)
    ) {
      return false;
    }
    try {
      const position = Position.from(context.originPosition);
      return this.#stage.map.getCellAt(position.x, position.y) !== null;
    } catch (error) {
      return false;
    }
  }

  #canFinalizeTacticFacing(actor, facing) {
    return this.#started
      && !this.#disposed
      && this.#latchedResult === null
      && this.#flowState === BattleFlowState.IDLE
      && this.#stage.phase === StagePhase.PLAYER
      && actor instanceof Unit
      && this.#isKnownUnit(actor)
      && this.#stage.armyManager.playerArmy.has(actor)
      && actor.hasTroops()
      && this.#stage.map.getPosition(actor) !== null
      && actor.actionState === UnitActionState.TACTIC_COMMITTED
      && Object.values(Facing).includes(facing);
  }

  #canEndPlayerTurn() {
    if (
      !this.#started
      || this.#disposed
      || this.#latchedResult !== null
      || this.#flowState !== BattleFlowState.IDLE
      || this.#stage.phase !== StagePhase.PLAYER
    ) {
      return false;
    }
    return !this.#stage.unitOrder.some((unit) => (
      unit.actionState === UnitActionState.MOVED
      || unit.actionState === UnitActionState.TACTIC_COMMITTED
    ));
  }

  #setActionCompletedState(actor, keepFacingSelection) {
    if (!actor.hasTroops()) {
      this.#finishUnitAction(actor);
      return;
    }
    if (keepFacingSelection) {
      actor.transitionActionState(UnitActionState.TACTIC_COMMITTED);
      return;
    }
    this.#finishUnitAction(actor);
  }

  #finishUnitAction(unit) {
    if (unit.actionState === UnitActionState.FINISHED) {
      return;
    }
    unit.transitionActionState(UnitActionState.FINISHED);
  }

  #defeatedUnitsFromResult(result) {
    if (Array.isArray(result.defeatedUnits)) {
      return result.defeatedUnits;
    }
    return result.defeated ? Object.freeze([result.target]) : Object.freeze([]);
  }

  #canActByControlRule(unit) {
    return this.#stage.unitControlRules
      .filter((rule) => rule.unit === unit)
      .every((rule) => rule.canAct(this.#stage.eventManager));
  }

  #activeArmy() {
    return this.#stage.phase === StagePhase.PLAYER
      ? this.#stage.armyManager.playerArmy
      : this.#stage.armyManager.enemyArmy;
  }

  #isKnownUnit(unit) {
    return this.#stage.unitOrder.includes(unit);
  }

  #validateResumeState() {
    invariant(
      !this.#stage.unitOrder.some((unit) => unit.actionState === UnitActionState.MOVED),
      "BATTLE_RESUME_MOVED_UNIT_FORBIDDEN"
    );
    const committed = this.#stage.unitOrder.filter((unit) => (
      unit.actionState === UnitActionState.TACTIC_COMMITTED
    ));
    if (this.#stage.phase === StagePhase.ENEMY) {
      invariant(committed.length === 0, "BATTLE_RESUME_ENEMY_TACTIC_COMMITTED");
      return;
    }
    invariant(committed.length <= 1, "BATTLE_RESUME_TACTIC_COMMITTED_MULTIPLE");
    if (committed.length === 1) {
      const unit = committed[0];
      invariant(
        unit.hasTroops()
          && this.#stage.map.getPosition(unit) !== null
          && this.#stage.armyManager.playerArmy.has(unit),
        "BATTLE_RESUME_TACTIC_COMMITTED_INVALID"
      );
    }
  }

  #claimStart() {
    invariant(!this.#started, "BATTLE_CONTROLLER_ALREADY_STARTED");
    invariant(!this.#disposed, "BATTLE_CONTROLLER_DISPOSED");
    this.#started = true;
  }

  #launch(promise) {
    promise.catch((error) => {
      if (this.#isAbortError(error)) {
        return;
      }
      this.#fault(error);
    });
  }

  #handleMutationFailure(error) {
    if (this.#isAbortError(error)) {
      return;
    }
    this.#fault(error);
  }

  #fault(error) {
    if (this.#flowState !== BattleFlowState.FAULTED) {
      this.#flowState = BattleFlowState.FAULTED;
      this.#recordDiagnostic("DOMAIN", error);
    }
    if (!this.#completionSettled) {
      this.#completionSettled = true;
      this.#rejectCompletion(error);
    }
  }

  #recordDiagnostic(source, error) {
    this.#diagnostics.push(Object.freeze({
      source,
      name: error?.name ?? "Error",
      message: error?.message ?? String(error)
    }));
  }

  #isAbortError(error) {
    return this.#disposed || error?.name === "AbortError";
  }

  #throwIfDisposed() {
    if (this.#disposed || this.#abortController.signal.aborted) {
      throw createAbortError();
    }
  }
}
