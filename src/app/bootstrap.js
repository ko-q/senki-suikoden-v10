import {
  AudioController,
  BattleSessionFactory,
  BattleViewFactory,
  CharacterManager,
  DEVELOPMENT_STAGE_DEFINITION,
  Game,
  PersistencePanel,
  SaveRepository,
  SaveService,
  StageFactory,
  createV9CompatibleTerrainCatalog
} from "../index.js";

const audioButton = document.querySelector("#audioButton");

const persistenceElements = {
  manualSlotList: document.querySelector("#manualSlotList"),
  newBattleButton: document.querySelector("#newBattleButton"),
  persistenceStatus: document.querySelector("#persistenceStatus"),
  persistenceUnavailable: document.querySelector("#persistenceUnavailable"),
  recoveryOverlay: document.querySelector("#recoveryOverlay"),
  recoverySummary: document.querySelector("#recoverySummary"),
  refreshSlotsButton: document.querySelector("#refreshSlotsButton"),
  resumeRecoveryButton: document.querySelector("#resumeRecoveryButton"),
  startNewFromRecoveryButton: document.querySelector("#startNewFromRecoveryButton")
};

const stageFactory = new StageFactory({
  definitions: [DEVELOPMENT_STAGE_DEFINITION],
  characterManager: new CharacterManager([]),
  terrainCatalog: createV9CompatibleTerrainCatalog()
});
const viewFactory = new BattleViewFactory({
  host: document.querySelector("#battleHost"),
  template: document.querySelector("#battleViewTemplate")
});
const audioController = new AudioController();
const sessionFactory = new BattleSessionFactory({ viewFactory, audioController });
const persistencePanel = new PersistencePanel({ elements: persistenceElements });

let saveService = null;
try {
  if (globalThis.localStorage !== undefined) {
    saveService = new SaveService({
      repository: new SaveRepository({ storage: globalThis.localStorage }),
      stageFactory
    });
  }
} catch (error) {
  saveService = null;
}

const game = new Game({
  stageFactory,
  stageId: DEVELOPMENT_STAGE_DEFINITION.id,
  sessionFactory,
  saveService,
  persistencePanel,
  audioController
});
game.start();

function renderAudioButton() {
  if (!game.isAudioUnlocked) {
    audioButton.textContent = "Sound: Start";
    audioButton.setAttribute("aria-pressed", "false");
    return;
  }
  audioButton.textContent = game.isAudioEnabled ? "Sound: ON" : "Sound: OFF";
  audioButton.setAttribute("aria-pressed", game.isAudioEnabled ? "true" : "false");
}

audioButton.addEventListener("click", async () => {
  if (!game.isAudioUnlocked) {
    const unlocked = await game.unlockAudio();
    if (!unlocked) {
      audioButton.textContent = "Sound unavailable";
      audioButton.disabled = true;
      return;
    }
  } else {
    game.toggleAudio();
  }
  renderAudioButton();
});
renderAudioButton();

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("pointerdown", (event) => {
    if (event?.target === audioButton) {
      return;
    }
    game.unlockAudio().then(() => renderAudioButton());
  }, { capture: true, once: true });
  globalThis.addEventListener("storage", (event) => {
    game.handleStorageEvent(event);
  });
  globalThis.addEventListener("pagehide", () => {
    game.dispose();
  }, { once: true });
}

if (typeof document.addEventListener === "function") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      game.suspendAudio();
    } else {
      game.resumeAudio();
    }
  });
}
