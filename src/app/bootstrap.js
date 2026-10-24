import {
  AudioController,
  AudioThemeId,
  BattleSessionFactory,
  BattleViewFactory,
  Game,
  GameResultPanel,
  GAME_VERSION,
  PersistencePanel,
  SaveRepository,
  SaveService,
  StageFactory,
  TitleScreen,
  createV9CompatibleTerrainCatalog
} from "../index.js";
import { createV9CharacterManager } from "../definitions/v9-characters.js";
import { V9_OPENING_STAGE_SOURCE } from "../definitions/v9-opening-stage-source.js";
import { createV9OpeningStageDefinition } from "../definitions/v9-opening-stages.js";
import { PlayerShell } from "../presentation/player-shell.js";

document.title = `戦旗水滸伝 v${GAME_VERSION}`;
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
  nextBattleButton: document.querySelector("#resultNextBattleButton"),
  overlay: document.querySelector("#resultOverlay"),
  title: document.querySelector("#resultTitle")
};

const titleElements = {
  background: document.querySelector("#titleBackground"),
  logo: document.querySelector("#titleLogo"),
  prompt: document.querySelector("#titlePrompt"),
  root: document.querySelector("#titleScreen")
};

const characterManager = createV9CharacterManager();
const stageFactory = new StageFactory({
  definitions: V9_OPENING_STAGE_SOURCE.map((source) => createV9OpeningStageDefinition(source.id, characterManager)),
  characterManager,
  terrainCatalog: createV9CompatibleTerrainCatalog()
});
const viewFactory = new BattleViewFactory({
  host: document.querySelector("#battleHost"),
  template: document.querySelector("#battleViewTemplate")
});
const audioController = new AudioController();
const sessionFactory = new BattleSessionFactory({ viewFactory, audioController });
const persistencePanel = new PersistencePanel({ elements: persistenceElements,
  stageTitleForId: (id) => V9_OPENING_STAGE_SOURCE.find((stage) => stage.id === id)?.title ?? id });
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

let playerShell;
const game = new Game({
  stageFactory,
  stageId: V9_OPENING_STAGE_SOURCE[0].id,
  sessionFactory,
  saveService,
  persistencePanel,
  resultPanel,
  audioController,
  onRequestStageSelection: () => playerShell.showStageSelection(),
  onSessionChange: (session) => playerShell.attachSession(session)
});
playerShell = new PlayerShell({ game, stages: V9_OPENING_STAGE_SOURCE,
  elements: Object.fromEntries(["battleHost", "stageSelectOverlay", "stageList", "stageSelectLoadButton", "closeSaveSlotsButton", "saveSlotOverlay", "closeBattleInfoButton", "battleInfoOverlay", "openSaveButton", "openLoadButton", "returnStageSelectButton", "battleInfoTitle", "battleInfoBody", "stageInfoActions", "persistenceTitle"].map((id) => [id, document.querySelector(`#${id}`)])) });
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
  onStart: () => { playerShell.showStageSelection(); game.start({ autoStart: false }); }
});
titleScreen.start();

function renderAudioButton() {
  if (!game.isAudioUnlocked) {
    audioButton.textContent = "音声：開始";
    audioButton.setAttribute("aria-pressed", "false");
    return;
  }
  audioButton.textContent = game.isAudioEnabled ? "音声：入" : "音声：切";
  audioButton.setAttribute("aria-pressed", game.isAudioEnabled ? "true" : "false");
}

audioButton.addEventListener("click", async () => {
  if (!game.isAudioUnlocked) {
    const unlocked = await game.unlockAudio();
    if (!unlocked) {
      audioButton.textContent = "音声を開始できません";
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
    playerShell.dispose();
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
