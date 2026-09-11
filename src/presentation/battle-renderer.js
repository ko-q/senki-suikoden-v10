import { invariant } from "../core/domain-error.js";
import { ActionType, TACTIC_ACTION_TYPES } from "../core/action-request.js";
import { PresentationRequestType } from "../core/presentation-request.js";
import { Affiliation } from "../domain/army.js";
import { Stage } from "../domain/stage.js";
import { Facing, UnitActionState } from "../domain/unit.js";
import { UnitAbility, UnitUse } from "../domain/unit-ability.js";

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
  "dialogueSpeaker",
  "dialogueText",
  "domainValue",
  "endTurnButton",
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
    return "Projectile";
  }
  const throwOnly = unit.hasAbility(UnitAbility.THROW_ATTACK)
    && !unit.hasAbility(UnitAbility.BOW_ATTACK);
  const name = throwOnly ? "Throw" : "Bow";
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

  constructor(elements) {
    this.#elements = requireElements(elements);
    this.#handlers = null;
    this.#handlersBound = false;
    this.#eventBindings = [];
    this.#boardBindings = [];
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
    onWait
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
    for (const binding of this.#eventBindings) {
      binding.element.removeEventListener(binding.type, binding.listener);
    }
    this.#eventBindings = [];
    this.#handlers = null;
    this.#handlersBound = false;
  }

  render(stage, viewState) {
    invariant(stage instanceof Stage, "BATTLE_RENDERER_STAGE_REQUIRED");
    invariant(this.#handlersBound, "BATTLE_RENDERER_HANDLERS_REQUIRED");
    invariant(
      viewState !== null && typeof viewState === "object",
      "BATTLE_RENDERER_VIEW_STATE_REQUIRED"
    );

    this.#elements.modeValue.textContent = viewState.mode;
    this.#elements.domainValue.textContent = viewState.domainLabel;
    this.#elements.turnValue.textContent = String(stage.turn);
    this.#elements.phaseValue.textContent = stage.phase;
    this.#elements.instructionText.textContent = viewState.instruction;
    this.#renderBoard(stage, viewState);
    this.#renderSelectedUnit(viewState.selectedUnit);
    this.#renderControls(viewState);
  }

  renderPresentation(request) {
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

  renderDialogue(speech, isLast) {
    invariant(speech !== null && typeof speech === "object", "BATTLE_SPEECH_REQUIRED");
    this.#elements.dialogueSpeaker.textContent = speech.speaker.name;
    this.#elements.dialogueText.textContent = speech.text;
    this.#elements.dialogueNextButton.textContent = isLast ? "Close" : "Next";
    this.#elements.dialogueOverlay.hidden = false;
  }

  hideDialogue() {
    this.#elements.dialogueOverlay.hidden = true;
    this.#elements.dialogueSpeaker.textContent = "";
    this.#elements.dialogueText.textContent = "";
  }

  showInfo(text) {
    this.#elements.eventText.textContent = String(text);
    this.#elements.eventText.dataset.tone = "info";
  }

  showError(text) {
    this.#elements.eventText.textContent = String(text);
    this.#elements.eventText.dataset.tone = "error";
  }

  #renderBoard(stage, viewState) {
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
    this.#elements.board.style.gridTemplateColumns = `repeat(${stage.map.width}, minmax(2.8rem, 1fr))`;
    this.#elements.board.setAttribute("aria-busy", viewState.inputLocked ? "true" : "false");
    this.#elements.board.dataset.actionType = viewState.selectedActionType ?? "";

    for (let y = 0; y < stage.map.height; y += 1) {
      for (let x = 0; x < stage.map.width; x += 1) {
        const cell = stage.map.getCellAt(x, y);
        const key = cell.position.toKey();
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.terrain = cell.terrain.id;
        button.disabled = viewState.inputLocked;
        button.setAttribute("role", "gridcell");
        button.setAttribute("aria-label", this.#cellLabel(cell, stage));

        if (viewState.reachableByKey.has(key)) {
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
        }
        if (cell.occupant !== null) {
          button.append(this.#createUnitToken(cell.occupant, stage));
        }
        const listener = () => this.#handlers?.onCell(cell.position);
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

  #clearBoardBindings() {
    for (const binding of this.#boardBindings) {
      binding.element.removeEventListener(binding.type, binding.listener);
    }
    this.#boardBindings = [];
  }

  #createUnitToken(unit, stage) {
    const token = document.createElement("span");
    const affiliation = stage.armyManager.getAffiliation(unit);
    token.className = `unit-token ${affiliation === Affiliation.PLAYER ? "player" : "enemy"}`;
    if (unit.actionState === UnitActionState.FINISHED) {
      token.classList.add("is-finished");
    }

    const name = document.createElement("strong");
    name.textContent = unit.character.shortName;
    const troops = document.createElement("small");
    troops.textContent = String(unit.troops);
    token.append(name, troops);
    return token;
  }

  #cellLabel(cell, stage) {
    if (cell.occupant === null) {
      return `${cell.terrain.nameKey} ${cell.position.toKey()}`;
    }
    const unit = cell.occupant;
    const affiliation = stage.armyManager.getAffiliation(unit);
    return `${cell.terrain.nameKey} ${cell.position.toKey()} ${affiliation} ${unit.character.name} ${unit.troops}`;
  }

  #renderSelectedUnit(unit) {
    this.#elements.selectedUnitText.textContent = unit === null
      ? "No unit selected."
      : `${unit.character.name} · ${unit.troops}/${unit.maxTroops} · ${unit.actionState}`;
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
      ? "Charge"
      : `Charge ${useText(selectedUnit, UnitUse.CHARGE)}`;
    this.#elements.chargeButton.disabled = viewState.inputLocked
      || !availableActions.has(ActionType.CHARGE);
    this.#elements.tacticButton.textContent = selectedUnit === null
      ? "Tactic"
      : `Tactic ${useText(selectedUnit, UnitUse.TACTIC)}`;
    this.#elements.tacticButton.disabled = viewState.inputLocked || !tacticAvailable;

    this.#elements.pathButton.disabled = viewState.inputLocked
      || viewState.candidatePaths.length <= 1;
    this.#elements.pathButton.textContent = viewState.candidatePaths.length === 0
      ? "Path 0/0"
      : `Path ${viewState.selectedPathIndex + 1}/${viewState.candidatePaths.length}`;
    this.#elements.pathSummary.textContent = path.length === 0
      ? "No movement path"
      : `${path.length} steps · cost ${viewState.previewCost}`;
    this.#elements.resetButton.disabled = viewState.inputLocked
      || viewState.selectedUnit === null;
    this.#elements.waitButton.disabled = viewState.inputLocked || !viewState.canWait;
    this.#elements.endTurnButton.disabled = viewState.inputLocked || !viewState.canEndTurn;

    this.#elements.tacticPanel.hidden = !viewState.showTacticPanel;
    this.#elements.tacticPanel.setAttribute(
      "aria-hidden",
      viewState.showTacticPanel ? "false" : "true"
    );
    for (const { key, type } of TACTIC_BUTTONS) {
      const button = this.#elements[key];
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
