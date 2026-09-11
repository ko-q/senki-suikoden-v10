import { invariant } from "../core/domain-error.js";

export const MANUAL_SAVE_SLOT_COUNT = 20;

export const DEFAULT_MANUAL_SLOT_IDS = Object.freeze(Array.from(
  { length: MANUAL_SAVE_SLOT_COUNT },
  (_, index) => `manual_${String(index + 1).padStart(2, "0")}`
));

const REQUIRED_ELEMENT_KEYS = Object.freeze([
  "manualSlotList",
  "newBattleButton",
  "persistenceStatus",
  "persistenceUnavailable",
  "recoveryOverlay",
  "recoverySummary",
  "refreshSlotsButton",
  "resumeRecoveryButton",
  "startNewFromRecoveryButton"
]);

const READABLE_STATUSES = new Set(["occupied", "temporary", "backup"]);
const REPAIRABLE_STATUSES = new Set(["temporary", "backup"]);

function requireElements(elements) {
  invariant(
    elements !== null && typeof elements === "object",
    "PERSISTENCE_PANEL_ELEMENTS_REQUIRED"
  );
  for (const key of REQUIRED_ELEMENT_KEYS) {
    invariant(
      elements[key] !== null && elements[key] !== undefined,
      "PERSISTENCE_PANEL_ELEMENT_MISSING",
      { key }
    );
  }
  return elements;
}

function defaultConfirm(message) {
  if (typeof globalThis.confirm !== "function") {
    return false;
  }
  return globalThis.confirm(message);
}

function slotNumber(slotId) {
  const match = /^manual_(\d+)$/.exec(slotId);
  return match === null ? slotId : String(Number(match[1]));
}

function formatSavedAt(savedAt) {
  return new Date(savedAt).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function statusLabel(status) {
  const labels = {
    occupied: "Ready",
    temporary: "Recovered temporary",
    backup: "Previous backup",
    empty: "Empty",
    corrupt: "Corrupt",
    incompatible: "Incompatible"
  };
  return labels[status] ?? status;
}

function createButton(label, className) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  return button;
}

/**
 * 20枠のSave／Load／Repairと起動時recovery選択を描画し、Gameへcallbackする。
 */
export class PersistencePanel {
  #elements;
  #confirmAction;
  #handlers;
  #staticBindings;
  #slotBindings;
  #inspections;
  #recoveryInspection;
  #available;
  #busy;
  #hasSession;
  #canSave;
  #disposed;

  constructor({ elements, confirmAction = defaultConfirm }) {
    this.#elements = requireElements(elements);
    invariant(typeof confirmAction === "function", "PERSISTENCE_CONFIRM_REQUIRED");
    this.#confirmAction = confirmAction;
    this.#handlers = null;
    this.#staticBindings = [];
    this.#slotBindings = [];
    this.#inspections = [];
    this.#recoveryInspection = null;
    this.#available = true;
    this.#busy = false;
    this.#hasSession = false;
    this.#canSave = false;
    this.#disposed = false;
  }

  bindHandlers({
    onDelete,
    onLoad,
    onNewBattle,
    onRepair,
    onRefresh,
    onResumeRecovery,
    onSave,
    onStartNewFromRecovery
  }) {
    invariant(this.#handlers === null, "PERSISTENCE_HANDLERS_ALREADY_BOUND");
    for (const handler of [
      onDelete,
      onLoad,
      onNewBattle,
      onRepair,
      onRefresh,
      onResumeRecovery,
      onSave,
      onStartNewFromRecovery
    ]) {
      invariant(typeof handler === "function", "PERSISTENCE_HANDLER_REQUIRED");
    }
    this.#handlers = {
      onDelete,
      onLoad,
      onNewBattle,
      onRepair,
      onRefresh,
      onResumeRecovery,
      onSave,
      onStartNewFromRecovery
    };
    this.#listen(this.#elements.newBattleButton, () => {
      if (this.#busy) {
        return;
      }
      if (
        this.#hasSession
        && !this.#confirmAction("Start a new battle? Current battle progress will be replaced.")
      ) {
        return;
      }
      this.#invoke(() => this.#handlers.onNewBattle());
    });
    this.#listen(this.#elements.refreshSlotsButton, () => {
      if (!this.#available || this.#busy) {
        return;
      }
      this.#invoke(() => this.#handlers.onRefresh());
    });
    this.#listen(this.#elements.resumeRecoveryButton, () => {
      if (this.#recoveryInspection === null || this.#busy) {
        return;
      }
      this.#invoke(() => this.#handlers.onResumeRecovery(
        this.#recoveryInspection.guard
      ));
    });
    this.#listen(this.#elements.startNewFromRecoveryButton, () => {
      if (this.#busy) {
        return;
      }
      this.#invoke(() => this.#handlers.onStartNewFromRecovery());
    });
  }

  setPersistenceAvailable(available) {
    this.#available = available === true;
    this.#elements.persistenceUnavailable.hidden = this.#available;
    this.#elements.refreshSlotsButton.disabled = !this.#available || this.#busy;
    this.#renderSlots();
  }

  setSessionState({ hasSession, canSave }) {
    this.#hasSession = hasSession === true;
    this.#canSave = canSave === true;
    this.#renderSlots();
  }

  setBusy(busy) {
    this.#busy = busy === true;
    this.#elements.newBattleButton.disabled = this.#busy;
    this.#elements.refreshSlotsButton.disabled = !this.#available || this.#busy;
    this.#elements.resumeRecoveryButton.disabled = this.#busy;
    this.#elements.startNewFromRecoveryButton.disabled = this.#busy;
    this.#renderSlots();
  }

  renderManualSlots(inspections) {
    invariant(Array.isArray(inspections), "PERSISTENCE_INSPECTIONS_INVALID");
    this.#inspections = [...inspections];
    this.#renderSlots();
  }

  showRecoveryPrompt(inspection) {
    invariant(
      inspection !== null
        && typeof inspection === "object"
        && READABLE_STATUSES.has(inspection.status)
        && inspection.summary !== null,
      "PERSISTENCE_RECOVERY_INSPECTION_INVALID"
    );
    this.#recoveryInspection = inspection;
    const fallback = inspection.status === "temporary"
      ? "\nA completed temporary copy will be used."
      : inspection.status === "backup"
        ? "\nThe previous valid backup will be used."
        : "";
    this.#elements.recoverySummary.textContent = [
      inspection.summary.stageId,
      `Turn ${inspection.summary.turn} · ${inspection.summary.phase}`,
      formatSavedAt(inspection.summary.savedAt)
    ].join("\n") + fallback;
    this.#elements.recoveryOverlay.hidden = false;
    this.#elements.recoveryOverlay.setAttribute("aria-hidden", "false");
  }

  hideRecoveryPrompt() {
    this.#recoveryInspection = null;
    this.#elements.recoveryOverlay.hidden = true;
    this.#elements.recoveryOverlay.setAttribute("aria-hidden", "true");
  }

  showStatus(message, tone = "info") {
    this.#elements.persistenceStatus.textContent = String(message);
    this.#elements.persistenceStatus.dataset.tone = tone;
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#clearSlotBindings();
    for (const binding of this.#staticBindings) {
      binding.element.removeEventListener(binding.type, binding.listener);
    }
    this.#staticBindings = [];
    this.#handlers = null;
    this.hideRecoveryPrompt();
  }

  #renderSlots() {
    this.#clearSlotBindings();
    this.#elements.manualSlotList.replaceChildren();
    for (const inspection of this.#inspections) {
      this.#elements.manualSlotList.append(this.#createSlotRow(inspection));
    }
  }

  #createSlotRow(inspection) {
    invariant(
      inspection !== null && typeof inspection === "object",
      "PERSISTENCE_INSPECTION_INVALID"
    );
    const row = document.createElement("article");
    row.className = "save-slot-row";
    row.dataset.status = inspection.status;
    row.setAttribute("role", "listitem");

    const heading = document.createElement("div");
    heading.className = "save-slot-heading";
    const title = document.createElement("strong");
    title.textContent = `Slot ${slotNumber(inspection.slotId)}`;
    const state = document.createElement("span");
    state.textContent = statusLabel(inspection.status);
    heading.append(title, state);

    const summary = document.createElement("p");
    summary.className = "save-slot-summary";
    summary.textContent = inspection.summary === null
      ? this.#emptySummary(inspection.status)
      : `${inspection.summary.stageId} · Turn ${inspection.summary.turn} · ${inspection.summary.phase}\n${formatSavedAt(inspection.summary.savedAt)}`;

    const actions = document.createElement("div");
    actions.className = "save-slot-actions";
    const saveButton = createButton("Save", "primary-button");
    const loadButton = createButton("Load", "secondary-button");
    const deleteButton = createButton("Delete", "danger-button");
    const repairButton = REPAIRABLE_STATUSES.has(inspection.status)
      && inspection.repairable === true
      ? createButton("Repair", "repair-button")
      : null;
    saveButton.disabled = !this.#available
      || this.#busy
      || !this.#hasSession
      || !this.#canSave
      || inspection.status === "incompatible";
    loadButton.disabled = !this.#available
      || this.#busy
      || !READABLE_STATUSES.has(inspection.status);
    deleteButton.disabled = !this.#available
      || this.#busy
      || inspection.status === "empty";
    if (repairButton !== null) {
      repairButton.disabled = !this.#available || this.#busy;
    }

    this.#listenSlot(saveButton, () => {
      if (
        inspection.status !== "empty"
        && !this.#confirmAction(`Overwrite Slot ${slotNumber(inspection.slotId)}?`)
      ) {
        return;
      }
      this.#invoke(() => this.#handlers.onSave(inspection.slotId));
    });
    this.#listenSlot(loadButton, () => {
      if (
        !this.#confirmAction(
          `Load Slot ${slotNumber(inspection.slotId)}? Current battle progress will be replaced.`
        )
      ) {
        return;
      }
      this.#invoke(() => this.#handlers.onLoad(inspection.slotId, inspection.guard));
    });
    this.#listenSlot(deleteButton, () => {
      if (!this.#confirmAction(`Delete every copy in Slot ${slotNumber(inspection.slotId)}?`)) {
        return;
      }
      this.#invoke(() => this.#handlers.onDelete(inspection.slotId, inspection.guard));
    });
    actions.append(saveButton, loadButton, deleteButton);
    if (repairButton !== null) {
      this.#listenSlot(repairButton, () => {
        const source = inspection.status === "temporary"
          ? "completed temporary copy"
          : "previous valid backup";
        if (!this.#confirmAction(
          `Repair Slot ${slotNumber(inspection.slotId)} from its ${source}?`
        )) {
          return;
        }
        this.#invoke(() => this.#handlers.onRepair(
          inspection.slotId,
          inspection.guard
        ));
      });
      actions.append(repairButton);
    }
    row.append(heading, summary, actions);
    return row;
  }

  #emptySummary(status) {
    if (status === "corrupt") {
      return "No valid copy can be loaded. This slot may be replaced or deleted.";
    }
    if (status === "incompatible") {
      return "This save belongs to an incompatible content revision.";
    }
    return "No save data.";
  }

  #listen(element, listener, type = "click") {
    element.addEventListener(type, listener);
    this.#staticBindings.push({ element, type, listener });
  }

  #listenSlot(element, listener, type = "click") {
    element.addEventListener(type, listener);
    this.#slotBindings.push({ element, type, listener });
  }

  #clearSlotBindings() {
    for (const binding of this.#slotBindings) {
      binding.element.removeEventListener(binding.type, binding.listener);
    }
    this.#slotBindings = [];
  }

  #invoke(operation) {
    try {
      const completion = operation();
      if (completion !== null && typeof completion?.catch === "function") {
        completion.catch((error) => this.showStatus(
          error?.message ?? String(error),
          "error"
        ));
      }
    } catch (error) {
      this.showStatus(error?.message ?? String(error), "error");
    }
  }
}
