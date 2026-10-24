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
import { GameResultPanel } from "../presentation/game-result-panel.js";
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
    SAVE_CONFLICT: "別のタブでセーブが変更されました。一覧を更新して再度操作してください。",
    SAVE_LOAD_EMPTY: "この枠にはセーブがありません。",
    SAVE_LOAD_INCOMPATIBLE: "このセーブは現在の版に対応していません。",
    SAVE_LOAD_CORRUPT: "この枠には読み込めるデータがありません。"
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
  #resultPanel;
  #manualSlotIds;
  #randomSeedFactory;
  #sessionHost;
  #checkpointPort;
  #audioController;
  #started;
  #disposed;
  #onRequestStageSelection;
  #onSessionChange;
  #completedSession = null;

  constructor({
    stageFactory,
    stageId,
    sessionFactory,
    saveService = null,
    persistencePanel,
    resultPanel,
    manualSlotIds = DEFAULT_MANUAL_SLOT_IDS,
    randomSeedFactory = () => BattleRandom.createSeed(),
    audioController = null,
    onRequestStageSelection = null,
    onSessionChange = () => {}
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
    invariant(resultPanel instanceof GameResultPanel, "GAME_RESULT_PANEL_REQUIRED");
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
    this.#resultPanel = resultPanel;
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
    invariant(onRequestStageSelection === null || typeof onRequestStageSelection === "function", "GAME_STAGE_SELECTION_CALLBACK_INVALID");
    invariant(typeof onSessionChange === "function", "GAME_SESSION_CALLBACK_INVALID");
    this.#onRequestStageSelection = onRequestStageSelection;
    this.#onSessionChange = onSessionChange;
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

  start({ autoStart = true } = {}) {
    invariant(!this.#started, "GAME_ALREADY_STARTED");
    invariant(!this.#disposed, "GAME_DISPOSED");
    this.#started = true;
    this.#persistencePanel.bindHandlers({
      onDelete: (slotId, guard) => this.deleteManual(slotId, guard),
      onLoad: (slotId, guard) => this.loadManual(slotId, guard),
      onNewBattle: () => this.#requestNewBattle(),
      onRepair: (slotId, guard) => this.repairManual(slotId, guard),
      onRefresh: () => this.refreshManualSlots(true),
      onResumeRecovery: (guard) => this.resumeRecovery(guard),
      onSave: (slotId) => this.saveManual(slotId),
      onStartNewFromRecovery: () => this.#requestNewBattle(),
    });
    this.#resultPanel.bindHandlers({
      onNewBattle: () => this.#requestNewBattle(),
      onNextBattle: () => this.startNextStage()
    });
    this.#persistencePanel.setPersistenceAvailable(this.#saveService !== null);
    this.refreshManualSlots(false);

    if (this.#saveService === null) {
      if (!autoStart) return Object.freeze({ status: "awaiting_stage_selection" });
      this.startNewBattle({ announce: false });
      this.#persistencePanel.showStatus(
        "ブラウザーの保存領域を利用できません。 保存せずに戦闘を続けられます。",
        "warning"
      );
      return Object.freeze({ status: "started_without_persistence" });
    }

    let recovery = null;
    try {
      recovery = this.#saveService.inspectSlot("recovery", SaveKind.RECOVERY);
    } catch (error) {
      this.#disablePersistence();
      if (!autoStart) return Object.freeze({ status: "awaiting_stage_selection" });
      this.startNewBattle({ announce: false });
      this.#persistencePanel.showStatus(
        "ブラウザーの保存領域が利用できなくなりました。 保存せずに戦闘を続けられます。",
        "warning"
      );
      return Object.freeze({ status: "started_without_persistence" });
    }
    if (READABLE_SAVE_STATUSES.has(recovery.status)) {
      this.#persistencePanel.showRecoveryPrompt(recovery);
      this.#persistencePanel.showStatus(
        "前回の中断データがあります。続きから再開するか、ステージを選び直してください。"
      );
      return Object.freeze({ status: "awaiting_recovery_choice", recovery });
    }

    if (!autoStart) return Object.freeze({ status: "awaiting_stage_selection", recovery });
    this.startNewBattle({ announce: false });
    if (recovery.status === "corrupt") {
      this.#persistencePanel.showStatus(
        "中断データが破損しているため、新しく戦闘を開始しました。",
        "warning"
      );
    } else if (recovery.status === "incompatible") {
      this.#persistencePanel.showStatus(
        "中断データがこの版に対応していないため、新しく戦闘を開始しました。",
        "warning"
      );
    } else {
      this.#persistencePanel.showStatus("戦闘を開始しました。");
    }
    return Object.freeze({ status: "started_new_battle", recovery });
  }

  #requestNewBattle() {
    this.#resultPanel.hide();
    this.#persistencePanel.hideRecoveryPrompt();
    if (this.#onRequestStageSelection !== null) return this.#onRequestStageSelection();
    return this.startNewBattle();
  }

  #nextStageId() {
    const session = this.currentSession;
    if (!session || this.#completedSession !== session || session.controller.getBattleResult()?.outcome !== "VICTORY") return null;
    const ids = this.#stageFactory.getStageIds(), index = ids.indexOf(session.stage.id);
    return index >= 0 ? ids[index + 1] ?? null : null;
  }

  startNextStage() {
    this.#requireActiveGame();
    const stageId = this.#nextStageId();
    return stageId === null ? null : this.startNewBattle({ stageId });
  }

  startNewBattle({ announce = true, stageId = this.#stageId } = {}) {
    this.#requireActiveGame();
    this.#persistencePanel.setBusy(true);
    try {
      const stage = this.#stageFactory.create(stageId);
      const battleRandom = new BattleRandom(this.#randomSeedFactory());
      const candidate = this.#sessionFactory.create(stage, battleRandom, {
        checkpointPort: this.#checkpointPort
      });
      const replacement = this.#sessionHost.replaceWithNewBattle(candidate);
      this.#completedSession = null;
      this.#stageId = stageId;
      this.#audioController.startBattleThemeForChapter(replacement.session.stage.chapterNumber);
      this.#resultPanel.hide();
      this.#persistencePanel.hideRecoveryPrompt();
      this.#updateSessionState();
      this.#observeCompletion(replacement);
      this.#onSessionChange(replacement.session);
      if (announce) {
        this.#persistencePanel.showStatus("戦闘を開始しました。");
      }
      return replacement;
    } catch (error) {
      this.#persistencePanel.showStatus(
        errorMessage(error, "戦闘を開始できませんでした。"),
        "error"
      );
      return null;
    } finally {
      this.#persistencePanel.setBusy(false);
    }
  }

  resumeRecovery(guard) {
    return this.#load("recovery", SaveKind.RECOVERY, guard, "中断データから再開しました。");
  }

  saveManual(slotId) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("ブラウザーの保存領域を利用できません。", "error");
      return null;
    }
    requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID");
    const session = this.#sessionHost.currentSession;
    if (session === null || !session.controller.isStableForSave()) {
      this.#persistencePanel.showStatus(
        "行動処理が終わってからセーブしてください。",
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
            ? "別のタブでセーブが変更されました。一覧を更新して再度操作してください。"
            : "セーブできませんでした。",
          "error"
        );
        return result;
      }
      this.refreshManualSlots(false);
      this.#persistencePanel.showStatus(`セーブしました。`);
      return result;
    } catch (error) {
      this.#persistencePanel.showStatus(
        errorMessage(error, "セーブできませんでした。"),
        "error"
      );
      return null;
    }
  }

  loadManual(slotId, guard) {
    requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID");
    return this.#load(slotId, SaveKind.MANUAL, guard, `ロードしました。`);
  }

  deleteManual(slotId, guard) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("ブラウザーの保存領域を利用できません。", "error");
      return null;
    }
    requireIdentifier(slotId, "GAME_MANUAL_SLOT_ID_INVALID");
    let result = null;
    try {
      result = this.#saveService.deleteSlot({ slotId, guard });
    } catch (error) {
      this.#persistencePanel.showStatus("セーブを削除できませんでした。", "error");
      return null;
    }
    if (!result.ok) {
      this.#persistencePanel.showStatus(
        result.status === "conflict"
          ? "別のタブでセーブが変更されました。一覧を更新して再度操作してください。"
          : "セーブを削除できませんでした。",
        "error"
      );
      return result;
    }
    this.refreshManualSlots(false);
    this.#persistencePanel.showStatus(`セーブを削除しました。`);
    return result;
  }

  repairManual(slotId, guard) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("ブラウザーの保存領域を利用できません。", "error");
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
      this.#persistencePanel.showStatus("セーブを修復できませんでした。", "error");
      return null;
    }
    if (!result.ok) {
      const messages = {
        conflict: "別のタブでセーブが変更されました。一覧を更新して再度操作してください。",
        not_required: "セーブは正常です。",
        protected: "対応していない新しい版のセーブを保護しました。上書き修復はできません。",
        unavailable: "修復に使える正常なデータがありません。"
      };
      this.#persistencePanel.showStatus(
        messages[result.status] ?? "セーブを修復できませんでした。",
        result.status === "not_required" ? "info" : "error"
      );
      return result;
    }
    this.refreshManualSlots(false);
    const source = result.source === "temporary" ? "temporary copy" : "backup";
    this.#persistencePanel.showStatus(`セーブを修復しました。`);
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
            "ブラウザーの保存領域が利用できなくなりました。 保存せずに戦闘を続けられます。",
            "warning"
          );
        }
      }
    }
    this.#persistencePanel.renderManualSlots(inspections);
    this.#updateSessionState();
    if (announce) {
      this.#persistencePanel.showStatus("セーブ一覧を更新しました。");
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
        "別のタブでセーブが変更されました。一覧を更新してから操作してください。",
        "warning"
      );
    }
    return affected;
  }

  unlockAudio() {
    invariant(!this.#disposed, "GAME_DISPOSED");
    return this.#audioController.unlock();
  }

  toggleAudio() {
    invariant(!this.#disposed, "GAME_DISPOSED");
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
    this.#resultPanel.dispose();
  }

  #load(slotId, saveKind, guard, successMessage) {
    this.#requireActiveGame();
    if (this.#saveService === null) {
      this.#persistencePanel.showStatus("ブラウザーの保存領域を利用できません。", "error");
      return null;
    }
    this.#persistencePanel.setBusy(true);
    try {
      const prepared = this.#saveService.prepareLoad({ slotId, saveKind, guard });
      const replacement = this.#sessionHost.replaceWithPreparedLoad(prepared);
      this.#stageId = replacement.session.stage.id;
      this.#audioController.startBattleThemeForChapter(replacement.session.stage.chapterNumber);
      this.#resultPanel.hide();
      this.#persistencePanel.hideRecoveryPrompt();
      this.#updateSessionState();
      this.#observeCompletion(replacement);
      this.#persistencePanel.showStatus(successMessage);
      this.#onSessionChange(replacement.session);
      return replacement;
    } catch (error) {
      if (error?.code === "SAVE_CONFLICT" && saveKind === SaveKind.RECOVERY) {
        const refreshed = this.#saveService.inspectSlot("recovery", SaveKind.RECOVERY);
        if (READABLE_SAVE_STATUSES.has(refreshed.status)) {
          this.#persistencePanel.showRecoveryPrompt(refreshed);
          this.#persistencePanel.showStatus(
            "別のタブで中断データが変更されました。更新した内容を確認して選び直してください。",
            "warning"
          );
          return null;
        }
        this.#persistencePanel.hideRecoveryPrompt();
        this.#persistencePanel.showStatus(
          "中断データが変更され、読み込めなくなりました。ステージを選び直してください。",
          "warning"
        );
        return null;
      }
      this.#persistencePanel.showStatus(
        errorMessage(error, "ロードできませんでした。現在の戦闘は保持されています。"),
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
            "中断データを保存できませんでした。戦闘は続けられます。",
            "warning"
          );
        }
      }).catch(() => {
        if (!this.#disposed) {
          this.#persistencePanel.showStatus(
            "中断データを保存できませんでした。戦闘は続けられます。",
            "warning"
          );
        }
      });
    }
  }

  #observeCompletion(replacement) {
    const { session, completion } = replacement;
    if (completion === null || typeof completion?.then !== "function") {
      return;
    }
    completion.then((result) => {
      if (this.#disposed || this.#sessionHost.currentSession !== session) {
        return;
      }
      this.#updateSessionState();
      this.#completedSession = session;
      this.#resultPanel.show({
        result,
        stageTitle: session.stage.titleKey,
        hasNextStage: this.#nextStageId() !== null
      });
    }).catch((error) => {
      if (error?.name !== "AbortError" && !this.#disposed) {
        this.#persistencePanel.showStatus(
          "戦闘結果の処理を完了できませんでした。",
          "error"
        );
      }
    });
  }

  #updateSessionState() {
    const session = this.#sessionHost.currentSession;
    if (this.#completedSession !== session) this.#completedSession = null;
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
