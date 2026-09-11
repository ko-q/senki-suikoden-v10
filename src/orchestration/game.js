import { NullBattleCheckpointPort } from "../boundary/battle-ports.js";
import { AudioController } from "../audio/audio-controller.js";
import { invariant, requireIdentifier } from "../core/domain-error.js";
import { BattleRandom } from "../domain/battle-random.js";
import { StageFactory } from "../factories/stage-factory.js";
import { SaveKind } from "../persistence/save-codec.js";
import {
  DEFAULT_MANUAL_SLOT_IDS,
  PersistencePanel
} from "../presentation/persistence-panel.js";
import { SaveCheckpointAdapter, SaveService } from "../services/save-service.js";
import { BattleSessionFactory } from "./battle-session-factory.js";
import { BattleSessionHost } from "./battle-session-host.js";

const READABLE_SAVE_STATUSES = new Set(["occupied", "temporary", "backup"]);

function emptyInspection(slotId) {
  return Object.freeze({
    slotId,
    status: "empty",
    source: null,
    repairable: false,
    summary: null,
    guard: null
  });
}

function errorMessage(error, fallback) {
  const messages = {
    SAVE_CONFLICT: "Save data changed in another tab. Refresh the slots and try again.",
    SAVE_LOAD_EMPTY: "This slot is empty.",
    SAVE_LOAD_INCOMPATIBLE: "This save is not compatible with the current content revision.",
    SAVE_LOAD_CORRUPT: "No valid copy could be loaded from this slot."
  };
  return messages[error?.code] ?? fallback;
}

/**
 * 起動、BattleSession交換、手動Save／Load／Repairを一つのlifecycleとして統括する。
 */
export class Game {
  #stageFactory;
  #stageId;
  #sessionFactory;
  #saveService;
  #persistencePanel;
  #manualSlotIds;
  #randomSeedFactory;
  #sessionHost;
  #checkpointPort;
  #audioController;
  #started;
  #disposed;

  constructor({
    stageFactory,
    stageId,
    sessionFactory,
    saveService = null,
    persistencePanel,
    manualSlotIds = DEFAULT_MANUAL_SLOT_IDS,
    randomSeedFactory = () => BattleRandom.createSeed(),
    audioController = null
  }) {
    invariant(stageFactory instanceof StageFactory, "GAME_STAGE_FACTORY_REQUIRED");
    requireIdentifier(stageId, "GAME_STAGE_ID_INVALID");
    invariant(
      sessionFactory instanceof BattleSessionFactory,
      "GAME_SESSION_FACTORY_REQUIRED"
    );
    invariant(
      saveService === null || saveService instanceof SaveService,
      "GAME_SAVE_SERVICE_INVALID"
    );
    invariant(
      persistencePanel instanceof PersistencePanel,
      "GAME_PERSISTENCE_PANEL_REQUIRED"
    );
    invariant(Array.isArray(manualSlotIds), "GAME_MANUAL_SLOT_IDS_INVALID");
    invariant(manualSlotIds.length > 0, "GAME_MANUAL_SLOT_IDS_EMPTY");
    const normalizedSlotIds = manualSlotIds.map((slotId) => (
      requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID")
    ));
    invariant(
      new Set(normalizedSlotIds).size === normalizedSlotIds.length,
      "GAME_MANUAL_SLOT_ID_DUPLICATE"
    );
    invariant(typeof randomSeedFactory === "function", "GAME_RANDOM_FACTORY_REQUIRED");
    const resolvedAudioController = audioController ?? sessionFactory.audioController;
    invariant(resolvedAudioController instanceof AudioController, "GAME_AUDIO_CONTROLLER_REQUIRED");
    invariant(
      resolvedAudioController === sessionFactory.audioController,
      "GAME_AUDIO_CONTROLLER_MISMATCH"
    );
    this.#stageFactory = stageFactory;
    this.#stageId = stageId;
    this.#sessionFactory = sessionFactory;
    this.#saveService = saveService;
    this.#persistencePanel = persistencePanel;
    this.#manualSlotIds = Object.freeze(normalizedSlotIds);
    this.#randomSeedFactory = randomSeedFactory;
    this.#audioController = resolvedAudioController;
    this.#checkpointPort = saveService === null
      ? new NullBattleCheckpointPort()
      : new SaveCheckpointAdapter(saveService, {
        onCheckpoint: (snapshot, completion) => {
          this.#handleStableCheckpoint(snapshot, completion);
        }
      });
    this.#sessionHost = new BattleSessionHost({
      currentSession: null,
      createLoadedSession: (prepared) => this.#sessionFactory.createLoaded(
        prepared,
        { checkpointPort: this.#checkpointPort }
      )
    });
    this.#started = false;
    this.#disposed = false;
  }

  get currentSession() {
    return this.#sessionHost.currentSession;
  }

  get isAudioEnabled() {
    return this.#audioController.isEnabled;
  }

  get isAudioUnlocked() {
    return this.#audioController.isUnlocked;
  }

  start() {
    invariant(!this.#started, "GAME_ALREADY_STARTED");
    invariant(!this.#disposed, "GAME_DISPOSED");
    this.#started = true;
    this.#persistencePanel.bindHandlers({
      onDelete: (slotId, guard) => this.deleteManual(slotId, guard),
      onLoad: (slotId, guard) => this.loadManual(slotId, guard),
      onNewBattle: () => this.startNewBattle(),
      onRepair: (slotId, guard) => this.repairManual(slotId, guard),
      onRefresh: () => this.refreshManualSlots(true),
      onResumeRecovery: (guard) => this.resumeRecovery(guard),
      onSave: (slotId) => this.saveManual(slotId),
      onStartNewFromRecovery: () => this.startNewBattle(),
    });
    this.#persistencePanel.setPersistenceAvailable(this.#saveService !== null);
    this.refreshManualSlots(false);

    if (this.#saveService === null) {
      this.startNewBattle({ announce: false });
      this.#persistencePanel.showStatus(
        "Browser storage is unavailable. The battle can continue without saving.",
        "warning"
      );
      return Object.freeze({ status: "started_without_persistence" });
    }

    let recovery = null;
    try {
      recovery = this.#saveService.inspectSlot("recovery", SaveKind.RECOVERY);
    } catch (error) {
      this.#disablePersistence();
      this.startNewBattle({ announce: false });
      this.#persistencePanel.showStatus(
        "Browser storage became unavailable. The battle can continue without saving.",
        "warning"
      );
      return Object.freeze({ status: "started_without_persistence" });
    }
    if (READABLE_SAVE_STATUSES.has(recovery.status)) {
      this.#persistencePanel.showRecoveryPrompt(recovery);
      this.#persistencePanel.showStatus(
        "Recovery data was found. Choose Resume or Start new battle."
      );
      return Object.freeze({ status: "awaiting_recovery_choice", recovery });
    }

    this.startNewBattle({ announce: false });
    if (recovery.status === "corrupt") {
      this.#persistencePanel.showStatus(
        "Recovery data is corrupt. A new development battle was started.",
        "warning"
      );
    } else if (recovery.status === "incompatible") {
      this.#persistencePanel.showStatus(
        "Recovery data is incompatible. A new development battle was started.",
        "warning"
      );
    } else {
      this.#persistencePanel.showStatus("New development battle started.");
    }
    return Object.freeze({ status: "started_new_battle", recovery });
  }

  startNewBattle({ announce = true } = {}) {
    this.#requireActiveGame();
    this.#persistencePanel.setBusy(true);
    try {
      const stage = this.#stageFactory.create(this.#stageId);
      const battleRandom = new BattleRandom(this.#randomSeedFactory());
      const candidate = this.#sessionFactory.create(stage, battleRandom, {
        checkpointPort: this.#checkpointPort
      });
      const replacement = this.#sessionHost.replaceWithNewBattle(candidate);
      this.#audioController.startBattleThemeForChapter(replacement.session.stage.chapterNumber);
      this.#persistencePanel.hideRecoveryPrompt();
      this.#updateSessionState();
      if (announce) {
        this.#persistencePanel.showStatus("New development battle started.");
      }
      return replacement;
    } catch (error) {
      this.#persistencePanel.showStatus(
        errorMessage(error, "The new battle could not be started."),
        "error"
      );
      return null;
    } finally {
      this.#persistencePanel.setBusy(false);
    }
  }

  resumeRecovery(guard) {
    return this.#load("recovery", SaveKind.RECOVERY, guard, "Recovery battle loaded.");
  }

  saveManual(slotId) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("Browser storage is unavailable.", "error");
      return null;
    }
    requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID");
    const session = this.#sessionHost.currentSession;
    if (session === null || !session.controller.isStableForSave()) {
      this.#persistencePanel.showStatus(
        "Manual save is available only at a stable battle state.",
        "warning"
      );
      this.#updateSessionState();
      return null;
    }

    try {
      const result = this.#saveService.saveBattle({
        slotId,
        saveKind: SaveKind.MANUAL,
        battle: session.controller.createSaveSnapshot()
      });
      if (!result.ok) {
        this.#persistencePanel.showStatus(
          result.status === "conflict"
            ? "Save data changed in another tab. Refresh the slots and try again."
            : "The manual save could not be written.",
          "error"
        );
        return result;
      }
      this.refreshManualSlots(false);
      this.#persistencePanel.showStatus(`Saved ${slotId}.`);
      return result;
    } catch (error) {
      this.#persistencePanel.showStatus(
        errorMessage(error, "The manual save could not be written."),
        "error"
      );
      return null;
    }
  }

  loadManual(slotId, guard) {
    requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID");
    return this.#load(slotId, SaveKind.MANUAL, guard, `Loaded ${slotId}.`);
  }

  deleteManual(slotId, guard) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("Browser storage is unavailable.", "error");
      return null;
    }
    requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID");
    let result = null;
    try {
      result = this.#saveService.deleteSlot({ slotId, guard });
    } catch (error) {
      this.#persistencePanel.showStatus("The slot could not be deleted.", "error");
      return null;
    }
    if (!result.ok) {
      this.#persistencePanel.showStatus(
        result.status === "conflict"
          ? "Save data changed in another tab. Refresh the slots and try again."
          : "The slot could not be deleted.",
        "error"
      );
      return result;
    }
    this.refreshManualSlots(false);
    this.#persistencePanel.showStatus(`Deleted ${slotId}.`);
    return result;
  }

  repairManual(slotId, guard) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("Browser storage is unavailable.", "error");
      return null;
    }
    requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID");
    let result = null;
    try {
      result = this.#saveService.repairSlot({
        slotId,
        saveKind: SaveKind.MANUAL,
        guard
      });
    } catch (error) {
      this.#persistencePanel.showStatus("The slot could not be repaired.", "error");
      return null;
    }
    if (!result.ok) {
      const messages = {
        conflict: "Save data changed in another tab. Refresh the slots and try again.",
        not_required: "The primary save is already valid.",
        protected: "A newer incompatible save generation was preserved and cannot be repaired over.",
        unavailable: "No valid fallback copy is available for repair."
      };
      this.#persistencePanel.showStatus(
        messages[result.status] ?? "The slot could not be repaired.",
        result.status === "not_required" ? "info" : "error"
      );
      return result;
    }
    this.refreshManualSlots(false);
    const source = result.source === "temporary" ? "temporary copy" : "backup";
    this.#persistencePanel.showStatus(`Repaired ${slotId} from its ${source}.`);
    return result;
  }

  refreshManualSlots(announce = true) {
    this.#requireActiveGame();
    let inspections = this.#manualSlotIds.map((slotId) => emptyInspection(slotId));
    if (this.#saveService !== null) {
      try {
        inspections = this.#saveService.inspectSlots(this.#manualSlotIds.map((slotId) => ({
          slotId,
          saveKind: SaveKind.MANUAL
        })));
      } catch (error) {
        this.#disablePersistence();
        if (announce) {
          this.#persistencePanel.showStatus(
            "Browser storage became unavailable. The battle can continue without saving.",
            "warning"
          );
        }
      }
    }
    this.#persistencePanel.renderManualSlots(inspections);
    this.#updateSessionState();
    if (announce) {
      this.#persistencePanel.showStatus("Save slots refreshed.");
    }
    return inspections;
  }

  handleStorageEvent(event) {
    if (this.#saveService === null || this.#disposed) {
      return false;
    }
    const affected = this.#saveService.handleStorageEvent(event);
    if (affected) {
      this.#persistencePanel.showStatus(
        "Save data changed in another tab. Refresh before saving, loading, repairing, or deleting.",
        "warning"
      );
    }
    return affected;
  }

  unlockAudio() {
    this.#requireActiveGame();
    return this.#audioController.unlock();
  }

  toggleAudio() {
    this.#requireActiveGame();
    return this.#audioController.toggleEnabled();
  }

  suspendAudio() {
    if (this.#disposed) {
      return Promise.resolve(false);
    }
    return this.#audioController.suspendForBackground();
  }

  resumeAudio() {
    if (this.#disposed) {
      return Promise.resolve(false);
    }
    return this.#audioController.resumeFromBackground();
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#sessionHost.dispose();
    this.#audioController.dispose();
    this.#persistencePanel.dispose();
  }

  #load(slotId, saveKind, guard, successMessage) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("Browser storage is unavailable.", "error");
      return null;
    }
    this.#persistencePanel.setBusy(true);
    try {
      const prepared = this.#saveService.prepareLoad({ slotId, saveKind, guard });
      const replacement = this.#sessionHost.replaceWithPreparedLoad(prepared);
      this.#audioController.startBattleThemeForChapter(replacement.session.stage.chapterNumber);
      this.#persistencePanel.hideRecoveryPrompt();
      this.#updateSessionState();
      this.#persistencePanel.showStatus(successMessage);
      return replacement;
    } catch (error) {
      if (error?.code === "SAVE_CONFLICT" && saveKind === SaveKind.RECOVERY) {
        const refreshed = this.#saveService.inspectSlot("recovery", SaveKind.RECOVERY);
        if (READABLE_SAVE_STATUSES.has(refreshed.status)) {
          this.#persistencePanel.showRecoveryPrompt(refreshed);
          this.#persistencePanel.showStatus(
            "Recovery data changed in another tab. The summary was refreshed; review it and choose again.",
            "warning"
          );
          return null;
        }
        this.#persistencePanel.hideRecoveryPrompt();
        this.#persistencePanel.showStatus(
          "Recovery data changed and is no longer loadable. Start a new battle.",
          "warning"
        );
        return null;
      }
      this.#persistencePanel.showStatus(
        errorMessage(error, "The save could not be loaded. The current battle is unchanged."),
        "error"
      );
      return null;
    } finally {
      this.#persistencePanel.setBusy(false);
    }
  }

  #handleStableCheckpoint(snapshot, completion) {
    if (this.#disposed) {
      return;
    }
    invariant(snapshot !== null && typeof snapshot === "object", "GAME_CHECKPOINT_INVALID");
    this.#updateSessionState();
    if (completion !== null && typeof completion?.then === "function") {
      completion.then((saveResult) => {
        if (!this.#disposed && saveResult?.ok === false) {
          this.#persistencePanel.showStatus(
            "Recovery save could not be updated. The battle can continue.",
            "warning"
          );
        }
      }).catch(() => {
        if (!this.#disposed) {
          this.#persistencePanel.showStatus(
            "Recovery save could not be updated. The battle can continue.",
            "warning"
          );
        }
      });
    }
  }

  #updateSessionState() {
    const session = this.#sessionHost.currentSession;
    this.#persistencePanel.setSessionState({
      hasSession: session !== null,
      canSave: session !== null && session.controller.isStableForSave()
    });
  }

  #disablePersistence() {
    this.#saveService = null;
    this.#checkpointPort = new NullBattleCheckpointPort();
    this.#persistencePanel.setPersistenceAvailable(false);
    this.#persistencePanel.renderManualSlots(
      this.#manualSlotIds.map((slotId) => emptyInspection(slotId))
    );
    this.#updateSessionState();
  }

  #requireActiveGame() {
    invariant(this.#started, "GAME_NOT_STARTED");
    invariant(!this.#disposed, "GAME_DISPOSED");
  }
}
