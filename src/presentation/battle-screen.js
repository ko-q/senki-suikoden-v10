import { requireBattleCommandPort } from "../boundary/battle-ports.js";
import { createActionQueryContext } from "../core/action-query-context.js";
import {
  ActionType,
  TACTIC_ACTION_TYPES,
  createActionRequest
} from "../core/action-request.js";
import { BattleFlowState } from "../core/battle-flow-state.js";
import { invariant } from "../core/domain-error.js";
import {
  PresentationRequestType,
  validatePresentationRequest
} from "../core/presentation-request.js";
import { Stage, StagePhase } from "../domain/stage.js";
import { UnitActionState } from "../domain/unit.js";
import { BattleEffectManager } from "./battle-effect-manager.js";
import { BattleRenderer } from "./battle-renderer.js";
import { DialogueController } from "./dialogue-controller.js";

export const InteractionMode = Object.freeze({
  UNIT_SELECT: "UNIT_SELECT",
  UNIT_SELECTED: "UNIT_SELECTED",
  MOVE_PREVIEW: "MOVE_PREVIEW",
  CONFUSION_LEVEL_SELECT: "CONFUSION_LEVEL_SELECT",
  BOW_TARGET_SELECT: "BOW_TARGET_SELECT",
  CHARGE_TARGET_SELECT: "CHARGE_TARGET_SELECT",
  CONFUSION_LV1_TARGET_SELECT: "CONFUSION_LV1_TARGET_SELECT",
  CONFUSION_LV2_TARGET_SELECT: "CONFUSION_LV2_TARGET_SELECT",
  CONFUSION_LV3_TARGET_SELECT: "CONFUSION_LV3_TARGET_SELECT",
  ILLUSION_TARGET_SELECT: "ILLUSION_TARGET_SELECT",
  FIRE_TARGET_SELECT: "FIRE_TARGET_SELECT",
  WATER_TARGET_SELECT: "WATER_TARGET_SELECT",
  WAIT_FACING_SELECT: "WAIT_FACING_SELECT",
  TACTIC_FACING_SELECT: "TACTIC_FACING_SELECT",
  LOCKED: "LOCKED"
});

const TACTIC_ACTION_TYPE_SET = new Set(TACTIC_ACTION_TYPES);
const TARGET_MODE_BY_ACTION_TYPE = Object.freeze({
  [ActionType.BOW_ATTACK]: InteractionMode.BOW_TARGET_SELECT,
  [ActionType.CHARGE]: InteractionMode.CHARGE_TARGET_SELECT,
  [ActionType.CONFUSION_LV1]: InteractionMode.CONFUSION_LV1_TARGET_SELECT,
  [ActionType.CONFUSION_LV2]: InteractionMode.CONFUSION_LV2_TARGET_SELECT,
  [ActionType.CONFUSION_LV3]: InteractionMode.CONFUSION_LV3_TARGET_SELECT,
  [ActionType.ILLUSION]: InteractionMode.ILLUSION_TARGET_SELECT,
  [ActionType.FIRE]: InteractionMode.FIRE_TARGET_SELECT,
  [ActionType.WATER]: InteractionMode.WATER_TARGET_SELECT
});
const TARGET_SELECT_MODE_SET = new Set(Object.values(TARGET_MODE_BY_ACTION_TYPE));

function createAbortError() {
  const error = new Error("BATTLE_SCREEN_ABORTED");
  error.name = "AbortError";
  return error;
}

/**
 * 画面固有の選択状態を保持し、BattleCommandPortとPresentationを接続する。
 */
export class BattleScreen {
  #stage;
  #renderer;
  #effectManager;
  #dialogueController;
  #commandPort;
  #mode;
  #selectedUnit;
  #reachableByKey;
  #previewDestination;
  #candidatePaths;
  #selectedPathIndex;
  #availableActions;
  #selectedActionType;
  #selectableTargets;
  #commandPending;
  #dialoguePending;
  #disposed;

  constructor({ stage, renderer, effectManager, dialogueController = new DialogueController() }) {
    invariant(stage instanceof Stage, "BATTLE_SCREEN_STAGE_REQUIRED");
    invariant(renderer instanceof BattleRenderer, "BATTLE_SCREEN_RENDERER_REQUIRED");
    invariant(
      effectManager instanceof BattleEffectManager,
      "BATTLE_SCREEN_EFFECT_MANAGER_REQUIRED"
    );
    invariant(
      dialogueController instanceof DialogueController,
      "BATTLE_SCREEN_DIALOGUE_CONTROLLER_REQUIRED"
    );
    this.#stage = stage;
    this.#renderer = renderer;
    this.#effectManager = effectManager;
    this.#dialogueController = dialogueController;
    this.#commandPort = null;
    this.#mode = InteractionMode.UNIT_SELECT;
    this.#selectedUnit = null;
    this.#reachableByKey = new Map();
    this.#previewDestination = null;
    this.#candidatePaths = [];
    this.#selectedPathIndex = 0;
    this.#availableActions = [];
    this.#selectedActionType = null;
    this.#selectableTargets = [];
    this.#commandPending = false;
    this.#dialoguePending = null;
    this.#disposed = false;

    this.#renderer.bindHandlers({
      onAction: (actionType) => this.#handleAction(actionType),
      onCell: (position) => this.#handleCell(position),
      onClear: () => this.#handleClear(),
      onEndTurn: () => this.#handleEndTurn(),
      onFacing: (facing) => this.#handleFacing(facing),
      onNextDialogue: () => this.#handleNextDialogue(),
      onPath: () => this.#handlePath(),
      onTacticMenu: () => this.#handleTacticMenu(),
      onWait: () => this.#handleWait()
    });
  }

  get mode() {
    return this.#effectiveMode();
  }

  connectCommandPort(commandPort) {
    invariant(this.#commandPort === null, "BATTLE_SCREEN_COMMAND_PORT_ALREADY_CONNECTED");
    this.#commandPort = requireBattleCommandPort(commandPort);
    invariant(
      this.#commandPort.getStage() === this.#stage,
      "BATTLE_SCREEN_STAGE_MISMATCH"
    );
    this.refresh();
  }

  async present(request, abortSignal) {
    validatePresentationRequest(request);
    invariant(abortSignal instanceof AbortSignal, "BATTLE_SCREEN_ABORT_SIGNAL_REQUIRED");
    if (this.#disposed || abortSignal.aborted) {
      throw createAbortError();
    }

    this.refresh();
    if (request.type === PresentationRequestType.DIALOGUE) {
      await this.#presentDialogue(request.dialogue, abortSignal);
    } else {
      await this.#effectManager.present(request, abortSignal);
    }
    this.#scheduleRefresh();
  }

  refresh() {
    if (this.#commandPort === null || this.#disposed) {
      return;
    }
    this.#synchronizeFromDomain();
    this.#renderer.render(this.#stage, this.#createViewState());
  }

  showFault(error) {
    this.#renderer.showError(error?.message ?? String(error));
    this.refresh();
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    if (this.#dialoguePending !== null) {
      const pending = this.#dialoguePending;
      this.#dialoguePending = null;
      pending.abortSignal.removeEventListener("abort", pending.handleAbort);
      this.#dialogueController.finish();
      this.#renderer.hideDialogue();
      pending.reject(createAbortError());
    }
    this.#effectManager.dispose();
    this.#renderer.unbindHandlers();
  }

  #handleCell(position) {
    if (this.#isInputLocked()) {
      return;
    }
    const cell = this.#stage.map.getCellAt(position.x, position.y);
    if (cell === null) {
      return;
    }
    if (
      cell.occupant !== null
      && this.#isSelectablePlayerUnit(cell.occupant)
      && cell.occupant === this.#selectedUnit
      && (
        this.#mode === InteractionMode.CONFUSION_LEVEL_SELECT
        || this.#isTargetSelectionMode()
      )
    ) {
      this.#renderer.showInfo(
        this.#mode === InteractionMode.CONFUSION_LEVEL_SELECT
          ? "Choose a tactic before selecting a target."
          : "Select a highlighted target."
      );
      return;
    }
    if (cell.occupant !== null && this.#isSelectablePlayerUnit(cell.occupant)) {
      this.#selectUnit(cell.occupant);
      this.refresh();
      return;
    }
    if (this.#selectedUnit === null) {
      return;
    }

    if (this.#mode === InteractionMode.CONFUSION_LEVEL_SELECT) {
      this.#renderer.showInfo("Choose a tactic before selecting a target.");
      return;
    }

    if (this.#isTargetSelectionMode()) {
      if (
        cell.occupant !== null
        && this.#selectableTargets.includes(cell.occupant)
      ) {
        this.#executeSelectedAction(cell.occupant);
      } else {
        this.#renderer.showInfo("Select a highlighted target.");
      }
      return;
    }

    if (cell.occupant !== null && this.#stage.armyManager.enemyArmy.has(cell.occupant)) {
      if (this.#selectableTargets.includes(cell.occupant)) {
        this.#executeNormalAttack(cell.occupant);
      } else {
        this.#renderer.showInfo("Target is out of range.");
      }
      return;
    }

    const origin = this.#stage.map.getPosition(this.#selectedUnit);
    if (origin.equals(position)) {
      if (this.#previewDestination !== null) {
        this.#clearPreview();
      } else {
        this.#clearSelection();
      }
      this.refresh();
      return;
    }
    if (this.#reachableByKey.has(position.toKey())) {
      this.#previewAt(position);
      this.refresh();
      return;
    }

    this.#clearSelection();
    this.refresh();
  }

  #handleClear() {
    if (this.#isInputLocked()) {
      return;
    }
    if (this.#mode === InteractionMode.TACTIC_FACING_SELECT) {
      return;
    }
    if (this.#mode === InteractionMode.WAIT_FACING_SELECT) {
      this.#returnToBaseSelection();
    } else if (
      this.#mode === InteractionMode.CONFUSION_LEVEL_SELECT
      || this.#isTargetSelectionMode()
    ) {
      this.#returnToBaseSelection();
    } else {
      this.#clearSelection();
    }
    this.refresh();
  }

  #handlePath() {
    if (
      this.#isInputLocked()
      || !this.#isBaseSelectionMode()
      || this.#candidatePaths.length <= 1
    ) {
      return;
    }
    this.#selectedPathIndex = (this.#selectedPathIndex + 1) % this.#candidatePaths.length;
    this.#refreshActionQuery();
    this.refresh();
  }

  #handleTacticMenu() {
    if (
      this.#isInputLocked()
      || !this.#isBaseSelectionMode()
      || !this.#availableActions.some((type) => TACTIC_ACTION_TYPE_SET.has(type))
    ) {
      return;
    }
    this.#selectedActionType = null;
    this.#selectableTargets = [];
    this.#mode = InteractionMode.CONFUSION_LEVEL_SELECT;
    this.refresh();
  }

  #handleAction(actionType) {
    if (
      this.#isInputLocked()
      || this.#selectedUnit === null
      || !this.#availableActions.includes(actionType)
    ) {
      return;
    }

    const isTactic = TACTIC_ACTION_TYPE_SET.has(actionType);
    if (isTactic && this.#mode !== InteractionMode.CONFUSION_LEVEL_SELECT) {
      return;
    }
    if (!isTactic && !this.#isBaseSelectionMode()) {
      return;
    }

    this.#selectedActionType = actionType;
    if (actionType === ActionType.WIDE_ILLUSION) {
      this.#executeSelectedAction(this.#selectedUnit);
      return;
    }

    this.#mode = TARGET_MODE_BY_ACTION_TYPE[actionType];
    this.#refreshSelectableTargets(actionType);
    this.refresh();
  }

  #handleWait() {
    if (!this.#canWait()) {
      return;
    }
    this.#mode = InteractionMode.WAIT_FACING_SELECT;
    this.refresh();
  }

  #handleFacing(facing) {
    if (this.#isInputLocked() || this.#selectedUnit === null) {
      return;
    }
    if (this.#mode === InteractionMode.WAIT_FACING_SELECT) {
      const actor = this.#selectedUnit;
      const path = this.#selectedPath();
      this.#runCommand(
        () => this.#commandPort.executeWait(actor, path, facing),
        () => this.#clearSelection()
      );
      return;
    }
    if (this.#mode === InteractionMode.TACTIC_FACING_SELECT) {
      const actor = this.#selectedUnit;
      this.#runCommand(
        () => this.#commandPort.finalizeTacticFacing(actor, facing),
        () => this.#clearSelection()
      );
    }
  }

  #handleEndTurn() {
    if (!this.#canEndTurn()) {
      return;
    }
    this.#clearSelection();
    this.#runCommand(
      () => this.#commandPort.endPlayerTurn(),
      () => this.#clearSelection()
    );
  }

  #handleNextDialogue() {
    if (this.#dialoguePending === null || !this.#dialogueController.isActive) {
      return;
    }
    const speech = this.#dialogueController.advance();
    if (speech !== null) {
      this.#renderCurrentDialogueSpeech();
      return;
    }

    const pending = this.#dialoguePending;
    this.#dialoguePending = null;
    pending.abortSignal.removeEventListener("abort", pending.handleAbort);
    this.#renderer.hideDialogue();
    pending.resolve();
  }

  #selectUnit(unit) {
    this.#selectedUnit = unit;
    this.#reachableByKey = new Map(
      this.#commandPort.getReachableCells(unit)
        .map((entry) => [entry.position.toKey(), entry.cost])
    );
    this.#previewDestination = null;
    this.#candidatePaths = [];
    this.#selectedPathIndex = 0;
    this.#mode = InteractionMode.UNIT_SELECTED;
    this.#refreshActionQuery();
  }

  #previewAt(position) {
    this.#previewDestination = position;
    this.#candidatePaths = this.#commandPort.getCandidatePaths(
      this.#selectedUnit,
      position
    );
    this.#selectedPathIndex = 0;
    this.#mode = InteractionMode.MOVE_PREVIEW;
    this.#refreshActionQuery();
  }

  #executeNormalAttack(target) {
    this.#executeAction(ActionType.NORMAL_ATTACK, target);
  }

  #executeSelectedAction(target) {
    if (this.#selectedActionType === null) {
      return;
    }
    this.#executeAction(this.#selectedActionType, target);
  }

  #executeAction(actionType, target) {
    const actor = this.#selectedUnit;
    if (actor === null) {
      return;
    }
    const request = createActionRequest(actionType, actor, target);
    const path = this.#selectedPath();
    this.#runCommand(
      () => this.#commandPort.executeAction(request, path),
      () => this.#clearSelection()
    );
  }

  async #runCommand(command, afterAccepted) {
    if (this.#isInputLocked()) {
      return;
    }
    this.#commandPending = true;
    this.refresh();
    try {
      const accepted = await command();
      if (accepted) {
        afterAccepted();
      } else {
        this.#renderer.showInfo("Command was rejected.");
      }
    } catch (error) {
      if (error?.name !== "AbortError") {
        this.showFault(error);
      }
    } finally {
      this.#commandPending = false;
      this.#synchronizeFromDomain();
      this.refresh();
    }
  }

  #refreshActionQuery() {
    if (this.#selectedUnit === null || this.#commandPort === null) {
      this.#availableActions = [];
      this.#selectedActionType = null;
      this.#selectableTargets = [];
      return;
    }
    const origin = this.#previewDestination
      ?? this.#stage.map.getPosition(this.#selectedUnit);
    const context = createActionQueryContext(this.#selectedUnit, origin);
    this.#availableActions = [...this.#commandPort.getAvailableActions(context)];
    this.#selectedActionType = null;
    this.#selectableTargets = [...this.#commandPort.getActionTargets(
      context,
      ActionType.NORMAL_ATTACK
    )];
  }

  #refreshSelectableTargets(actionType) {
    if (this.#selectedUnit === null || this.#commandPort === null) {
      this.#selectableTargets = [];
      return;
    }
    const origin = this.#previewDestination
      ?? this.#stage.map.getPosition(this.#selectedUnit);
    const context = createActionQueryContext(this.#selectedUnit, origin);
    this.#selectableTargets = [...this.#commandPort.getActionTargets(
      context,
      actionType
    )];
  }

  #clearPreview() {
    this.#previewDestination = null;
    this.#candidatePaths = [];
    this.#selectedPathIndex = 0;
    this.#mode = InteractionMode.UNIT_SELECTED;
    this.#refreshActionQuery();
  }

  #returnToBaseSelection() {
    this.#mode = this.#previewDestination === null
      ? InteractionMode.UNIT_SELECTED
      : InteractionMode.MOVE_PREVIEW;
    this.#refreshActionQuery();
  }

  #clearSelection() {
    this.#selectedUnit = null;
    this.#reachableByKey = new Map();
    this.#previewDestination = null;
    this.#candidatePaths = [];
    this.#selectedPathIndex = 0;
    this.#availableActions = [];
    this.#selectedActionType = null;
    this.#selectableTargets = [];
    this.#mode = InteractionMode.UNIT_SELECT;
  }

  #selectedPath() {
    return this.#candidatePaths[this.#selectedPathIndex] ?? [];
  }

  #isSelectablePlayerUnit(unit) {
    return this.#stage.armyManager.playerArmy.has(unit)
      && unit.hasTroops()
      && unit.actionState === UnitActionState.READY
      && this.#stage.map.getPosition(unit) !== null;
  }

  #canWait() {
    return !this.#isInputLocked()
      && this.#selectedUnit !== null
      && this.#isSelectablePlayerUnit(this.#selectedUnit)
      && (
        this.#mode === InteractionMode.UNIT_SELECTED
        || this.#mode === InteractionMode.MOVE_PREVIEW
      );
  }

  #isBaseSelectionMode() {
    return this.#mode === InteractionMode.UNIT_SELECTED
      || this.#mode === InteractionMode.MOVE_PREVIEW;
  }

  #isTargetSelectionMode() {
    return TARGET_SELECT_MODE_SET.has(this.#mode);
  }

  #canEndTurn() {
    if (
      this.#isInputLocked()
      || this.#stage.phase !== StagePhase.PLAYER
      || this.#mode === InteractionMode.TACTIC_FACING_SELECT
      || this.#mode === InteractionMode.WAIT_FACING_SELECT
    ) {
      return false;
    }
    return !this.#stage.unitOrder.some((unit) => (
      unit.actionState === UnitActionState.MOVED
      || unit.actionState === UnitActionState.TACTIC_COMMITTED
    ));
  }

  #isInputLocked() {
    return this.#disposed
      || this.#commandPort === null
      || this.#commandPending
      || this.#dialogueController.isActive
      || this.#commandPort.getBattleResult() !== null
      || this.#commandPort.flowState !== BattleFlowState.IDLE;
  }

  #effectiveMode() {
    return this.#isInputLocked() ? InteractionMode.LOCKED : this.#mode;
  }

  #synchronizeFromDomain() {
    if (this.#commandPort === null) {
      return;
    }
    const committed = this.#stage.unitOrder.filter((unit) => (
      unit.actionState === UnitActionState.TACTIC_COMMITTED
      && this.#stage.armyManager.playerArmy.has(unit)
      && unit.hasTroops()
      && this.#stage.map.getPosition(unit) !== null
    ));
    if (
      committed.length === 1
      && this.#commandPort.flowState === BattleFlowState.IDLE
      && this.#commandPort.getBattleResult() === null
    ) {
      this.#selectedUnit = committed[0];
      this.#reachableByKey = new Map();
      this.#previewDestination = null;
      this.#candidatePaths = [];
      this.#selectedPathIndex = 0;
      this.#availableActions = [];
      this.#selectedActionType = null;
      this.#selectableTargets = [];
      this.#mode = InteractionMode.TACTIC_FACING_SELECT;
      return;
    }
    if (
      this.#selectedUnit !== null
      && this.#mode !== InteractionMode.TACTIC_FACING_SELECT
      && !this.#isSelectablePlayerUnit(this.#selectedUnit)
    ) {
      this.#clearSelection();
    }
  }

  #createViewState() {
    const inputLocked = this.#isInputLocked();
    return Object.freeze({
      mode: this.#effectiveMode(),
      domainLabel: this.#domainLabel(),
      instruction: this.#instruction(),
      selectedUnit: this.#selectedUnit,
      reachableByKey: this.#reachableByKey,
      previewDestination: this.#previewDestination,
      candidatePaths: this.#candidatePaths,
      selectedPathIndex: this.#selectedPathIndex,
      availableActions: Object.freeze([...this.#availableActions]),
      selectedActionType: this.#selectedActionType,
      selectableTargets: this.#selectableTargets,
      previewCost: this.#previewDestination === null
        ? 0
        : this.#reachableByKey.get(this.#previewDestination.toKey()) ?? 0,
      inputLocked,
      canWait: this.#canWait(),
      canEndTurn: this.#canEndTurn(),
      showPrimaryCommands: !inputLocked
        && this.#selectedUnit !== null
        && this.#isBaseSelectionMode(),
      showTacticPanel: !inputLocked
        && this.#mode === InteractionMode.CONFUSION_LEVEL_SELECT,
      showFacingPanel: !inputLocked && (
        this.#mode === InteractionMode.WAIT_FACING_SELECT
        || this.#mode === InteractionMode.TACTIC_FACING_SELECT
      )
    });
  }

  #domainLabel() {
    if (this.#commandPort.flowState === BattleFlowState.FAULTED) {
      return "Faulted";
    }
    return this.#commandPort.isStableForSave() ? "Stable" : "Busy";
  }

  #instruction() {
    const mode = this.#effectiveMode();
    if (this.#commandPort.getBattleResult() !== null) {
      return "The development battle has finished.";
    }
    if (this.#commandPort.flowState === BattleFlowState.FAULTED) {
      return "The battle stopped after an unexpected error.";
    }
    if (mode === InteractionMode.LOCKED) {
      return "Resolving the current battle operation.";
    }
    if (mode === InteractionMode.UNIT_SELECT) {
      return "Select a blue READY unit.";
    }
    if (mode === InteractionMode.UNIT_SELECTED) {
      return "Select a marked cell, tap an adjacent enemy, or choose an action.";
    }
    if (mode === InteractionMode.MOVE_PREVIEW) {
      return "Tap a red target, choose another action, or wait and select a facing.";
    }
    if (mode === InteractionMode.CONFUSION_LEVEL_SELECT) {
      return "Choose an available tactic. Confusion levels consume their level in uses.";
    }
    if (mode === InteractionMode.BOW_TARGET_SELECT) {
      return "Select a highlighted projectile target at range 2 to 3.";
    }
    if (mode === InteractionMode.CHARGE_TARGET_SELECT) {
      return "Select a highlighted adjacent target for Charge.";
    }
    if (TARGET_SELECT_MODE_SET.has(mode)) {
      return "Select a highlighted target for the chosen tactic.";
    }
    if (mode === InteractionMode.WAIT_FACING_SELECT) {
      return "Choose the final facing. Clear returns to movement preview.";
    }
    if (mode === InteractionMode.TACTIC_FACING_SELECT) {
      return "Choose the final facing for the committed tactic.";
    }
    return "Select a valid target.";
  }

  #presentDialogue(dialogue, abortSignal) {
    invariant(this.#dialoguePending === null, "BATTLE_SCREEN_DIALOGUE_ALREADY_PENDING");
    this.#dialogueController.start(dialogue);
    this.#renderCurrentDialogueSpeech();
    this.refresh();

    return new Promise((resolve, reject) => {
      const handleAbort = () => {
        if (this.#dialoguePending === null) {
          return;
        }
        this.#dialoguePending = null;
        this.#dialogueController.finish();
        this.#renderer.hideDialogue();
        reject(createAbortError());
      };
      this.#dialoguePending = { resolve, reject, abortSignal, handleAbort };
      abortSignal.addEventListener("abort", handleAbort, { once: true });
      if (abortSignal.aborted) {
        handleAbort();
      }
    });
  }

  #renderCurrentDialogueSpeech() {
    const speech = this.#dialogueController.getCurrentSpeech();
    invariant(speech !== null, "BATTLE_SCREEN_SPEECH_REQUIRED");
    const isLast = this.#dialogueController.currentIndex
      === this.#dialogueController.dialogue.speeches.length - 1;
    this.#renderer.renderDialogue(speech, isLast);
  }

  #scheduleRefresh() {
    setTimeout(() => {
      if (!this.#disposed) {
        this.refresh();
      }
    }, 0);
  }
}
