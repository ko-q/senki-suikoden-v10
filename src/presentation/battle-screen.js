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
import { Facing, UnitActionState } from "../domain/unit.js";
import { BattleEffectManager } from "./battle-effect-manager.js";
import { MovePreviewState } from "./move-preview-state.js";
import { BattleRenderer } from "./battle-renderer.js";
import { DialogueController } from "./dialogue-controller.js";
import { directionBetween } from "../services/action-targeting-rules.js";

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
  #inspectedUnit = null;
  #inspectedPosition = null;
  #presentationUnitId = null;
  #reachableByKey;
  #preview = new MovePreviewState();
  #availableActions;
  #selectedActionType;
  #selectableTargets;
  #commandPending;
  #dialoguePending;
  #missionPending = null;
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
    this.#preview.clear();
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
      onWait: () => this.#handleWait(),
      onMissionStart: () => this.#finishMission()
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

    this.#updatePresentationFocus(request);
    this.refresh();
    if (request.type === PresentationRequestType.DIALOGUE) {
      await this.#presentDialogue(request.dialogue, abortSignal);
    } else if (request.type === PresentationRequestType.MISSION_BRIEFING) {
      await this.#presentMission(request.payload, abortSignal);
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
    if (this.#missionPending) this.#missionPending.handleAbort();
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
    // Preview stays in the presentation layer until a final command commits it.
    if (this.#selectedUnit !== null && [InteractionMode.WAIT_FACING_SELECT, InteractionMode.TACTIC_FACING_SELECT, InteractionMode.MOVE_PREVIEW].includes(this.#mode)) {
      const origin = this.#preview.destination ?? this.#stage.map.getPosition(this.#selectedUnit);
      const dx = position.x - origin.x, dy = position.y - origin.y;
      const normalAttack = this.#mode === InteractionMode.MOVE_PREVIEW && this.#selectableTargets.includes(cell.occupant);
      if (!normalAttack && Math.abs(dx) + Math.abs(dy) === 1) {
        if (this.#mode === InteractionMode.MOVE_PREVIEW) this.#mode = InteractionMode.WAIT_FACING_SELECT;
        this.#handleFacing(dx === 1 ? Facing.EAST : dx === -1 ? Facing.WEST : dy === 1 ? Facing.SOUTH : Facing.NORTH);
        return;
      }
      if (this.#mode !== InteractionMode.MOVE_PREVIEW) return;
      if (!normalAttack) { this.#renderer.showInfo("向きを選ぶか、戻るで移動を取り消してください。"); return; }
    }
    // Target selection belongs to the current actor until Back is pressed,
    // including when a different ally is tapped (V9 cellClick submodes).
    if (this.#mode === InteractionMode.CONFUSION_LEVEL_SELECT) {
      this.#renderer.showInfo("使用する撹乱のレベルを選んでください。");
      return;
    }
    if (this.#isTargetSelectionMode()) {
      if (cell.occupant !== null && this.#selectableTargets.includes(cell.occupant)) {
        this.#executeSelectedAction(cell.occupant);
      } else {
        this.#renderer.showInfo("赤い印の対象を選ぶか、戻るで取り消してください。");
      }
      return;
    }
    if (cell.occupant !== null && this.#stage.armyManager.playerArmy.has(cell.occupant)) {
      if (this.#isSelectablePlayerUnit(cell.occupant)) {
        this.#selectUnit(cell.occupant);
      } else {
        // V9 allows inspecting an unavailable ally after clearing an unmoved actor.
        // Preview, target selection and committed-facing modes return above.
        this.#clearSelection();
        this.#inspectedUnit = cell.occupant;
        this.#inspectedPosition = position;
      }
      this.refresh();
      return;
    }
    if (this.#selectedUnit === null) {
      this.#inspectedUnit = cell.occupant;
      this.#inspectedPosition = position;
      this.refresh();
      return;
    }

    if (cell.occupant !== null && this.#stage.armyManager.enemyArmy.has(cell.occupant)) {
      if (this.#selectableTargets.includes(cell.occupant)) {
        this.#executeNormalAttack(cell.occupant);
      } else {
        this.#clearSelection(); this.#inspectedUnit = cell.occupant; this.refresh();
      }
      return;
    }

    const origin = this.#stage.map.getPosition(this.#selectedUnit);
    if (origin.equals(position)) {
      if (this.#preview.destination !== null) {
        this.#clearPreview();
      } else {
        this.#clearSelection();
      }
      this.refresh();
      return;
    }
    if (this.#reachableByKey.has(position.toKey())) {
      this.#previewAt(position);
      const actor = this.#selectedUnit;
      const path = this.#selectedPath();
      if (this.#commandPort.canExecuteImmediateMove(actor, path)) {
        // V9 resolves traps and a winning escape on the destination click.
        this.#runCommand(
          () => this.#commandPort.executeImmediateMove(actor, path),
          () => this.#inspectAfterAction(actor)
        );
        return;
      }
      this.refresh();
      return;
    }

    this.#clearSelection();
    this.#inspectedPosition = position;
    this.refresh();
  }

  #handleClear() {
    if (this.#isInputLocked()) {
      return;
    }
    if (this.#mode === InteractionMode.TACTIC_FACING_SELECT) {
      return;
    }
    // V9 cancels an uncommitted move in one step from every submode.
    if (this.#preview.destination !== null || this.#mode === InteractionMode.WAIT_FACING_SELECT) {
      this.#clearPreview();
    } else if ([InteractionMode.CONFUSION_LV1_TARGET_SELECT, InteractionMode.CONFUSION_LV2_TARGET_SELECT,
      InteractionMode.CONFUSION_LV3_TARGET_SELECT].includes(this.#mode)) {
      this.#selectedActionType = null;
      this.#selectableTargets = [];
      this.#mode = InteractionMode.CONFUSION_LEVEL_SELECT;
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
      || this.#preview.paths.length <= 1
    ) {
      return;
    }
    this.#preview.nextPath();
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
    const directTactics = [ActionType.FIRE, ActionType.WATER, ActionType.ILLUSION].filter((type) => this.#availableActions.includes(type));
    if (directTactics.length === 1 && !this.#availableActions.includes(ActionType.WIDE_ILLUSION)) {
      this.#handleAction(directTactics[0]); return;
    }
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
        () => this.#inspectAfterAction(actor)
      );
      return;
    }
    if (this.#mode === InteractionMode.TACTIC_FACING_SELECT) {
      const actor = this.#selectedUnit;
      this.#runCommand(
        () => this.#commandPort.finalizeTacticFacing(actor, facing),
        () => this.#inspectAfterAction(actor)
      );
    }
  }

  #handleEndTurn() {
    if (!this.#canEndTurn()) {
      return;
    }
    const unacted = this.#stage.unitOrder.filter((unit) => this.#isSelectablePlayerUnit(unit));
    if (unacted.length && typeof globalThis.confirm === "function" && !globalThis.confirm(`未行動の味方部隊が${unacted.length}部隊います。\n${unacted.map((unit) => unit.character.name).join("、")}\n\nこのままターンを終了しますか？`)) return;
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
    this.#inspectedUnit = null;
    this.#inspectedPosition = null;
    this.#selectedUnit = unit;
    this.#reachableByKey = new Map(
      this.#commandPort.getReachableCells(unit)
        .map((entry) => [entry.position.toKey(), entry.cost])
    );
    this.#preview.clear();
    this.#mode = InteractionMode.UNIT_SELECTED;
    this.#refreshActionQuery();
  }

  #previewAt(position) {
    this.#preview.set(position, this.#commandPort.getCandidatePaths(this.#selectedUnit, position));
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
      () => this.#inspectAfterAction(actor)
    );
  }

  #inspectAfterAction(unit) {
    this.#clearSelection();
    if (unit.hasTroops() && this.#stage.map.getPosition(unit)) this.#inspectedUnit = unit;
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
    const origin = this.#preview.destination
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
    const origin = this.#preview.destination
      ?? this.#stage.map.getPosition(this.#selectedUnit);
    const context = createActionQueryContext(this.#selectedUnit, origin);
    this.#selectableTargets = [...this.#commandPort.getActionTargets(
      context,
      actionType
    )];
  }

  #clearPreview() {
    this.#preview.clear();
    this.#mode = InteractionMode.UNIT_SELECTED;
    this.#refreshActionQuery();
  }

  #returnToBaseSelection() {
    this.#mode = this.#preview.destination === null
      ? InteractionMode.UNIT_SELECTED
      : InteractionMode.MOVE_PREVIEW;
    this.#refreshActionQuery();
  }

  #clearSelection() {
    this.#inspectedUnit = null;
    this.#inspectedPosition = null;
    this.#selectedUnit = null;
    this.#reachableByKey = new Map();
    this.#preview.clear();
    this.#availableActions = [];
    this.#selectedActionType = null;
    this.#selectableTargets = [];
    this.#mode = InteractionMode.UNIT_SELECT;
  }

  #selectedPath() {
    return this.#preview.path;
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
      || this.#preview.destination !== null
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
      || this.#missionPending !== null
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
    if (this.#commandPort.flowState === BattleFlowState.IDLE && this.#stage.phase === StagePhase.PLAYER) {
      this.#presentationUnitId = null;
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
      this.#preview.clear();
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
      const finished = this.#selectedUnit;
      this.#clearSelection();
      if (finished.hasTroops()) this.#inspectedUnit = finished;
    }
  }

  #updatePresentationFocus(request) {
    if ([PresentationRequestType.PHASE, PresentationRequestType.DIALOGUE,
      PresentationRequestType.MISSION_BRIEFING, PresentationRequestType.BATTLE_RESULT].includes(request.type)) {
      this.#presentationUnitId = null;
    } else if (request.type === PresentationRequestType.UNIT_FOCUS
      || (request.type === PresentationRequestType.STATUS && request.payload.reason === "PHASE_START")) {
      this.#presentationUnitId = request.payload.unitId;
    } else if (request.type === PresentationRequestType.MOVE
      && (this.#stage.phase === StagePhase.ENEMY || this.#presentationUnitId !== null)) {
      this.#presentationUnitId = request.payload.unitId;
    } else if (request.type === PresentationRequestType.ACTION
      && (this.#stage.phase === StagePhase.ENEMY || request.payload.forced === true)) {
      this.#presentationUnitId = request.payload.actorId;
    }
  }

  #createViewState() {
    const inputLocked = this.#isInputLocked();
    const actingUnit = this.#presentationUnitId ? this.#stage.getUnit(this.#presentationUnitId) : null;
    // Presentation focus never becomes a command selection or unlocks input.
    const presentationPosition = inputLocked && actingUnit?.hasTroops()
      && this.#commandPort.flowState !== BattleFlowState.FAULTED
      && this.#commandPort.getBattleResult() === null
      ? this.#stage.map.getPosition(actingUnit) : null;
    const path = this.#selectedPath();
    const previewFacing = !inputLocked && this.#preview.destination && path.length > 0
      ? directionBetween(path.at(-2) ?? this.#stage.map.getPosition(this.#selectedUnit), path.at(-1))
      : null;
    return Object.freeze({
      mode: this.#effectiveMode(),
      battleFinished: this.#commandPort.getBattleResult() !== null,
      domainLabel: this.#domainLabel(),
      instruction: this.#instruction(),
      selectedUnit: this.#selectedUnit ?? this.#inspectedUnit,
      presentationPosition,
      selectionPosition: this.#preview.destination
        ?? ((this.#selectedUnit ?? this.#inspectedUnit) ? this.#stage.map.getPosition(this.#selectedUnit ?? this.#inspectedUnit) : this.#inspectedPosition),
      reachableByKey: this.#reachableByKey,
      previewDestination: this.#preview.destination,
      previewFacing,
      candidatePaths: this.#preview.paths,
      selectedPathIndex: this.#preview.index,
      availableActions: Object.freeze([...this.#availableActions]),
      selectedActionType: this.#selectedActionType,
      selectableTargets: this.#selectableTargets,
      previewCost: this.#preview.destination === null
        ? 0
        : this.#reachableByKey.get(this.#preview.destination.toKey()) ?? 0,
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
      return "戦闘が終了しました。";
    }
    if (this.#commandPort.flowState === BattleFlowState.FAULTED) {
      return "エラーが発生したため戦闘を停止しました。";
    }
    if (mode === InteractionMode.LOCKED) {
      return "行動を処理しています。";
    }
    if (mode === InteractionMode.UNIT_SELECT) {
      return "行動する味方の部隊を選んでください。";
    }
    if (mode === InteractionMode.UNIT_SELECTED) {
      return "青い丸で移動、隣接する敵で攻撃します。";
    }
    if (mode === InteractionMode.MOVE_PREVIEW) {
      return "赤い印で攻撃、黄色のマスで向きを決めて待機します。";
    }
    if (mode === InteractionMode.CONFUSION_LEVEL_SELECT) {
      return "使用する計略を選んでください。撹乱はレベル分の回数を消費します。";
    }
    if (mode === InteractionMode.BOW_TARGET_SELECT) {
      return "赤い印の遠距離攻撃対象を選んでください。";
    }
    if (mode === InteractionMode.CHARGE_TARGET_SELECT) {
      return "赤い印の敵を選んで突撃します。";
    }
    if (TARGET_SELECT_MODE_SET.has(mode)) {
      return "赤い印の計略対象を選んでください。";
    }
    if (mode === InteractionMode.WAIT_FACING_SELECT) {
      return "隣接する黄色のマスで向きを決定。戻るで移動を取り消します。";
    }
    if (mode === InteractionMode.TACTIC_FACING_SELECT) {
      return "隣接する黄色のマスで、計略後の向きを決めてください。";
    }
    return "対象を選んでください。";
  }

  #presentMission(briefing, abortSignal) {
    this.#renderer.showMission(briefing);
    return new Promise((resolve, reject) => {
      const handleAbort = () => {
        this.#missionPending = null;
        abortSignal.removeEventListener("abort", handleAbort);
        this.#renderer.hideMission(); reject(createAbortError());
      };
      this.#missionPending = { resolve, abortSignal, handleAbort };
      abortSignal.addEventListener("abort", handleAbort, { once: true });
      if (abortSignal.aborted) handleAbort();
    });
  }
  #finishMission() {
    const pending = this.#missionPending;
    if (!pending) return;
    this.#missionPending = null;
    pending.abortSignal.removeEventListener("abort", pending.handleAbort);
    this.#renderer.hideMission(); pending.resolve();
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
    this.#renderer.renderDialogue(speech);
  }

  #scheduleRefresh() {
    setTimeout(() => {
      if (!this.#disposed) {
        this.refresh();
      }
    }, 0);
  }
}
