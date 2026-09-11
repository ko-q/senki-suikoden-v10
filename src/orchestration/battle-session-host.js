import { invariant } from "../core/domain-error.js";
import { PreparedBattleLoad } from "../core/prepared-battle-load.js";
import { BattleRandom } from "../domain/battle-random.js";
import { Stage } from "../domain/stage.js";

function requireMethod(target, methodName, code) {
  invariant(target !== null && typeof target === "object", code);
  invariant(typeof target[methodName] === "function", code, { methodName });
}

/**
 * ControllerとScreenを一つの破棄単位にまとめる。Screenは非表示root上でも構わない。
 */
export class BattleSession {
  #connected;
  #active;
  #disposed;
  #view;

  constructor({ stage, battleRandom, controller, screen, view = null }) {
    invariant(stage instanceof Stage, "BATTLE_SESSION_STAGE_REQUIRED");
    invariant(battleRandom instanceof BattleRandom, "BATTLE_SESSION_RANDOM_REQUIRED");
    for (const methodName of ["dispose", "getStage", "resumeLoadedBattle", "startNewBattle"]) {
      requireMethod(controller, methodName, "BATTLE_SESSION_CONTROLLER_INVALID");
    }
    for (const methodName of ["connectCommandPort", "dispose"]) {
      requireMethod(screen, methodName, "BATTLE_SESSION_SCREEN_INVALID");
    }
    if (view !== null) {
      for (const methodName of ["activate", "dispose"]) {
        requireMethod(view, methodName, "BATTLE_SESSION_VIEW_INVALID");
      }
    }
    invariant(controller.getStage() === stage, "BATTLE_SESSION_STAGE_MISMATCH");
    this.stage = stage;
    this.battleRandom = battleRandom;
    this.controller = controller;
    this.screen = screen;
    this.#view = view;
    this.#connected = false;
    this.#active = false;
    this.#disposed = false;
  }

  get isConnected() {
    return this.#connected;
  }

  get isDisposed() {
    return this.#disposed;
  }

  get isActive() {
    return this.#active;
  }

  validateConnection() {
    invariant(!this.#disposed, "BATTLE_SESSION_DISPOSED");
    invariant(!this.#connected, "BATTLE_SESSION_ALREADY_CONNECTED");
    this.stage.validateRuntime();
    this.screen.connectCommandPort(this.controller);
    invariant(this.controller.getStage() === this.stage, "BATTLE_SESSION_STAGE_MISMATCH");
    this.#connected = true;
    return true;
  }

  activate() {
    invariant(this.#connected, "BATTLE_SESSION_NOT_CONNECTED");
    invariant(!this.#disposed, "BATTLE_SESSION_DISPOSED");
    invariant(!this.#active, "BATTLE_SESSION_ALREADY_ACTIVE");
    if (this.#view !== null) {
      this.#view.activate();
    }
    this.#active = true;
  }

  startNewBattle() {
    invariant(this.#connected, "BATTLE_SESSION_NOT_CONNECTED");
    invariant(this.#active, "BATTLE_SESSION_NOT_ACTIVE");
    invariant(!this.#disposed, "BATTLE_SESSION_DISPOSED");
    return this.#handleCompletion(this.controller.startNewBattle());
  }

  resumeLoadedBattle() {
    invariant(this.#connected, "BATTLE_SESSION_NOT_CONNECTED");
    invariant(this.#active, "BATTLE_SESSION_NOT_ACTIVE");
    invariant(!this.#disposed, "BATTLE_SESSION_DISPOSED");
    return this.#handleCompletion(this.controller.resumeLoadedBattle());
  }

  #handleCompletion(completion) {
    if (completion !== null && typeof completion?.catch === "function") {
      completion.catch((error) => {
        if (error?.name !== "AbortError" && typeof this.screen.showFault === "function") {
          this.screen.showFault(error);
        }
      });
    }
    return completion;
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.screen.dispose();
    this.controller.dispose();
    if (this.#view !== null) {
      this.#view.dispose();
    }
    this.#active = false;
  }
}

/**
 * 新sessionの生成・接続検証が成功した後だけ旧sessionを破棄して参照を交換する。
 */
export class BattleSessionHost {
  #currentSession;
  #createLoadedSession;

  constructor({ currentSession, createLoadedSession }) {
    invariant(
      currentSession === null || currentSession instanceof BattleSession,
      "BATTLE_CURRENT_SESSION_INVALID"
    );
    invariant(typeof createLoadedSession === "function", "BATTLE_SESSION_FACTORY_REQUIRED");
    this.#currentSession = currentSession;
    this.#createLoadedSession = createLoadedSession;
  }

  get currentSession() {
    return this.#currentSession;
  }

  replaceWithPreparedLoad(prepared) {
    invariant(prepared instanceof PreparedBattleLoad, "BATTLE_PREPARED_LOAD_REQUIRED");
    let candidate = null;
    try {
      candidate = this.#createLoadedSession(prepared);
      invariant(candidate instanceof BattleSession, "BATTLE_LOADED_SESSION_REQUIRED");
      invariant(candidate.stage === prepared.stage, "BATTLE_LOADED_STAGE_MISMATCH");
      invariant(
        candidate.battleRandom.exportState().algorithm === prepared.randomState.algorithm
          && candidate.battleRandom.exportState().state === prepared.randomState.state,
        "BATTLE_LOADED_RANDOM_MISMATCH"
      );
      this.#prepareCandidate(candidate);
    } catch (error) {
      if (candidate instanceof BattleSession) {
        candidate.dispose();
      }
      throw error;
    }

    const completion = this.#commitCandidate(candidate, "resumeLoadedBattle");
    return Object.freeze({
      prepared,
      session: candidate,
      completion
    });
  }

  replaceWithNewBattle(candidate) {
    invariant(candidate instanceof BattleSession, "BATTLE_NEW_SESSION_REQUIRED");
    try {
      this.#prepareCandidate(candidate);
    } catch (error) {
      candidate.dispose();
      throw error;
    }
    const completion = this.#commitCandidate(candidate, "startNewBattle");
    return Object.freeze({ session: candidate, completion });
  }

  dispose() {
    if (this.#currentSession === null) {
      return;
    }
    this.#currentSession.dispose();
    this.#currentSession = null;
  }

  #prepareCandidate(candidate) {
    candidate.validateConnection();
    candidate.activate();
  }

  #commitCandidate(candidate, startMethod) {
    const previous = this.#currentSession;
    this.#currentSession = candidate;
    if (previous !== null) {
      previous.dispose();
    }
    return candidate[startMethod]();
  }
}
