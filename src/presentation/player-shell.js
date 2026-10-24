import { renderStrategyGuide } from "./strategy-guide.js";
import { StageSelectionScreen } from "./stage-selection-screen.js";
import { formatV9ObjectiveText } from "../definitions/v9-objective-text.js";
import { ModalFocus } from "./modal-focus.js";

/** Owns navigation overlays; battle rules and session replacement stay in Game. */
export class PlayerShell {
  #elements; #stages; #game; #menu; #bindings = []; #battleBindings = [];
  #activeInfoButton = null;
  #infoFocus; #slotsFocus;
  constructor({ elements, stages, game }) {
    this.#elements = elements; this.#stages = stages; this.#game = game;
    const blockedRoots = [elements.battleHost, elements.stageSelectOverlay];
    this.#infoFocus = new ModalFocus({ root: elements.battleInfoOverlay,
      initialFocus: elements.closeBattleInfoButton, blockedRoots, onEscape: () => this.#hideInfo() });
    this.#slotsFocus = new ModalFocus({ root: elements.saveSlotOverlay,
      initialFocus: elements.closeSaveSlotsButton, blockedRoots, onEscape: () => this.#hideSlots() });
    this.#menu = new StageSelectionScreen({ root: elements.stageSelectOverlay,
      list: elements.stageList, loadButton: elements.stageSelectLoadButton, stages,
      onSelect: (stageId) => {
        const replacement = game.startNewBattle({ stageId });
        if (!replacement) this.openSlots();
      }, onLoad: () => this.openSlots() });
    this.#listen(elements.closeSaveSlotsButton, () => this.#hideSlots());
    this.#listen(elements.battleInfoOverlay, (event) => {
      // V9.5.6+: tap to open; ordinary action buttons stay usable inside the overlay.
      if (!event.target.closest?.("button")) this.#hideInfo();
    });
    this.#listen(elements.closeBattleInfoButton, () => this.#hideInfo());
    this.#listen(elements.openSaveButton, () => this.openSlots("save"));
    this.#listen(elements.openLoadButton, () => this.openSlots());
    this.#listen(elements.returnStageSelectButton, () => this.showStageSelection());
  }
  showStageSelection() {
    this.#hideSlots(false);
    this.#hideInfo(false);
    this.#elements.battleHost.hidden = true;
    this.#menu.show();
  }
  openSlots(mode = "load") {
    // Return to the original toolbar/menu, never a hidden button in the info card.
    const returnFocus = this.#activeInfoButton ?? this.#elements.stageSelectLoadButton;
    this.#hideInfo(false);
    this.#game.refreshManualSlots(false);
    this.#elements.persistenceTitle.textContent = mode === "save" ? "セーブ選択" : "ロード選択";
    this.#elements.saveSlotOverlay.dataset.mode = mode;
    this.#elements.saveSlotOverlay.hidden = false;
    this.#slotsFocus.activate(returnFocus);
  }
  attachSession(session) {
    this.#menu.hide();
    this.#elements.battleHost.hidden = false;
    this.#hideSlots(false);
    this.#hideInfo(false);
    for (const [element, listener] of this.#battleBindings) element.removeEventListener("click", listener);
    this.#battleBindings = [];
    const source = this.#stages.find((stage) => stage.id === session.stage.id);
    for (const [id, kind] of [["stageInfoButton", "stage"], ["battleStatusButton", "status"], ["strategyGuideButton", "guide"]]) {
      const element = this.#elements.battleHost.querySelector(`#${id}`);
      element.setAttribute("aria-expanded", "false");
      const listener = () => {
        if (element.disabled || session.controller.isDisposed || session.stage.phase !== "PLAYER" || session.controller.flowState !== "IDLE" || session.controller.getBattleResult()) return;
        this.#hideInfo(); this.#activeInfoButton = element;
        element.setAttribute("aria-expanded", "true"); this.#showInfo(kind, session, source);
      };
      element.addEventListener("click", listener); this.#battleBindings.push([element, listener]);
    }
    session.screen.refresh();
  }
  #showInfo(kind, session, source) {
    const { battleInfoTitle, battleInfoBody, stageInfoActions, battleInfoOverlay, openSaveButton } = this.#elements;
    stageInfoActions.hidden = kind !== "stage";
    battleInfoBody.dataset.kind = kind;
    openSaveButton.disabled = !session.controller.isStableForSave();
    if (kind === "stage") {
      battleInfoTitle.textContent = source.title;
      let objectiveText = source.objectiveText;
      if (source.raid) {
        objectiveText = session.stage.eventManager.isCompleted(`${source.id}_raid_complete`)
          ? source.raid.escapeObjective
          : source.objectiveText.replace("<br>", `（護送部隊殲滅まで残り${Math.max(0, source.raid.turnLimit - session.stage.turn + 1)}ターン）<br>`);
      }
      battleInfoBody.textContent = `${source.description}\n\n${formatV9ObjectiveText(objectiveText)}\n制限：${source.turnLimit}ターン`;
    } else if (kind === "status") {
      battleInfoTitle.textContent = "戦況";
      battleInfoBody.textContent = session.stage.battleLog.getEntries().map((entry) => entry.text).join("\n") || "戦闘履歴はまだありません。";
    } else {
      battleInfoTitle.textContent = "戦術指南";
      renderStrategyGuide(battleInfoBody);
    }
    battleInfoOverlay.hidden = false;
    battleInfoBody.scrollTop = kind === "status" ? battleInfoBody.scrollHeight : 0;
    this.#infoFocus.activate(this.#activeInfoButton);
  }
  #listen(element, listener) { element.addEventListener("click", listener); this.#bindings.push([element, listener]); }
  #hideInfo(restoreFocus = true) {
    this.#elements.battleInfoOverlay.hidden = true;
    this.#infoFocus.deactivate({ restoreFocus });
    this.#activeInfoButton?.setAttribute("aria-expanded", "false"); this.#activeInfoButton = null;
  }
  #hideSlots(restoreFocus = true) {
    this.#elements.saveSlotOverlay.hidden = true;
    this.#slotsFocus.deactivate({ restoreFocus });
  }
  dispose() {
    this.#hideSlots(false);
    this.#hideInfo(false);
    this.#infoFocus.dispose(); this.#slotsFocus.dispose();
    this.#menu.dispose();
    for (const [element, listener] of [...this.#bindings, ...this.#battleBindings]) element.removeEventListener("click", listener);
    this.#bindings = []; this.#battleBindings = [];
  }
}
