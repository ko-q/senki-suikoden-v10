import { BattleOutcome } from "../core/battle-result.js";
import { invariant } from "../core/domain-error.js";
import {
  PresentationRequestType,
  validatePresentationRequest
} from "../core/presentation-request.js";
import {
  DEFAULT_SCREEN_VISUAL_ASSET_URLS,
  ScreenVisualAssetId,
  requireScreenVisualAssetCatalog
} from "./screen-visual-assets.js";

export const V9_BATTLE_RESULT_TIMING = Object.freeze({
  ARMY_FADE_MS: 5000,
  TITLE_FADE_MS: 5000,
  RAYS_FADE_MS: 3000,
  EXIT_MS: 420
});

function createAbortError() {
  const error = new Error("BATTLE_RESULT_EFFECT_ABORTED");
  error.name = "AbortError";
  return error;
}

function requireLayer(layer) {
  invariant(layer !== null && typeof layer === "object", "BATTLE_RESULT_LAYER_INVALID");
  for (const methodName of ["append", "setAttribute"]) {
    invariant(typeof layer[methodName] === "function", "BATTLE_RESULT_LAYER_INVALID", {
      methodName
    });
  }
  return layer;
}

function normalizeTiming(timing) {
  invariant(
    timing !== null && typeof timing === "object" && !Array.isArray(timing),
    "BATTLE_RESULT_TIMING_INVALID"
  );
  const normalized = {};
  for (const key of Object.keys(V9_BATTLE_RESULT_TIMING)) {
    const value = timing[key];
    invariant(Number.isInteger(value) && value >= 0, "BATTLE_RESULT_TIMING_VALUE_INVALID", {
      key,
      value
    });
    normalized[key] = value;
  }
  return Object.freeze(normalized);
}

function requireDurationOverride(durationOverride) {
  invariant(
    durationOverride === undefined
      || (Number.isInteger(durationOverride) && durationOverride >= 0),
    "BATTLE_RESULT_DURATION_OVERRIDE_INVALID"
  );
}

function addClassNames(element, ...names) {
  element.className = names.join(" ");
  element.classList.add(...names);
}

/**
 * 勝利・敗北の全画面演出、完了後の明示tap、Battle破棄時のcancelを所有する。
 */
export class BattleResultEffectSession {
  #layer;
  #assetUrls;
  #timing;
  #disposeAbortController;
  #currentRoot;
  #disposed;

  constructor({
    layer,
    assetUrls = DEFAULT_SCREEN_VISUAL_ASSET_URLS,
    timing = V9_BATTLE_RESULT_TIMING
  }) {
    this.#layer = requireLayer(layer);
    this.#assetUrls = requireScreenVisualAssetCatalog(assetUrls);
    this.#timing = normalizeTiming(timing);
    this.#disposeAbortController = new AbortController();
    this.#currentRoot = null;
    this.#disposed = false;
  }

  async present(request, abortSignal, durationOverride = undefined) {
    validatePresentationRequest(request);
    invariant(abortSignal instanceof AbortSignal, "BATTLE_RESULT_ABORT_SIGNAL_REQUIRED");
    requireDurationOverride(durationOverride);
    if (request.type !== PresentationRequestType.BATTLE_RESULT) {
      return false;
    }
    invariant(!this.#disposed, "BATTLE_RESULT_SESSION_DISPOSED");
    invariant(this.#currentRoot === null, "BATTLE_RESULT_EFFECT_ALREADY_ACTIVE");
    this.#throwIfAborted(abortSignal);

    const outcome = request.payload.outcome;
    invariant(
      outcome === BattleOutcome.VICTORY || outcome === BattleOutcome.DEFEAT,
      "BATTLE_RESULT_OUTCOME_INVALID"
    );
    await this.#show(outcome, abortSignal, durationOverride);
    return true;
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#disposeAbortController.abort();
    this.#removeCurrentRoot();
  }

  async #show(outcome, abortSignal, durationOverride) {
    const victory = outcome === BattleOutcome.VICTORY;
    const root = document.createElement("div");
    addClassNames(root, "battle-result-effect", victory ? "victory-effect" : "defeat-effect");
    root.setAttribute("role", "button");
    root.setAttribute("aria-live", "assertive");
    root.setAttribute("aria-disabled", "true");
    root.setAttribute(
      "aria-label",
      victory
        ? "Victory sequence. Wait for the prompt before continuing."
        : "Defeat sequence. Wait for the prompt before continuing."
    );
    root.tabIndex = 0;

    const shade = this.#createLayer("div", "battle-result-layer", "battle-result-shade");
    shade.setAttribute("aria-hidden", "true");
    const army = this.#createImage(
      victory ? "victory-effect-army" : "defeat-effect-army",
      victory ? ScreenVisualAssetId.VICTORY_ARMY : ScreenVisualAssetId.DEFEAT_ARMY,
      ""
    );
    army.setAttribute("aria-hidden", "true");
    const title = this.#createImage(
      victory ? "victory-effect-title" : "defeat-effect-title",
      victory ? ScreenVisualAssetId.VICTORY_TITLE : ScreenVisualAssetId.DEFEAT_TITLE,
      victory ? "Victory" : "Defeat"
    );
    const prompt = document.createElement("div");
    addClassNames(prompt, "battle-result-prompt");
    prompt.textContent = "Tap to continue";
    prompt.setAttribute("aria-hidden", "true");

    const rays = victory
      ? this.#createImage(
        "victory-effect-rays",
        ScreenVisualAssetId.VICTORY_RAYS,
        ""
      )
      : null;
    if (rays !== null) {
      rays.setAttribute("aria-hidden", "true");
      root.append(shade, army, title, rays, prompt);
    } else {
      root.append(shade, army, title, prompt);
    }

    this.#currentRoot = root;
    this.#layer.hidden = false;
    this.#layer.setAttribute("aria-hidden", "false");
    this.#layer.append(root);
    root.focus?.({ preventScroll: true });

    const handlePreReadyKeydown = (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault?.();
      }
    };
    root.addEventListener("keydown", handlePreReadyKeydown);

    try {
      void root.offsetWidth;
      root.classList.add("is-army-visible");
      await this.#wait(this.#durationFor("ARMY_FADE_MS", durationOverride), abortSignal);
      root.classList.add("is-title-visible");
      await this.#wait(this.#durationFor("TITLE_FADE_MS", durationOverride), abortSignal);
      if (rays !== null) {
        root.classList.add("is-rays-visible");
        await this.#wait(this.#durationFor("RAYS_FADE_MS", durationOverride), abortSignal);
      }
      this.#throwIfAborted(abortSignal);
      root.classList.add("is-ready");
      root.removeEventListener("keydown", handlePreReadyKeydown);
      root.setAttribute("aria-disabled", "false");
      root.setAttribute("aria-label", victory ? "Victory. Tap to continue." : "Defeat. Tap to continue.");
      prompt.setAttribute("aria-hidden", "false");

      if (durationOverride === undefined) {
        await this.#waitForContinue(root, abortSignal);
      }
      this.#throwIfAborted(abortSignal);
      root.classList.add("is-leaving");
      await this.#wait(this.#durationFor("EXIT_MS", durationOverride), abortSignal);
    } finally {
      root.removeEventListener("keydown", handlePreReadyKeydown);
      if (this.#currentRoot === root) {
        this.#removeCurrentRoot();
      } else {
        root.remove();
      }
    }
  }

  #createLayer(tagName, ...classNames) {
    const element = document.createElement(tagName);
    addClassNames(element, ...classNames);
    return element;
  }

  #createImage(className, assetId, alt) {
    const image = this.#createLayer("img", "battle-result-layer", className);
    image.src = this.#assetUrls[assetId];
    image.alt = alt;
    image.draggable = false;
    return image;
  }

  #durationFor(key, durationOverride) {
    return durationOverride ?? this.#timing[key];
  }

  #wait(duration, abortSignal) {
    this.#throwIfAborted(abortSignal);
    if (duration === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error = null) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timerId);
        abortSignal.removeEventListener("abort", handleAbort);
        this.#disposeAbortController.signal.removeEventListener("abort", handleAbort);
        if (error === null) {
          resolve();
        } else {
          reject(error);
        }
      };
      const handleAbort = () => finish(createAbortError());
      const timerId = setTimeout(() => finish(), duration);
      abortSignal.addEventListener("abort", handleAbort, { once: true });
      this.#disposeAbortController.signal.addEventListener("abort", handleAbort, { once: true });
    });
  }

  #waitForContinue(root, abortSignal) {
    this.#throwIfAborted(abortSignal);
    return new Promise((resolve, reject) => {
      let settled = false;
      const cleanup = () => {
        root.removeEventListener("click", handleClick);
        root.removeEventListener("keydown", handleKeydown);
        abortSignal.removeEventListener("abort", handleAbort);
        this.#disposeAbortController.signal.removeEventListener("abort", handleAbort);
      };
      const finish = (error = null) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        if (error === null) {
          resolve();
        } else {
          reject(error);
        }
      };
      const handleClick = (event) => {
        event.preventDefault?.();
        finish();
      };
      const handleKeydown = (event) => {
        if (event.key !== "Enter" && event.key !== " ") {
          return;
        }
        event.preventDefault?.();
        if (!event.repeat) {
          finish();
        }
      };
      const handleAbort = () => finish(createAbortError());
      root.addEventListener("click", handleClick);
      root.addEventListener("keydown", handleKeydown);
      abortSignal.addEventListener("abort", handleAbort, { once: true });
      this.#disposeAbortController.signal.addEventListener("abort", handleAbort, { once: true });
    });
  }

  #throwIfAborted(abortSignal) {
    if (this.#disposed || abortSignal.aborted || this.#disposeAbortController.signal.aborted) {
      throw createAbortError();
    }
  }

  #removeCurrentRoot() {
    if (this.#currentRoot !== null) {
      this.#currentRoot.remove();
      this.#currentRoot = null;
    }
    this.#layer.hidden = true;
    this.#layer.setAttribute("aria-hidden", "true");
  }
}
