import {
  AudioController,
  AudioThemeId,
  BattleSessionFactory,
  BattleViewFactory,
  CharacterManager,
  DEVELOPMENT_STAGE_DEFINITION,
  Game,
  GameResultPanel,
  PersistencePanel,
  SaveRepository,
  SaveService,
  StageFactory,
  TitleScreen,
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

const resultElements = {
  details: document.querySelector("#resultDetails"),
  message: document.querySelector("#resultMessage"),
  newBattleButton: document.querySelector("#resultNewBattleButton"),
  overlay: document.querySelector("#resultOverlay"),
  title: document.querySelector("#resultTitle")
};

const titleElements = {
  background: document.querySelector("#titleBackground"),
  logo: document.querySelector("#titleLogo"),
  prompt: document.querySelector("#titlePrompt"),
  root: document.querySelector("#titleScreen")
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
const resultPanel = new GameResultPanel({ elements: resultElements });

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
  resultPanel,
  audioController
});
const titleScreen = new TitleScreen({
  elements: titleElements,
  onPrepare: async () => {
    const unlocked = await game.unlockAudio();
    renderAudioButton();
    return unlocked;
  },
  onThunder: () => audioController.playTitleThunder(),
  onWhiteout: () => audioController.playTitleWhiteoutHiss(),
  onTitleTheme: () => audioController.startTheme(AudioThemeId.TITLE),
  onStart: () => game.start()
});
titleScreen.start();

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
    titleScreen.dispose();
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
