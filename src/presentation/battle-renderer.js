import { invariant } from "../core/domain-error.js";
import { ActionType, TACTIC_ACTION_TYPES } from "../core/action-request.js";
import { PresentationRequestType } from "../core/presentation-request.js";
import { Affiliation } from "../domain/army.js";
import { Stage } from "../domain/stage.js";
import { Facing, UnitActionState } from "../domain/unit.js";
import { UnitAbility, UnitUse } from "../domain/unit-ability.js";
import { CharacterPortraitView } from "./character-portrait-view.js";
import { LongPressGesture } from "./long-press-gesture.js";
import { UnitDetailView, tacticName, confusionLevel } from "./unit-detail-view.js";
import { BattleMapView } from "./battle-map-view.js";
import { SelectionRingView } from "./selection-ring-view.js";
import { TerrainInfoView, TERRAIN_NAMES } from "./terrain-info-view.js";
import { BoardViewportLayout } from "./board-viewport-layout.js";

const TACTIC_BUTTONS = Object.freeze([
  Object.freeze({ key: "confusionLv1Button", type: ActionType.CONFUSION_LV1 }),
  Object.freeze({ key: "confusionLv2Button", type: ActionType.CONFUSION_LV2 }),
  Object.freeze({ key: "confusionLv3Button", type: ActionType.CONFUSION_LV3 }),
  Object.freeze({ key: "illusionButton", type: ActionType.ILLUSION }),
  Object.freeze({ key: "wideIllusionButton", type: ActionType.WIDE_ILLUSION }),
  Object.freeze({ key: "fireButton", type: ActionType.FIRE }),
  Object.freeze({ key: "waterButton", type: ActionType.WATER })
]);

const REQUIRED_ELEMENT_KEYS = Object.freeze([
  "actionPanel",
  "board",
  "bowButton",
  "chargeButton",
  "confusionLv1Button",
  "confusionLv2Button",
  "confusionLv3Button",
  "dialogueNextButton",
  "dialogueOverlay",
  "dialoguePortrait",
  "dialogueSpeaker",
  "dialogueAction",
  "dialogueText",
  "domainValue",
  "endTurnButton",
  "effectLayer",
  "eventText",
  "fireButton",
  "facingEastButton",
  "facingNorthButton",
  "facingPanel",
  "facingSouthButton",
  "facingWestButton",
  "instructionText",
  "illusionButton",
  "modeValue",
  "pathButton",
  "pathSummary",
  "phaseValue",
  "resetButton",
  "selectedUnitText",
  "selectedUnitPortrait",
  "tacticButton",
  "tacticPanel",
  "turnValue",
  "versionValue",
  "waitButton",
  "waterButton",
  "wideIllusionButton"
]);

function requireElements(elements) {
  invariant(
    elements !== null && typeof elements === "object",
    "BATTLE_RENDERER_ELEMENTS_REQUIRED"
  );
  for (const key of REQUIRED_ELEMENT_KEYS) {
    invariant(elements[key] !== null && elements[key] !== undefined, "BATTLE_RENDERER_ELEMENT_MISSING", {
      key
    });
  }
  return elements;
}

function totalDamage(entries = []) {
  return entries.reduce((sum, entry) => sum + (entry.damage ?? 0), 0);
}

function useText(unit, useId) {
  return `${unit.remainingUses[useId] ?? 0}/${unit.maxUses[useId] ?? 0}`;
}

function projectileLabel(unit) {
  if (unit === null) {
    return "遠距離不可";
  }
  const throwOnly = unit.hasAbility(UnitAbility.THROW_ATTACK)
    && !unit.hasAbility(UnitAbility.BOW_ATTACK);
  if (!throwOnly && !unit.hasAbility(UnitAbility.BOW_ATTACK)) return "遠距離不可";
  const name = throwOnly ? "投擲" : "弓撃";
  return `${name} ${useText(unit, UnitUse.PROJECTILE)}`;
}

/**
 * Stageと画面状態をDOMへ描画する。Domain objectは一切変更しない。
 */
export class BattleRenderer {
  #elements;
  #handlers;
  #handlersBound;
  #eventBindings;
  #boardBindings;
  #dialoguePortrait;
  #selectedPortrait;
  #mapView;
  #selectionRing;
  #terrainInfo;
  #viewportLayout;
  #openingPositioned = false;
  #visibleSelectionKey = null;
  #detail; #gesture; #gestureBindings = []; #unitInfoBindings = []; #currentStage; #currentView;

  constructor(elements) {
    this.#elements = requireElements(elements);
    this.#handlers = null;
    this.#handlersBound = false;
    this.#eventBindings = [];
    this.#boardBindings = [];
    this.#dialoguePortrait = new CharacterPortraitView(elements.dialoguePortrait);
    this.#selectedPortrait = new CharacterPortraitView(elements.selectedUnitPortrait);
    this.#mapView = new BattleMapView(elements.board);
    this.#selectionRing = new SelectionRingView(elements.board);
    this.#terrainInfo = new TerrainInfoView(elements.terrainInfoText);
    this.#viewportLayout = new BoardViewportLayout(elements);
  }

  bindHandlers({
    onAction,
    onCell,
    onClear,
    onEndTurn,
    onFacing,
    onNextDialogue,
    onPath,
    onTacticMenu,
    onWait,
    onMissionStart = () => {}
  }) {
    invariant(!this.#handlersBound, "BATTLE_RENDERER_HANDLERS_ALREADY_BOUND");
    for (const handler of [
      onAction,
      onCell,
      onClear,
      onEndTurn,
      onFacing,
      onNextDialogue,
      onPath,
      onTacticMenu,
      onWait
    ]) {
      invariant(typeof handler === "function", "BATTLE_RENDERER_HANDLER_REQUIRED");
    }
    this.#handlers = {
      onAction,
      onCell,
      onClear,
      onEndTurn,
      onFacing,
      onNextDialogue,
      onPath,
      onTacticMenu,
      onWait
    };
    this.#handlersBound = true;
    this.#detail = new UnitDetailView(this.#elements.unitDetailOverlay);
    this.#gesture = new LongPressGesture({
      canOpen: () => this.#handlersBound && this.#currentStage?.phase === "PLAYER" && !this.#currentView?.inputLocked && !this.#detail.isOpen,
      open: (unit) => this.#showUnitDetail(unit), release: () => this.#detail.release()
    });
    for (const element of [this.#elements.selectedUnitText, this.#elements.selectedUnitPortrait]) {
      this.#unitInfoBindings.push(this.#gesture.bind(element, () => this.#currentView?.selectedUnit));
      this.#listen(element, () => this.#gesture.consumeClick());
      this.#listen(element, (event) => {
        if (["Enter", " "].includes(event.key) && this.#currentView?.selectedUnit && !this.#currentView.inputLocked) {
          event.preventDefault(); this.#showUnitDetail(this.#currentView.selectedUnit, true);
        }
      }, "keydown");
      element.tabIndex = 0; element.setAttribute("role", "button"); element.setAttribute("aria-label", "部隊の能力詳細（長押し）");
    }
    if (this.#elements.missionStartButton) this.#listen(this.#elements.missionStartButton, onMissionStart);

    this.#listen(this.#elements.resetButton, () => this.#handlers?.onClear());
    this.#listen(this.#elements.endTurnButton, () => this.#handlers?.onEndTurn());
    this.#listen(
      this.#elements.bowButton,
      () => this.#handlers?.onAction(ActionType.BOW_ATTACK)
    );
    this.#listen(
      this.#elements.chargeButton,
      () => this.#handlers?.onAction(ActionType.CHARGE)
    );
    this.#listen(
      this.#elements.tacticButton,
      () => this.#handlers?.onTacticMenu()
    );
    for (const { key, type } of TACTIC_BUTTONS) {
      this.#listen(this.#elements[key], () => this.#handlers?.onAction(type));
    }
    this.#listen(this.#elements.pathButton, () => this.#handlers?.onPath());
    this.#listen(this.#elements.waitButton, () => this.#handlers?.onWait());
    this.#listen(
      this.#elements.dialogueNextButton,
      () => this.#handlers?.onNextDialogue()
    );
    this.#listen(
      this.#elements.facingNorthButton,
      () => this.#handlers?.onFacing(Facing.NORTH)
    );
    this.#listen(
      this.#elements.facingEastButton,
      () => this.#handlers?.onFacing(Facing.EAST)
    );
    this.#listen(
      this.#elements.facingSouthButton,
      () => this.#handlers?.onFacing(Facing.SOUTH)
    );
    this.#listen(
      this.#elements.facingWestButton,
      () => this.#handlers?.onFacing(Facing.WEST)
    );
  }

  /**
   * session破棄後に固定buttonと旧盤面からcallbackを到達不能にする。
   */
  unbindHandlers() {
    if (!this.#handlersBound) {
      return;
    }
    this.#clearBoardBindings();
    for (const dispose of this.#unitInfoBindings) dispose();
    this.#unitInfoBindings = []; this.#gesture.cancel(); this.#detail.dispose();
    for (const binding of this.#eventBindings) {
      binding.element.removeEventListener(binding.type, binding.listener);
    }
    this.#eventBindings = [];
    this.#handlers = null;
    this.#handlersBound = false;
    this.#dialoguePortrait.clear();
    this.#selectedPortrait.clear();
    this.#mapView.clear();
    this.#selectionRing.clear();
    this.#viewportLayout.dispose();
  }

  render(stage, viewState) {
    invariant(stage instanceof Stage, "BATTLE_RENDERER_STAGE_REQUIRED");
    invariant(this.#handlersBound, "BATTLE_RENDERER_HANDLERS_REQUIRED");
    invariant(
      viewState !== null && typeof viewState === "object",
      "BATTLE_RENDERER_VIEW_STATE_REQUIRED"
    );

    this.#currentStage = stage; this.#currentView = viewState;
    if (this.#elements.battleToolbar) this.#elements.battleToolbar.hidden = stage.phase !== "PLAYER" || viewState.battleFinished === true;
    if (viewState.inputLocked) this.#detail.hide();
    this.#elements.modeValue.textContent = viewState.mode;
    this.#elements.domainValue.textContent = viewState.domainLabel;
    const turnLimit = stage.objectiveManager.getAll().find((objective) => typeof objective.maxTurn === "number")?.maxTurn;
    this.#elements.turnValue.textContent = `${stage.turn}${turnLimit ? `/${turnLimit}` : ""}`;
    this.#elements.phaseValue.textContent = stage.phase === "PLAYER" ? "味方ターン" : "敵ターン";
    for (const [key, army, label] of [["playerCountText", stage.armyManager.playerArmy, "味方"], ["enemyCountText", stage.armyManager.enemyArmy, "敵"]]) {
      if (this.#elements[key]) this.#elements[key].textContent = `${label} ${stage.unitOrder.filter((unit) => army.has(unit) && unit.hasTroops() && stage.map.getPosition(unit)).length}`;
    }
    this.#elements.instructionText.textContent = viewState.instruction;
    this.#mapView.render(stage);
    this.#renderBoard(stage, viewState);
    this.#selectionRing.render(stage, viewState);
    this.#renderSelectedUnit(viewState.selectedUnit, stage, viewState);
    this.#renderControls(viewState);
    this.#viewportLayout.sync();
    if (!viewState.inputLocked && !this.#openingPositioned) {
      const scroll = this.#elements.board.closest?.(".board-scroll");
      if (scroll && scroll.clientHeight > 0) {
        const positions = stage.unitOrder.filter((unit) => stage.armyManager.playerArmy.has(unit) && unit.hasTroops()).map((unit) => stage.map.getPosition(unit)).filter(Boolean);
        if (positions.length) {
          const cell = this.#elements.board.children[0];
          const row = positions.reduce((sum, position) => sum + position.y, 0) / positions.length;
          scroll.scrollTop = Math.max(0, (this.#elements.boardTopSpacer?.offsetHeight ?? 0) + (row + .5) * cell.offsetHeight - scroll.clientHeight * .65);
        }
        this.#openingPositioned = true;
      }
    }
    const selection = viewState.presentationPosition ?? viewState.selectionPosition ?? viewState.previewDestination
      ?? (viewState.selectedUnit ? stage.map.getPosition(viewState.selectedUnit) : null);
    const selectionKey = selection ? `${selection.toKey()}:${viewState.mode}` : null;
    if ((!viewState.inputLocked || viewState.presentationPosition) && selectionKey !== this.#visibleSelectionKey) {
      this.#viewportLayout.keepCellVisible(selection);
      this.#visibleSelectionKey = selectionKey;
    }
  }

  renderPresentation(request) {
    if (request.type === PresentationRequestType.UNIT_FOCUS) return;
    let text = request.type;
    if (request.type === PresentationRequestType.NOTICE) {
      text = request.messageKey;
    } else if (request.type === PresentationRequestType.MOVE) {
      text = `${request.payload.unitId} moved.`;
    } else if (request.type === PresentationRequestType.ACTION) {
      text = `${request.payload.actorId} used ${request.payload.actionType}.`;
    } else if (request.type === PresentationRequestType.DAMAGE) {
      text = `Damage ${totalDamage(request.payload.entries)}.`;
    } else if (request.type === PresentationRequestType.STATUS) {
      text = `Status updated: ${request.payload.reason}.`;
    } else if (request.type === PresentationRequestType.TRAP) {
      text = request.payload.neutralized
        ? `${request.payload.trapId} was neutralized.`
        : `${request.payload.unitId} triggered ${request.payload.trapId}.`;
    } else if (request.type === PresentationRequestType.PHASE) {
      text = `Turn ${request.payload.turn}: ${request.payload.phase}.`;
    } else if (request.type === PresentationRequestType.CONFIRM) {
      text = request.payload.messageKey ?? "Confirmation required.";
    } else if (request.type === PresentationRequestType.BATTLE_RESULT) {
      text = request.payload.outcome === "VICTORY" ? "Victory." : "Defeat.";
    }
    this.showInfo(text);
  }

  renderDialogue(speech) {
    invariant(speech !== null && typeof speech === "object", "BATTLE_SPEECH_REQUIRED");
    this.#elements.dialogueSpeaker.textContent = speech.speaker?.name ?? speech.narratorLabel;
    this.#elements.dialogueAction.textContent = speech.actionLabel ?? "";
    this.#elements.dialogueAction.hidden = !speech.actionLabel;
    this.#dialoguePortrait.render(speech.speaker);
    this.#elements.dialogueText.textContent = speech.text;
    this.#elements.dialogueNextButton.textContent = "進む";
    this.#elements.dialogueOverlay.hidden = false;
  }

  hideDialogue() {
    this.#elements.dialogueOverlay.hidden = true;
    this.#dialoguePortrait.clear();
    this.#elements.dialogueSpeaker.textContent = "";
    this.#elements.dialogueAction.textContent = "";
    this.#elements.dialogueAction.hidden = true;
    this.#elements.dialogueText.textContent = "";
  }

  showMission(briefing) {
    this.#elements.missionVictory.textContent = briefing.victory;
    this.#elements.missionDefeat.textContent = briefing.defeat;
    this.#elements.missionOverlay.hidden = false;
  }
  hideMission() { if (this.#elements.missionOverlay) this.#elements.missionOverlay.hidden = true; }

  showInfo(text) {
    this.#elements.eventText.textContent = String(text);
    this.#elements.eventText.dataset.tone = "info";
  }

  showError(text) {
    this.#elements.eventText.textContent = String(text);
    this.#elements.eventText.dataset.tone = "error";
  }

  #renderBoard(stage, viewState) {
    const escapes = stage.objectiveManager.getAll().filter(objective => objective.destination);
    const activeEscapes = escapes.filter(objective => objective.isActive(stage.eventManager));
    const selectedPath = viewState.candidatePaths[viewState.selectedPathIndex] ?? [];
    const pathKeys = new Set(selectedPath.map((position) => position.toKey()));
    const targetKeys = new Set(viewState.selectableTargets
      .map((unit) => stage.map.getPosition(unit))
      .filter((position) => position !== null)
      .map((position) => position.toKey()));
    const selectedPosition = viewState.selectedUnit === null
      ? null
      : stage.map.getPosition(viewState.selectedUnit);

    this.#clearBoardBindings();
    this.#elements.board.replaceChildren();
    this.#elements.board.style.gridTemplateColumns = `repeat(${stage.map.width}, var(--cell))`;
    this.#elements.board.setAttribute("aria-busy", viewState.inputLocked ? "true" : "false");
    this.#elements.board.dataset.actionType = viewState.selectedActionType ?? "";

    for (let y = 0; y < stage.map.height; y += 1) {
      for (let x = 0; x < stage.map.width; x += 1) {
        const cell = stage.map.getCellAt(x, y);
        const key = cell.position.toKey();
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.x = String(x);
        button.dataset.y = String(y);
        button.dataset.terrain = cell.terrain.id;
        button.disabled = viewState.inputLocked;
        button.setAttribute("role", "gridcell");
        const displayUnit = viewState.previewDestination?.equals(cell.position) ? viewState.selectedUnit
          : viewState.previewDestination && cell.occupant === viewState.selectedUnit ? null : cell.occupant;
        button.setAttribute("aria-label", this.#cellLabel(cell, stage, displayUnit));

        if (viewState.mode === "UNIT_SELECTED" && viewState.reachableByKey.has(key)) {
          button.classList.add("is-reachable");
          const cost = document.createElement("span");
          cost.className = "move-cost";
          cost.textContent = String(viewState.reachableByKey.get(key));
          button.append(cost);
        }
        if (pathKeys.has(key)) {
          button.classList.add("is-path");
        }
        if (targetKeys.has(key)) {
          button.classList.add("is-target");
        }
        if (viewState.previewDestination?.equals(cell.position)) {
          button.classList.add("is-destination");
        }
        if (selectedPosition?.equals(cell.position)) {
          button.classList.add("is-origin");
          if (viewState.previewDestination) button.classList.add("has-preview");
        }
        const facingOrigin = viewState.previewDestination ?? selectedPosition;
        if (["MOVE_PREVIEW", "WAIT_FACING_SELECT", "TACTIC_FACING_SELECT"].includes(viewState.mode) && facingOrigin && Math.abs(x - facingOrigin.x) + Math.abs(y - facingOrigin.y) === 1 && !targetKeys.has(key)) button.classList.add("is-facing");
        if (activeEscapes.some(objective => cell.position.manhattanDistanceTo(objective.destination) <= objective.radius)) {
          button.classList.add("escape-zone");
        }
        const escape = escapes.find(objective => objective.destination.equals(cell.position));
        if (escape) {
          // V9 keeps the flag visible as a landmark before the raid objective activates.
          const flag = document.createElement("span"), pole = document.createElement("span"), cloth = document.createElement("span");
          flag.className = "escape-flag"; pole.className = "pole"; cloth.className = "cloth";
          flag.setAttribute("aria-hidden", "true"); cloth.textContent = "脱";
          flag.append(pole, cloth); button.append(flag);
        }
        if (viewState.previewDestination?.equals(cell.position) && viewState.selectedUnit) {
          button.append(this.#createUnitToken(viewState.selectedUnit, stage, viewState.previewFacing));
        } else if (cell.occupant !== null && !(viewState.previewDestination && cell.occupant === viewState.selectedUnit)) {
          button.append(this.#createUnitToken(cell.occupant, stage));
        }
        this.#gestureBindings.push(this.#gesture.bind(button, () => displayUnit));
        const listener = () => { if (!this.#gesture.consumeClick() && !this.#detail.isOpen) this.#handlers?.onCell(cell.position); };
        button.addEventListener("click", listener);
        this.#boardBindings.push({ element: button, type: "click", listener });
        this.#elements.board.append(button);
      }
    }
  }

  #listen(element, listener, type = "click") {
    element.addEventListener(type, listener);
    this.#eventBindings.push({ element, type, listener });
  }

  #showUnitDetail(unit, keyboard = false) {
    const position = unit === this.#currentView.selectedUnit && this.#currentView.previewDestination
      ? this.#currentView.previewDestination : this.#currentStage.map.getPosition(unit);
    const facing = unit === this.#currentView.selectedUnit ? this.#currentView.previewFacing ?? unit.facing : unit.facing;
    this.#detail.show(unit, this.#currentStage, position, { keyboard, facing });
  }

  #clearBoardBindings() {
    for (const dispose of this.#gestureBindings) dispose();
    this.#gestureBindings = [];
    for (const binding of this.#boardBindings) {
      binding.element.removeEventListener(binding.type, binding.listener);
    }
    this.#boardBindings = [];
  }

  #createUnitToken(unit, stage, displayFacing = null) {
    const token = document.createElement("span");
    const affiliation = stage.armyManager.getAffiliation(unit);
    token.className = `unit-token ${affiliation === Affiliation.PLAYER ? "player" : "enemy"}`;
    token.dataset.unitId = unit.id;
    if (unit.actionState === UnitActionState.FINISHED && affiliation === stage.phase) {
      token.classList.add("is-finished");
    }

    const name = document.createElement("strong");
    name.textContent = unit.character.shortName;
    const troops = document.createElement("small");
    troops.textContent = String(unit.troops);
    const hp = document.createElement("span"), fill = document.createElement("span"), facing = document.createElement("span");
    hp.className = "unit-hp"; fill.style.width = `${100 * unit.troops / unit.maxTroops}%`; hp.append(fill);
    facing.className = "unit-facing"; facing.dataset.facing = displayFacing ?? unit.facing;
    token.append(name, troops, hp, facing);
    for (const effect of unit.statusEffects) {
      const status = document.createElement("span"); status.className = "unit-status";
      status.dataset.status = effect.type;
      status.textContent = `${effect.type === "ILLUSION" ? "☠" : "？"}${effect.remainingTurns}`;
      status.setAttribute("aria-label", `${effect.type === "ILLUSION" ? "幻術" : "撹乱"} 残り${effect.remainingTurns}ターン`);
      token.append(status);
    }
    return token;
  }

  #cellLabel(cell, stage, unit = cell.occupant) {
    if (unit === null) {
      return `${TERRAIN_NAMES[cell.terrain.id] ?? cell.terrain.nameKey} ${cell.position.toKey()}`;
    }
    const affiliation = stage.armyManager.getAffiliation(unit);
    return `${TERRAIN_NAMES[cell.terrain.id] ?? cell.terrain.nameKey} ${cell.position.toKey()} ${affiliation === "PLAYER" ? "味方" : "敵"} ${unit.character.name} ${unit.troops}`;
  }

  #renderSelectedUnit(unit, stage, viewState) {
    this.#selectedPortrait.render(unit?.character ?? null);
    const position = viewState.selectionPosition ?? viewState.previewDestination ?? (unit ? stage.map.getPosition(unit) : null);
    if (this.#elements.commandDock) this.#elements.commandDock.hidden = position === null;
    if (this.#elements.selectedUnitInfo) this.#elements.selectedUnitInfo.hidden = unit === null;
    const terrain = position ? stage.map.getCellAt(position.x, position.y).terrain : null;
    this.#terrainInfo.render(terrain, unit);
    const facingNames = { NORTH: "北", EAST: "東", SOUTH: "南", WEST: "西" };
    const inactiveRules = unit ? stage.unitControlRules.filter((rule) => rule.unit === unit && !rule.canAct(stage.eventManager)) : [];
    const statuses = unit?.statusEffects.map((effect) => `${effect.type === "ILLUSION" ? "幻術" : "撹乱"}${effect.remainingTurns}`) ?? [];
    statuses.push(...inactiveRules.map((rule) => rule.actionLabel).filter(Boolean));
    if (unit && !statuses.length && !inactiveRules.length && unit.actionState === UnitActionState.FINISHED
      && stage.armyManager.getAffiliation(unit) === stage.phase) statuses.push("行動済み");
    this.#elements.selectedUnitText.textContent = unit === null
      ? ""
      : `部隊情報：${unit.character.name}\n兵力 ${unit.troops}/${unit.maxTroops}　方向 ${facingNames[viewState.previewFacing ?? unit.facing]}　移動 ${unit.move}　状態 ${statuses.join("・") || "通常"}`;
  }

  #renderControls(viewState) {
    const path = viewState.candidatePaths[viewState.selectedPathIndex] ?? [];
    const availableActions = new Set(viewState.availableActions);
    const selectedUnit = viewState.selectedUnit;
    const tacticAvailable = TACTIC_ACTION_TYPES.some((type) => availableActions.has(type));

    this.#elements.actionPanel.hidden = !viewState.showPrimaryCommands;
    this.#elements.bowButton.textContent = projectileLabel(selectedUnit);
    this.#elements.bowButton.disabled = viewState.inputLocked
      || !availableActions.has(ActionType.BOW_ATTACK);
    this.#elements.chargeButton.textContent = selectedUnit === null
      ? "突撃"
      : selectedUnit.hasAbility(UnitAbility.CHARGE) ? `突撃 ${useText(selectedUnit, UnitUse.CHARGE)}` : "突撃不可";
    this.#elements.chargeButton.disabled = viewState.inputLocked
      || !availableActions.has(ActionType.CHARGE);
    const tactic = tacticName(selectedUnit);
    this.#elements.tacticButton.textContent = !selectedUnit || !(selectedUnit.maxUses[UnitUse.TACTIC] > 0) ? "計略不可"
      : `${tactic} ${useText(selectedUnit, UnitUse.TACTIC)}${tactic === "撹乱" ? ` Lv${confusionLevel(selectedUnit)}` : ""}`;
    this.#elements.tacticButton.disabled = viewState.inputLocked || !tacticAvailable;

    this.#elements.pathButton.disabled = viewState.inputLocked
      || viewState.candidatePaths.length <= 1;
    this.#elements.pathButton.hidden = viewState.candidatePaths.length <= 1;
    this.#elements.pathButton.textContent = viewState.candidatePaths.length === 0
      ? "経路 0/0"
      : `経路 ${viewState.selectedPathIndex + 1}/${viewState.candidatePaths.length}`;
    this.#elements.pathSummary.textContent = path.length === 0
      ? "No movement path"
      : `${path.length} steps · cost ${viewState.previewCost}`;
    this.#elements.resetButton.disabled = viewState.inputLocked
      || viewState.mode === "TACTIC_FACING_SELECT"
      || (viewState.selectedUnit === null && !viewState.selectionPosition);
    this.#elements.waitButton.disabled = viewState.inputLocked || !viewState.canWait;
    this.#elements.endTurnButton.disabled = viewState.inputLocked || !viewState.canEndTurn;
    for (const key of ["stageInfoButton", "battleStatusButton", "strategyGuideButton"]) {
      if (this.#elements[key]) this.#elements[key].disabled = viewState.inputLocked;
    }

    this.#elements.tacticPanel.hidden = !viewState.showTacticPanel;
    this.#elements.tacticPanel.setAttribute(
      "aria-hidden",
      viewState.showTacticPanel ? "false" : "true"
    );
    for (const { key, type } of TACTIC_BUTTONS) {
      const button = this.#elements[key];
      button.hidden = ![ActionType.CONFUSION_LV1, ActionType.CONFUSION_LV2, ActionType.CONFUSION_LV3].includes(type) && !availableActions.has(type);
      button.disabled = viewState.inputLocked || !availableActions.has(type);
      button.dataset.active = viewState.selectedActionType === type ? "true" : "false";
    }

    this.#elements.facingPanel.hidden = !viewState.showFacingPanel;
    for (const button of [
      this.#elements.facingNorthButton,
      this.#elements.facingEastButton,
      this.#elements.facingSouthButton,
      this.#elements.facingWestButton
    ]) {
      button.disabled = viewState.inputLocked;
    }
  }
}
