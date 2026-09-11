import test from "node:test";
import assert from "node:assert/strict";

import { AudioThemeId } from "../src/audio/audio-cue.js";
import { BattleFlowState } from "../src/core/battle-flow-state.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { PresentationRequestType } from "../src/core/presentation-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { CharacterManager } from "../src/domain/character.js";
import { StagePhase } from "../src/domain/stage.js";
import { DEVELOPMENT_STAGE_DEFINITION } from "../src/definitions/development-stage.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { BattleSessionFactory } from "../src/orchestration/battle-session-factory.js";
import { Game } from "../src/orchestration/game.js";
import { SaveKind } from "../src/persistence/save-codec.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { BattleViewFactory } from "../src/presentation/battle-view.js";
import { PersistencePanel } from "../src/presentation/persistence-panel.js";
import { SaveService } from "../src/services/save-service.js";
import {
  FakeElement,
  createFakeBattleViewTemplate,
  createFakePersistenceElements,
  installFakeDocument
} from "../test-support/fake-battle-dom.js";
import { MemoryStorage } from "../test-support/memory-storage.js";

const ZERO_EFFECT_DURATIONS = Object.freeze(Object.fromEntries(
  Object.values(PresentationRequestType)
    .filter((type) => type !== PresentationRequestType.DIALOGUE)
    .map((type) => [type, 0])
));

function createStageFactory() {
  return new StageFactory({
    definitions: [DEVELOPMENT_STAGE_DEFINITION],
    characterManager: new CharacterManager([]),
    terrainCatalog: createV9CompatibleTerrainCatalog()
  });
}

function createGameRuntime({ storage = new MemoryStorage(), persistence = true } = {}) {
  const stageFactory = createStageFactory();
  const battleHost = new FakeElement();
  const { template, createdViews } = createFakeBattleViewTemplate();
  const panelElements = createFakePersistenceElements();
  const viewFactory = new BattleViewFactory({ host: battleHost, template });
  const sessionFactory = new BattleSessionFactory({
    viewFactory,
    effectDurations: ZERO_EFFECT_DURATIONS
  });
  const saveService = persistence
    ? new SaveService({
      repository: new SaveRepository({ storage, clock: () => 1000 }),
      stageFactory,
      writerId: "game_test_writer",
      clock: () => 1000
    })
    : null;
  const panel = new PersistencePanel({
    elements: panelElements,
    confirmAction: () => true
  });
  const game = new Game({
    stageFactory,
    stageId: DEVELOPMENT_STAGE_DEFINITION.id,
    sessionFactory,
    saveService,
    persistencePanel: panel,
    randomSeedFactory: () => 1
  });
  return {
    audioController: sessionFactory.audioController,
    battleHost,
    createdViews,
    game,
    panelElements,
    saveService,
    stageFactory,
    storage
  };
}

test("Game queues the chapter battle theme and owns AudioController disposal", () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime({ persistence: false });
  try {
    assert.equal(runtime.game.start().status, "started_without_persistence");
    assert.equal(
      runtime.audioController.queuedThemeId,
      AudioThemeId.BATTLE_GENERATED_FIXED
    );
    assert.equal(runtime.audioController.isUnlocked, false);
  } finally {
    runtime.game.dispose();
    assert.equal(runtime.audioController.isDisposed, true);
    restoreDocument();
  }
});

function createRecoveryBattle(stageFactory) {
  const stage = stageFactory.create(DEVELOPMENT_STAGE_DEFINITION.id);
  stage.setTurnAndPhase(3, StagePhase.PLAYER);
  stage.getUnit("preview_player").setReadyForPhase(true);
  stage.getUnit("preview_enemy").setReadyForPhase(false);
  stage.getUnit("preview_reserve").setReadyForPhase(false);
  return createBattleSaveData(stage, new BattleRandom(17));
}

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 2));
  }
  throw new Error(`WAIT_TIMEOUT_${label}`);
}

test("Game waits for an explicit recovery choice and resumes without replaying intro", async () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime();
  try {
    const saved = runtime.saveService.saveBattle({
      slotId: "recovery",
      saveKind: SaveKind.RECOVERY,
      battle: createRecoveryBattle(runtime.stageFactory)
    });
    assert.equal(saved.ok, true);

    const startup = runtime.game.start();
    assert.equal(startup.status, "awaiting_recovery_choice");
    assert.equal(runtime.game.currentSession, null);
    assert.equal(runtime.createdViews.length, 0);
    assert.equal(runtime.panelElements.recoveryOverlay.hidden, false);

    runtime.panelElements.resumeRecoveryButton.dispatch("click");
    await waitUntil(
      () => runtime.game.currentSession?.controller.flowState === BattleFlowState.IDLE,
      "RECOVERY_RESUMED"
    );
    assert.equal(runtime.createdViews.length, 1);
    assert.equal(runtime.battleHost.children[0], runtime.createdViews[0].root);
    assert.equal(runtime.game.currentSession.stage.turn, 3);
    assert.equal(runtime.panelElements.recoveryOverlay.hidden, true);
    assert.equal(runtime.createdViews[0].elements.dialogueOverlay.hidden, true);
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game honors Start new battle without restoring the offered recovery", () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime();
  try {
    runtime.saveService.saveBattle({
      slotId: "recovery",
      saveKind: SaveKind.RECOVERY,
      battle: createRecoveryBattle(runtime.stageFactory)
    });
    assert.equal(runtime.game.start().status, "awaiting_recovery_choice");

    runtime.panelElements.startNewFromRecoveryButton.dispatch("click");
    assert.notEqual(runtime.game.currentSession, null);
    assert.equal(runtime.game.currentSession.stage.turn, 1);
    assert.equal(runtime.createdViews[0].elements.dialogueOverlay.hidden, false);
    assert.equal(runtime.panelElements.recoveryOverlay.hidden, true);
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game offers and resumes a valid temporary recovery candidate", async () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime();
  try {
    runtime.saveService.saveBattle({
      slotId: "recovery",
      saveKind: SaveKind.RECOVERY,
      battle: createRecoveryBattle(runtime.stageFactory)
    });
    const keys = new SaveRepository({ storage: runtime.storage }).slotKeys("recovery");
    runtime.storage.setItem(keys.temporary, runtime.storage.getItem(keys.primary));
    runtime.storage.removeItem(keys.primary);

    const startup = runtime.game.start();
    assert.equal(startup.status, "awaiting_recovery_choice");
    assert.equal(startup.recovery.status, "temporary");
    assert.match(runtime.panelElements.recoverySummary.textContent, /temporary copy/);
    runtime.panelElements.resumeRecoveryButton.dispatch("click");
    await waitUntil(
      () => runtime.game.currentSession?.controller.flowState === BattleFlowState.IDLE,
      "TEMPORARY_RECOVERY_RESUMED"
    );
    assert.equal(runtime.game.currentSession.stage.turn, 3);
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game starts a fresh battle when every recovery generation is corrupt", () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime();
  try {
    const keys = new SaveRepository({ storage: runtime.storage }).slotKeys("recovery");
    runtime.storage.setItem(keys.primary, "{broken");
    const startup = runtime.game.start();

    assert.equal(startup.status, "started_new_battle");
    assert.notEqual(runtime.game.currentSession, null);
    assert.equal(runtime.createdViews.length, 1);
    assert.equal(runtime.panelElements.recoveryOverlay.hidden, true);
    assert.match(runtime.panelElements.persistenceStatus.textContent, /corrupt/);
    assert.equal(runtime.panelElements.persistenceStatus.dataset.tone, "warning");
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game refreshes a changed recovery guard before the user retries Resume", async () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime();
  try {
    const battle = createRecoveryBattle(runtime.stageFactory);
    runtime.saveService.saveBattle({
      slotId: "recovery",
      saveKind: SaveKind.RECOVERY,
      battle
    });
    assert.equal(runtime.game.start().status, "awaiting_recovery_choice");

    const externalService = new SaveService({
      repository: new SaveRepository({ storage: runtime.storage, clock: () => 2000 }),
      stageFactory: runtime.stageFactory,
      writerId: "external_writer",
      clock: () => 2000
    });
    externalService.inspectSlot("recovery", SaveKind.RECOVERY);
    assert.equal(externalService.saveBattle({
      slotId: "recovery",
      saveKind: SaveKind.RECOVERY,
      battle
    }).ok, true);

    runtime.panelElements.resumeRecoveryButton.dispatch("click");
    assert.equal(runtime.game.currentSession, null);
    assert.equal(runtime.panelElements.recoveryOverlay.hidden, false);
    assert.match(runtime.panelElements.persistenceStatus.textContent, /summary was refreshed/);

    runtime.panelElements.resumeRecoveryButton.dispatch("click");
    await waitUntil(
      () => runtime.game.currentSession?.controller.flowState === BattleFlowState.IDLE,
      "REFRESHED_RECOVERY_RESUMED"
    );
    assert.equal(runtime.createdViews.length, 1);
    assert.equal(runtime.panelElements.recoveryOverlay.hidden, true);
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game keeps the current session when a selected manual slot changes before Load", async () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime();
  try {
    runtime.game.start();
    const view = runtime.createdViews[0];
    view.elements.dialogueNextButton.dispatch("click");
    await waitUntil(
      () => runtime.game.currentSession.controller.isStableForSave(),
      "NEW_BATTLE_STABLE"
    );
    assert.equal(runtime.game.saveManual("manual_01").ok, true);
    const selected = runtime.game.refreshManualSlots(false)[0];
    const sessionBefore = runtime.game.currentSession;
    const rootBefore = runtime.battleHost.children[0];
    const keys = new SaveRepository({ storage: runtime.storage }).slotKeys("manual_01");
    runtime.storage.setItem(keys.primary, "externally-changed");

    assert.equal(runtime.game.loadManual("manual_01", selected.guard), null);
    assert.equal(runtime.game.currentSession, sessionBefore);
    assert.equal(runtime.battleHost.children[0], rootBefore);
    assert.equal(sessionBefore.isDisposed, false);
    assert.match(runtime.panelElements.persistenceStatus.textContent, /another tab/);
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game repairs a manual backup without replacing the current battle session", async () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime();
  try {
    runtime.game.start();
    runtime.createdViews[0].elements.dialogueNextButton.dispatch("click");
    await waitUntil(
      () => runtime.game.currentSession.controller.isStableForSave(),
      "REPAIR_BATTLE_STABLE"
    );
    assert.equal(runtime.game.saveManual("manual_01").ok, true);
    assert.equal(runtime.game.saveManual("manual_01").ok, true);
    const keys = new SaveRepository({ storage: runtime.storage }).slotKeys("manual_01");
    const backupRaw = runtime.storage.getItem(keys.backup);
    runtime.storage.setItem(keys.primary, "broken-primary");
    const selected = runtime.game.refreshManualSlots(false)[0];
    const sessionBefore = runtime.game.currentSession;
    const rootBefore = runtime.battleHost.children[0];

    assert.equal(selected.status, "backup");
    const repaired = runtime.game.repairManual("manual_01", selected.guard);
    assert.equal(repaired.ok, true);
    assert.equal(repaired.source, "backup");
    assert.equal(runtime.storage.getItem(keys.primary), backupRaw);
    assert.equal(runtime.game.currentSession, sessionBefore);
    assert.equal(runtime.battleHost.children[0], rootBefore);
    assert.equal(runtime.createdViews.length, 1);
    assert.equal(runtime.game.refreshManualSlots(false)[0].status, "occupied");
    assert.match(runtime.panelElements.persistenceStatus.textContent, /Repaired/);
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game runs without storage while keeping every slot action disabled", () => {
  const restoreDocument = installFakeDocument();
  const runtime = createGameRuntime({ persistence: false });
  try {
    const startup = runtime.game.start();
    assert.equal(startup.status, "started_without_persistence");
    assert.notEqual(runtime.game.currentSession, null);
    assert.equal(runtime.panelElements.persistenceUnavailable.hidden, false);
    for (const row of runtime.panelElements.manualSlotList.children) {
      assert.equal(row.children[2].children.every((button) => button.disabled), true);
    }
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});

test("Game degrades to a no-save battle when storage reads fail during startup", () => {
  const restoreDocument = installFakeDocument();
  class ThrowingReadStorage extends MemoryStorage {
    getItem() {
      throw new Error("TEST_STORAGE_READ_FAILED");
    }
  }
  const runtime = createGameRuntime({ storage: new ThrowingReadStorage() });
  try {
    const startup = runtime.game.start();
    assert.equal(startup.status, "started_without_persistence");
    assert.notEqual(runtime.game.currentSession, null);
    assert.equal(runtime.panelElements.persistenceUnavailable.hidden, false);
    assert.match(runtime.panelElements.persistenceStatus.textContent, /unavailable/);
  } finally {
    runtime.game.dispose();
    restoreDocument();
  }
});
