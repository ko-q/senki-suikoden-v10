import { invariant } from "../core/domain-error.js";
import {
  DEFAULT_SCREEN_VISUAL_ASSET_URLS,
  ScreenVisualAssetId,
  requireScreenVisualAssetCatalog
} from "./screen-visual-assets.js";

export const V9_TITLE_SCREEN_TIMING = Object.freeze({
  WHITEOUT_AUDIO_MS: 2900,
  TITLE_THEME_MS: 6620,
  READY_MS: 6770,
  EXIT_MS: 460
});

function normalizeTiming(timing) {
  invariant(
    timing !== null && typeof timing === "object" && !Array.isArray(timing),
    "TITLE_SCREEN_TIMING_INVALID"
  );
  const normalized = {};
  for (const key of Object.keys(V9_TITLE_SCREEN_TIMING)) {
    const value = timing[key];
    invariant(Number.isInteger(value) && value >= 0, "TITLE_SCREEN_TIMING_VALUE_INVALID", {
      key,
      value
    });
    normalized[key] = value;
  }
  return Object.freeze(normalized);
}

function requireElement(element, code) {
  invariant(element !== null && typeof element === "object", code);
  for (const methodName of ["addEventListener", "removeEventListener", "setAttribute"]) {
    invariant(typeof element[methodName] === "function", code, { methodName });
  }
  return element;
}

function safeInvoke(callback) {
  try {
    return Promise.resolve(callback()).catch(() => false);
  } catch (error) {
    return Promise.resolve(false);
  }
}

/**
 * v9互換の二段階タイトル入力を所有し、Game開始前のUIと音声callbackだけを扱う。
 */
export class TitleScreen {
  #elements;
  #assetUrls;
  #timing;
  #onPrepare;
  #onThunder;
  #onWhiteout;
  #onTitleTheme;
  #onStart;
  #timers;
  #started;
  #introStarted;
  #ready;
  #closed;
  #disposed;

  constructor({
    elements,
    assetUrls = DEFAULT_SCREEN_VISUAL_ASSET_URLS,
    timing = V9_TITLE_SCREEN_TIMING,
    onPrepare = () => true,
    onThunder = () => {},
    onWhiteout = () => {},
    onTitleTheme = () => {},
    onStart
  }) {
    invariant(elements !== null && typeof elements === "object", "TITLE_SCREEN_ELEMENTS_REQUIRED");
    this.#elements = Object.freeze({
      background: requireElement(elements.background, "TITLE_SCREEN_BACKGROUND_INVALID"),
      logo: requireElement(elements.logo, "TITLE_SCREEN_LOGO_INVALID"),
      prompt: requireElement(elements.prompt, "TITLE_SCREEN_PROMPT_INVALID"),
      root: requireElement(elements.root, "TITLE_SCREEN_ROOT_INVALID")
    });
    this.#assetUrls = requireScreenVisualAssetCatalog(assetUrls);
    this.#timing = normalizeTiming(timing);
    for (const callback of [onPrepare, onThunder, onWhiteout, onTitleTheme, onStart]) {
      invariant(typeof callback === "function", "TITLE_SCREEN_CALLBACK_INVALID");
    }
    this.#onPrepare = onPrepare;
    this.#onThunder = onThunder;
    this.#onWhiteout = onWhiteout;
    this.#onTitleTheme = onTitleTheme;
    this.#onStart = onStart;
    this.#timers = new Set();
    this.#started = false;
    this.#introStarted = false;
    this.#ready = false;
    this.#closed = false;
    this.#disposed = false;
  }

  get isReady() {
    return this.#ready;
  }

  get isClosed() {
    return this.#closed;
  }

  start() {
    invariant(!this.#started, "TITLE_SCREEN_ALREADY_STARTED");
    invariant(!this.#disposed, "TITLE_SCREEN_DISPOSED");
    this.#started = true;
    this.#elements.background.style.backgroundImage = `url("${this.#assetUrls[ScreenVisualAssetId.TITLE_BACKGROUND]}")`;
    this.#elements.logo.src = this.#assetUrls[ScreenVisualAssetId.TITLE_LOGO];
    this.#elements.root.hidden = false;
    this.#elements.root.classList.add("active");
    this.#elements.root.setAttribute("aria-hidden", "false");
    this.#elements.prompt.setAttribute("aria-hidden", "true");
    this.#elements.root.addEventListener("click", this.#handleClick);
    this.#elements.root.addEventListener("keydown", this.#handleKeydown);
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    for (const timerId of this.#timers) {
      clearTimeout(timerId);
    }
    this.#timers.clear();
    this.#elements.root.removeEventListener("click", this.#handleClick);
    this.#elements.root.removeEventListener("keydown", this.#handleKeydown);
  }

  #handleClick = (event) => {
    event?.preventDefault?.();
    this.#activate();
  };

  #handleKeydown = (event) => {
    if (event?.key !== "Enter" && event?.key !== " ") {
      return;
    }
    event.preventDefault?.();
    if (event.repeat) {
      return;
    }
    this.#activate();
  };

  #activate() {
    if (!this.#started || this.#disposed || this.#closed) {
      return;
    }
    if (!this.#introStarted) {
      this.#beginIntro();
      return;
    }
    if (this.#ready) {
      this.#leave();
    }
  }

  async #beginIntro() {
    this.#introStarted = true;
    this.#elements.prompt.setAttribute("aria-hidden", "true");
    await safeInvoke(this.#onPrepare);
    if (this.#disposed || this.#closed) {
      return;
    }
    this.#elements.root.classList.add("intro");
    safeInvoke(this.#onThunder);
    this.#schedule(this.#timing.WHITEOUT_AUDIO_MS, () => safeInvoke(this.#onWhiteout));
    this.#schedule(this.#timing.TITLE_THEME_MS, () => safeInvoke(this.#onTitleTheme));
    this.#schedule(this.#timing.READY_MS, () => this.#setReady());
  }

  #setReady() {
    if (this.#disposed || this.#closed || this.#ready) {
      return;
    }
    this.#ready = true;
    this.#elements.root.classList.add("ready");
    this.#elements.root.setAttribute("aria-label", "Title ready. Tap or press Enter to start.");
    this.#elements.prompt.setAttribute("aria-hidden", "false");
  }

  #leave() {
    if (this.#closed || this.#disposed) {
      return;
    }
    this.#closed = true;
    this.#elements.root.classList.add("leaving");
    this.#schedule(this.#timing.EXIT_MS, () => {
      if (this.#disposed) {
        return;
      }
      this.#elements.root.classList.remove("active");
      this.#elements.root.hidden = true;
      this.#elements.root.setAttribute("aria-hidden", "true");
      this.#elements.root.removeEventListener("click", this.#handleClick);
      this.#elements.root.removeEventListener("keydown", this.#handleKeydown);
      safeInvoke(this.#onStart);
    });
  }

  #schedule(duration, callback) {
    const timerId = setTimeout(() => {
      this.#timers.delete(timerId);
      callback();
    }, duration);
    this.#timers.add(timerId);
  }
}
