import { NullBattleCheckpointPort } from "../boundary/battle-ports.js";
import { AudioController } from "../audio/audio-controller.js";
import { GAME_VERSION } from "../config/version.js";
import { invariant } from "../core/domain-error.js";
import { PreparedBattleLoad } from "../core/prepared-battle-load.js";
import { BattleRandom } from "../domain/battle-random.js";
import { Stage } from "../domain/stage.js";
import { BattleEffectManager } from "../presentation/battle-effect-manager.js";
import { BattleResultEffectSession } from "../presentation/battle-result-effects.js";
import { BattleRenderer } from "../presentation/battle-renderer.js";
import { BattleScreen } from "../presentation/battle-screen.js";
import { BattleVisualEffectSession } from "../presentation/battle-visual-effects.js";
import { BattleViewFactory } from "../presentation/battle-view.js";
import { AIService } from "../services/ai-service.js";
import { CombatService } from "../services/combat-service.js";
import { MovementService } from "../services/movement-service.js";
import { StatusService } from "../services/status-service.js";
import { TacticService } from "../services/tactic-service.js";
import { BattleController } from "./battle-controller.js";
import { BattleSession } from "./battle-session-host.js";

/**
 * Battle一式を独立したDOM root上に生成する。Domain serviceはsession間で共有しない。
 */
export class BattleSessionFactory {
  #viewFactory;
  #checkpointPort;
  #effectDurations;
  #audioController;

  constructor({
    viewFactory,
    checkpointPort = new NullBattleCheckpointPort(),
    effectDurations = undefined,
    audioController = new AudioController()
  }) {
    invariant(
      viewFactory instanceof BattleViewFactory,
      "BATTLE_SESSION_VIEW_FACTORY_REQUIRED"
    );
    invariant(
      checkpointPort !== null
        && typeof checkpointPort === "object"
        && typeof checkpointPort.requestRecoverySave === "function"
        && typeof checkpointPort.requestRecoveryClear === "function",
      "BATTLE_SESSION_CHECKPOINT_PORT_INVALID"
    );
    invariant(
      effectDurations === undefined
        || (effectDurations !== null && typeof effectDurations === "object"),
      "BATTLE_SESSION_EFFECT_DURATIONS_INVALID"
    );
    invariant(audioController instanceof AudioController, "BATTLE_SESSION_AUDIO_REQUIRED");
    this.#viewFactory = viewFactory;
    this.#checkpointPort = checkpointPort;
    this.#effectDurations = effectDurations;
    this.#audioController = audioController;
  }

  get audioController() {
    return this.#audioController;
  }

  create(stage, battleRandom, { checkpointPort = this.#checkpointPort } = {}) {
    invariant(stage instanceof Stage, "BATTLE_SESSION_STAGE_REQUIRED");
    invariant(battleRandom instanceof BattleRandom, "BATTLE_SESSION_RANDOM_REQUIRED");
    invariant(
      checkpointPort !== null
        && typeof checkpointPort === "object"
        && typeof checkpointPort.requestRecoverySave === "function"
        && typeof checkpointPort.requestRecoveryClear === "function",
      "BATTLE_SESSION_CHECKPOINT_PORT_INVALID"
    );
    const view = this.#viewFactory.create();
    let screen = null;
    let controller = null;
    let effectManager = null;
    let visualSession = null;
    let resultSession = null;
    let audioSession = null;
    try {
      view.elements.versionValue.textContent = GAME_VERSION;
      const movementService = new MovementService();
      const combatService = new CombatService();
      const tacticService = new TacticService();
      const statusService = new StatusService();
      const aiService = new AIService({
        movementService,
        combatService,
        tacticService,
        battleRandom
      });
      const renderer = new BattleRenderer(view.elements);
      visualSession = new BattleVisualEffectSession({
        stage,
        board: view.elements.board,
        effectLayer: view.elements.effectLayer
      });
      resultSession = new BattleResultEffectSession({
        layer: view.elements.resultEffectLayer
      });
      audioSession = this.#audioController.createBattleSession();
      effectManager = new BattleEffectManager({
        renderer,
        audioSession,
        visualSession,
        resultSession,
        ...(this.#effectDurations === undefined
          ? {}
          : { durations: this.#effectDurations })
      });
      screen = new BattleScreen({ stage, renderer, effectManager });
      controller = new BattleController({
        stage,
        battleRandom,
        movementService,
        combatService,
        tacticService,
        statusService,
        aiService,
        presentationPort: screen,
        checkpointPort
      });
      return new BattleSession({
        stage,
        battleRandom,
        controller,
        screen,
        view
      });
    } catch (error) {
      if (screen !== null) {
        screen.dispose();
      }
      if (controller !== null) {
        controller.dispose();
      }
      if (screen === null && effectManager !== null) {
        effectManager.dispose();
      }
      if (effectManager === null && visualSession !== null) {
        visualSession.dispose();
      }
      if (effectManager === null && resultSession !== null) {
        resultSession.dispose();
      }
      if (effectManager === null && audioSession !== null) {
        audioSession.dispose();
      }
      view.dispose();
      throw error;
    }
  }

  createLoaded(prepared, options = {}) {
    invariant(prepared instanceof PreparedBattleLoad, "BATTLE_PREPARED_LOAD_REQUIRED");
    const battleRandom = new BattleRandom(1);
    battleRandom.importState(prepared.randomState);
    return this.create(prepared.stage, battleRandom, options);
  }
}
