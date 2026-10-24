import { invariant } from "../core/domain-error.js";
import {
  PresentationRequestType,
  validatePresentationRequest
} from "../core/presentation-request.js";
import { BattleRenderer } from "./battle-renderer.js";

const DEFAULT_DURATIONS = Object.freeze({
  [PresentationRequestType.MISSION_BRIEFING]: 0,
  [PresentationRequestType.NOTICE]: 0,
  [PresentationRequestType.UNIT_FOCUS]: 0,
  [PresentationRequestType.MOVE]: 70,
  [PresentationRequestType.ACTION]: 100,
  [PresentationRequestType.DAMAGE]: 120,
  [PresentationRequestType.STATUS]: 100,
  [PresentationRequestType.TRAP]: 140,
  [PresentationRequestType.PHASE]: 100,
  [PresentationRequestType.CONFIRM]: 0,
  [PresentationRequestType.BATTLE_RESULT]: 0
});

function createAbortError() {
  const error = new Error("BATTLE_EFFECT_ABORTED");
  error.name = "AbortError";
  return error;
}

function normalizeDurations(overrides) {
  invariant(
    overrides !== null && typeof overrides === "object" && !Array.isArray(overrides),
    "BATTLE_EFFECT_DURATIONS_INVALID"
  );
  const values = { ...DEFAULT_DURATIONS };
  for (const [type, duration] of Object.entries(overrides)) {
    invariant(Object.hasOwn(DEFAULT_DURATIONS, type), "BATTLE_EFFECT_TYPE_INVALID", { type });
    invariant(
      Number.isInteger(duration) && duration >= 0,
      "BATTLE_EFFECT_DURATION_INVALID",
      { type }
    );
    values[type] = duration;
  }
  return Object.freeze(values);
}

function waitForDuration(duration, abortSignal) {
  if (abortSignal.aborted) {
    return Promise.reject(createAbortError());
  }
  if (duration === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timerId = setTimeout(() => {
      abortSignal.removeEventListener("abort", handleAbort);
      resolve();
    }, duration);
    const handleAbort = () => {
      clearTimeout(timerId);
      reject(createAbortError());
    };
    abortSignal.addEventListener("abort", handleAbort, { once: true });
  });
}

/**
 * 確定済みPresentationRequestを表示し、Domainとは独立した短い演出待機を行う。
 */
export class BattleEffectManager {
  #renderer;
  #durations;
  #durationOverrideTypes;
  #audioSession;
  #visualSession;
  #resultSession;
  #cutInSession;

  constructor({
    renderer,
    durations = {},
    audioSession = null,
    visualSession = null,
    resultSession = null,
    cutInSession = null
  }) {
    invariant(renderer instanceof BattleRenderer, "BATTLE_EFFECT_RENDERER_REQUIRED");
    invariant(
      audioSession === null
        || (
          typeof audioSession === "object"
          && typeof audioSession.present === "function"
          && typeof audioSession.dispose === "function"
        ),
      "BATTLE_EFFECT_AUDIO_SESSION_INVALID"
    );
    invariant(
      visualSession === null
        || (
          typeof visualSession === "object"
          && typeof visualSession.present === "function"
          && typeof visualSession.dispose === "function"
        ),
      "BATTLE_EFFECT_VISUAL_SESSION_INVALID"
    );
    invariant(
      resultSession === null
        || (
          typeof resultSession === "object"
          && typeof resultSession.present === "function"
          && typeof resultSession.dispose === "function"
        ),
      "BATTLE_EFFECT_RESULT_SESSION_INVALID"
    );
    this.#renderer = renderer;
    this.#durations = normalizeDurations(durations);
    this.#durationOverrideTypes = new Set(Object.keys(durations));
    this.#audioSession = audioSession;
    this.#visualSession = visualSession;
    this.#resultSession = resultSession;
    invariant(cutInSession === null || (typeof cutInSession.present === "function"
      && typeof cutInSession.dispose === "function"), "BATTLE_EFFECT_CUT_IN_SESSION_INVALID");
    this.#cutInSession = cutInSession;
  }

  async present(request, abortSignal) {
    validatePresentationRequest(request);
    invariant(abortSignal instanceof AbortSignal, "BATTLE_EFFECT_ABORT_SIGNAL_REQUIRED");
    invariant(
      request.type !== PresentationRequestType.DIALOGUE,
      "BATTLE_EFFECT_DIALOGUE_FORBIDDEN"
    );
    const durationOverride = this.#durationOverrideTypes.has(request.type)
      ? this.#durations[request.type] : undefined;
    if (this.#cutInSession !== null) {
      await this.#cutInSession.present(request, abortSignal, durationOverride);
    }
    if (abortSignal.aborted) throw createAbortError();
    let audioHandle = null;
    if (this.#audioSession !== null) {
      try {
        audioHandle = this.#audioSession.present(request, abortSignal);
      } catch (error) {
        audioHandle = null;
      }
    }
    this.#renderer.renderPresentation(request);
    try {
      const resultHandled = this.#resultSession === null
        ? false
        : await this.#resultSession.present(
          request,
          abortSignal,
          durationOverride
        );
      const visualHandled = resultHandled || this.#visualSession === null
        ? resultHandled
        : await this.#visualSession.present(request, abortSignal, durationOverride);
      if (!visualHandled) {
        await waitForDuration(this.#durations[request.type], abortSignal);
      }
    } finally {
      if (audioHandle !== null && typeof audioHandle.complete === "function") {
        audioHandle.complete();
      }
    }
  }

  dispose() {
    if (this.#cutInSession !== null) {
      this.#cutInSession.dispose();
      this.#cutInSession = null;
    }
    if (this.#resultSession !== null) {
      const resultSession = this.#resultSession;
      this.#resultSession = null;
      resultSession.dispose();
    }
    if (this.#visualSession !== null) {
      const visualSession = this.#visualSession;
      this.#visualSession = null;
      visualSession.dispose();
    }
    if (this.#audioSession !== null) {
      const audioSession = this.#audioSession;
      this.#audioSession = null;
      audioSession.dispose();
    }
  }
}
