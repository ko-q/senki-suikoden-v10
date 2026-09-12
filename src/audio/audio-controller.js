import { BattleOutcome } from "../core/battle-result.js";
import { invariant } from "../core/domain-error.js";
import { validatePresentationRequest } from "../core/presentation-request.js";
import {
  AudioAssetId,
  DEFAULT_AUDIO_ASSET_URLS,
  requireAudioAssetCatalog
} from "./audio-assets.js";
import {
  AudioCueId,
  AudioThemeId,
  audioCuesForPresentation,
  audioThemeForPresentation,
  battleThemeForChapter
} from "./audio-cue.js";

const MASTER_GAIN_ON = 0.88;
const MASTER_GAIN_OFF = 0;
const DEFEAT_START_OFFSET_SECONDS = 3.3;

const THEME_SPECS = Object.freeze({
  [AudioThemeId.TITLE]: Object.freeze({
    assetId: AudioAssetId.TITLE_THEME,
    gain: 0.72,
    loop: true,
    startOffset: 0
  }),
  [AudioThemeId.STAGE_SELECT]: Object.freeze({
    assetId: AudioAssetId.STAGE_SELECT_THEME,
    gain: 0.62,
    loop: true,
    startOffset: 0
  }),
  [AudioThemeId.BATTLE_STRATEGY]: Object.freeze({
    assetId: AudioAssetId.BATTLE_STRATEGY,
    gain: 0.376,
    loop: true,
    startOffset: 0
  }),
  [AudioThemeId.BATTLE_DS069]: Object.freeze({
    assetId: AudioAssetId.BATTLE_DS069,
    gain: 0.53,
    loop: true,
    startOffset: 0
  }),
  [AudioThemeId.BATTLE_GENERATED_FIXED]: Object.freeze({
    assetId: AudioAssetId.BATTLE_GENERATED_FIXED,
    gain: 0.53,
    loop: true,
    startOffset: 0
  }),
  [AudioThemeId.VICTORY]: Object.freeze({
    assetId: AudioAssetId.VICTORY_THEME,
    gain: 0.62,
    loop: false,
    startOffset: 0
  }),
  [AudioThemeId.DEFEAT]: Object.freeze({
    assetId: AudioAssetId.DEFEAT_THEME,
    gain: 0.62,
    loop: false,
    startOffset: DEFEAT_START_OFFSET_SECONDS
  })
});

const PRELOAD_ASSET_IDS = Object.freeze([
  AudioAssetId.SWORD_CLASH,
  AudioAssetId.PLAYER_BOW,
  AudioAssetId.ENEMY_BOW,
  AudioAssetId.TURN_GONG,
  AudioAssetId.TRAP_DAMAGE,
  AudioAssetId.CONFUSION_SUCCESS,
  AudioAssetId.ILLUSION_SUCCESS,
  AudioAssetId.WIDE_ILLUSION_START,
  AudioAssetId.CHARGE_RUMBLE,
  AudioAssetId.FIRE_CAST,
  AudioAssetId.FIRE_DAMAGE,
  AudioAssetId.WATER_CAST,
  AudioAssetId.WATER_DAMAGE,
  AudioAssetId.VICTORY_THEME,
  AudioAssetId.DEFEAT_THEME
]);

function defaultAudioContextFactory() {
  const AudioContextConstructor = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  return typeof AudioContextConstructor === "function"
    ? new AudioContextConstructor()
    : null;
}

function defaultFetcher(url) {
  invariant(typeof globalThis.fetch === "function", "AUDIO_FETCH_UNAVAILABLE");
  return globalThis.fetch(url);
}

function setImmediateGain(gainNode, value) {
  if (gainNode === null) {
    return;
  }
  gainNode.gain.value = value;
}

function stopSource(source, when = 0) {
  if (source === null) {
    return;
  }
  try {
    source.stop(when);
  } catch (error) {
    // 自然終了済みのAudioNode停止は無視する。
  }
}

function createCompletedHandle() {
  return Object.freeze({
    complete() {},
    abort() {},
    get active() {
      return false;
    }
  });
}

class AudioPresentationHandle {
  #active;
  #abortSignal;
  #handleAbort;
  #stopCallbacks;

  constructor(abortSignal) {
    this.#active = !abortSignal.aborted;
    this.#abortSignal = abortSignal;
    this.#stopCallbacks = new Set();
    this.#handleAbort = () => this.abort();
    if (this.#active) {
      abortSignal.addEventListener("abort", this.#handleAbort, { once: true });
    }
  }

  get active() {
    return this.#active;
  }

  addSource(source, context) {
    if (!this.#active) {
      stopSource(source, context?.currentTime ?? 0);
      return;
    }
    this.#stopCallbacks.add(() => stopSource(source, context?.currentTime ?? 0));
  }

  complete() {
    if (!this.#active) {
      return;
    }
    this.#active = false;
    this.#abortSignal.removeEventListener("abort", this.#handleAbort);
    this.#stopCallbacks.clear();
  }

  abort() {
    if (!this.#active) {
      return;
    }
    this.#active = false;
    this.#abortSignal.removeEventListener("abort", this.#handleAbort);
    for (const stop of this.#stopCallbacks) {
      stop();
    }
    this.#stopCallbacks.clear();
  }
}

/**
 * 一つのBattleだけが使える音声session。破棄後の遅延decode再生を禁止する。
 */
export class BattleAudioSession {
  #controller;
  #sessionId;
  #disposed;

  constructor(controller, sessionId) {
    this.#controller = controller;
    this.#sessionId = sessionId;
    this.#disposed = false;
  }

  present(request, abortSignal) {
    invariant(!this.#disposed, "BATTLE_AUDIO_SESSION_DISPOSED");
    return this.#controller.beginPresentation(this.#sessionId, request, abortSignal);
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#controller.closeBattleSession(this.#sessionId);
  }
}

/**
 * Web Audio graph、既存v9音源、Battleごとの一時音、BGM lifecycleを所有する。
 */
export class AudioController {
  #assetUrls;
  #audioContextFactory;
  #fetcher;
  #context;
  #compressor;
  #master;
  #bgm;
  #se;
  #enabled;
  #disposed;
  #backgroundSuspended;
  #unlockPromise;
  #buffers;
  #loadingPromises;
  #sessions;
  #nextSessionId;
  #themeGeneration;
  #queuedThemeId;
  #themePlayback;
  #diagnostics;
  #footstepIndex;

  constructor({
    assetUrls = DEFAULT_AUDIO_ASSET_URLS,
    audioContextFactory = defaultAudioContextFactory,
    fetcher = defaultFetcher
  } = {}) {
    invariant(typeof audioContextFactory === "function", "AUDIO_CONTEXT_FACTORY_INVALID");
    invariant(typeof fetcher === "function", "AUDIO_FETCHER_INVALID");
    this.#assetUrls = requireAudioAssetCatalog(assetUrls);
    this.#audioContextFactory = audioContextFactory;
    this.#fetcher = fetcher;
    this.#context = null;
    this.#compressor = null;
    this.#master = null;
    this.#bgm = null;
    this.#se = null;
    this.#enabled = true;
    this.#disposed = false;
    this.#backgroundSuspended = false;
    this.#unlockPromise = null;
    this.#buffers = new Map();
    this.#loadingPromises = new Map();
    this.#sessions = new Map();
    this.#nextSessionId = 1;
    this.#themeGeneration = 0;
    this.#queuedThemeId = null;
    this.#themePlayback = null;
    this.#diagnostics = [];
    this.#footstepIndex = 0;
  }

  get isEnabled() {
    return this.#enabled;
  }

  get isUnlocked() {
    return this.#context !== null;
  }

  get isDisposed() {
    return this.#disposed;
  }

  get currentThemeId() {
    return this.#themePlayback?.themeId ?? null;
  }

  get queuedThemeId() {
    return this.#queuedThemeId;
  }

  getDiagnostics() {
    return Object.freeze(this.#diagnostics.map((entry) => Object.freeze({ ...entry })));
  }

  async unlock() {
    if (this.#disposed) {
      return false;
    }
    if (this.#unlockPromise !== null) {
      return this.#unlockPromise;
    }
    this.#unlockPromise = this.#unlockAudio();
    try {
      return await this.#unlockPromise;
    } finally {
      this.#unlockPromise = null;
    }
  }

  setEnabled(enabled) {
    invariant(typeof enabled === "boolean", "AUDIO_ENABLED_INVALID");
    if (this.#disposed) {
      return false;
    }
    this.#enabled = enabled;
    setImmediateGain(this.#master, enabled ? MASTER_GAIN_ON : MASTER_GAIN_OFF);
    if (enabled && this.#context !== null && !this.#backgroundSuspended) {
      this.#resumeContext();
      if (this.#themePlayback === null && this.#queuedThemeId !== null) {
        this.#requestTheme(this.#queuedThemeId);
      }
    }
    return this.#enabled;
  }

  toggleEnabled() {
    return this.setEnabled(!this.#enabled);
  }

  playTitleThunder() {
    if (!this.#enabled || this.#context === null || this.#backgroundSuspended) {
      return false;
    }

    const time = this.#context.currentTime + 0.04;
    const duration = 3.25;
    const thunderBus = this.#context.createGain();
    const thunderBody = this.#context.createBiquadFilter();
    const thunderPresence = this.#context.createBiquadFilter();
    thunderBus.gain.value = 2.85;
    thunderBody.type = "peaking";
    thunderBody.frequency.value = 250;
    thunderBody.Q.value = 0.72;
    thunderBody.gain.value = 11;
    thunderPresence.type = "peaking";
    thunderPresence.frequency.value = 760;
    thunderPresence.Q.value = 0.62;
    thunderPresence.gain.value = 6;
    thunderBus.connect(thunderBody);
    thunderBody.connect(thunderPresence);
    thunderPresence.connect(this.#master);

    const cloud = this.#context.createBufferSource();
    const cloudLow = this.#context.createBiquadFilter();
    const cloudMid = this.#context.createBiquadFilter();
    const cloudGain = this.#context.createGain();
    cloud.buffer = this.#noiseBuffer(duration);
    cloudLow.type = "lowpass";
    cloudLow.frequency.setValueAtTime(1450, time);
    cloudLow.frequency.exponentialRampToValueAtTime(190, time + duration);
    cloudMid.type = "peaking";
    cloudMid.frequency.value = 285;
    cloudMid.Q.value = 0.78;
    cloudMid.gain.value = 12;
    cloudGain.gain.setValueAtTime(0.0001, time);
    cloudGain.gain.linearRampToValueAtTime(0.34, time + 0.14);
    cloudGain.gain.linearRampToValueAtTime(0.18, time + 0.34);
    cloudGain.gain.linearRampToValueAtTime(0.52, time + 0.56);
    cloudGain.gain.linearRampToValueAtTime(0.24, time + 0.82);
    cloudGain.gain.linearRampToValueAtTime(0.70, time + 1.06);
    cloudGain.gain.linearRampToValueAtTime(0.34, time + 1.30);
    cloudGain.gain.linearRampToValueAtTime(1.35, time + 1.56);
    cloudGain.gain.linearRampToValueAtTime(0.94, time + 1.94);
    cloudGain.gain.linearRampToValueAtTime(0.48, time + 2.48);
    cloudGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    cloud.connect(cloudLow);
    cloudLow.connect(cloudMid);
    cloudMid.connect(cloudGain);
    cloudGain.connect(thunderBus);
    cloud.start(time);

    [
      { delay: 0.16, start: 72, end: 44, peak: 0.22, attack: 0.12, release: 0.78 },
      { delay: 0.54, start: 66, end: 40, peak: 0.34, attack: 0.10, release: 0.88 },
      { delay: 0.96, start: 60, end: 36, peak: 0.46, attack: 0.09, release: 0.96 },
      { delay: 1.40, start: 56, end: 31, peak: 1.05, attack: 0.12, release: 1.42 },
      { delay: 1.68, start: 50, end: 28, peak: 0.82, attack: 0.10, release: 1.34 }
    ].forEach((spec) => {
      const oscillator = this.#context.createOscillator();
      const gainNode = this.#context.createGain();
      const point = time + spec.delay;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(spec.start, point);
      oscillator.frequency.exponentialRampToValueAtTime(spec.end, point + spec.release);
      gainNode.gain.setValueAtTime(0.0001, point);
      gainNode.gain.linearRampToValueAtTime(spec.peak, point + spec.attack);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, point + spec.release);
      oscillator.connect(gainNode);
      gainNode.connect(thunderBus);
      oscillator.start(point);
      oscillator.stop(point + spec.release + 0.05);
    });

    [
      { delay: 0.10, frequency: 320, peak: 0.24, duration: 0.50 },
      { delay: 0.40, frequency: 280, peak: 0.32, duration: 0.58 },
      { delay: 0.74, frequency: 250, peak: 0.42, duration: 0.64 },
      { delay: 1.10, frequency: 220, peak: 0.54, duration: 0.72 },
      { delay: 1.42, frequency: 195, peak: 1.02, duration: 0.98 },
      { delay: 1.70, frequency: 165, peak: 0.88, duration: 1.12 }
    ].forEach((spec) => {
      const source = this.#context.createBufferSource();
      const band = this.#context.createBiquadFilter();
      const lowpass = this.#context.createBiquadFilter();
      const gainNode = this.#context.createGain();
      const point = time + spec.delay;
      source.buffer = this.#noiseBuffer(spec.duration + 0.10);
      band.type = "bandpass";
      band.frequency.setValueAtTime(spec.frequency, point);
      band.Q.value = 0.58;
      lowpass.type = "lowpass";
      lowpass.frequency.value = 1350;
      gainNode.gain.setValueAtTime(0.0001, point);
      gainNode.gain.linearRampToValueAtTime(spec.peak, point + 0.07);
      gainNode.gain.linearRampToValueAtTime(spec.peak * 0.70, point + spec.duration * 0.48);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, point + spec.duration);
      source.connect(band);
      band.connect(lowpass);
      lowpass.connect(gainNode);
      gainNode.connect(thunderBus);
      source.start(point);
    });

    const impact = this.#context.createBufferSource();
    const impactBand = this.#context.createBiquadFilter();
    const impactLow = this.#context.createBiquadFilter();
    const impactGain = this.#context.createGain();
    const impactTime = time + 1.46;
    impact.buffer = this.#noiseBuffer(1.45);
    impactBand.type = "bandpass";
    impactBand.frequency.value = 360;
    impactBand.Q.value = 0.48;
    impactLow.type = "lowpass";
    impactLow.frequency.value = 1650;
    impactGain.gain.setValueAtTime(0.0001, impactTime);
    impactGain.gain.linearRampToValueAtTime(1.45, impactTime + 0.055);
    impactGain.gain.linearRampToValueAtTime(1.05, impactTime + 0.24);
    impactGain.gain.linearRampToValueAtTime(0.58, impactTime + 0.72);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, impactTime + 1.42);
    impact.connect(impactBand);
    impactBand.connect(impactLow);
    impactLow.connect(impactGain);
    impactGain.connect(thunderBus);
    impact.start(impactTime);

    [2.02, 2.34].forEach((delay, index) => {
      const tail = this.#context.createBufferSource();
      const tailLow = this.#context.createBiquadFilter();
      const tailGain = this.#context.createGain();
      const point = time + delay;
      tail.buffer = this.#noiseBuffer(0.88);
      tailLow.type = "lowpass";
      tailLow.frequency.value = index === 0 ? 560 : 390;
      tailGain.gain.setValueAtTime(0.0001, point);
      tailGain.gain.linearRampToValueAtTime(index === 0 ? 0.52 : 0.38, point + 0.10);
      tailGain.gain.exponentialRampToValueAtTime(0.0001, point + 0.86);
      tail.connect(tailLow);
      tailLow.connect(tailGain);
      tailGain.connect(thunderBus);
      tail.start(point);
    });
    return true;
  }

  playTitleWhiteoutHiss() {
    if (!this.#enabled || this.#context === null || this.#backgroundSuspended) {
      return false;
    }

    const time = this.#context.currentTime;
    const duration = 3.35;
    const air = this.#context.createBufferSource();
    const highpass = this.#context.createBiquadFilter();
    const lowpass = this.#context.createBiquadFilter();
    const gainNode = this.#context.createGain();
    air.buffer = this.#noiseBuffer(duration);
    highpass.type = "highpass";
    highpass.frequency.setValueAtTime(620, time);
    lowpass.type = "lowpass";
    lowpass.frequency.setValueAtTime(3200, time);
    lowpass.frequency.linearRampToValueAtTime(2400, time + duration);
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(0.012, time + 0.65);
    gainNode.gain.linearRampToValueAtTime(0.018, time + 1.55);
    gainNode.gain.linearRampToValueAtTime(0.010, time + 2.45);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    air.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(gainNode);
    gainNode.connect(this.#se);
    air.start(time);
    return true;
  }

  createBattleSession() {
    invariant(!this.#disposed, "AUDIO_CONTROLLER_DISPOSED");
    const sessionId = `battle_audio_${this.#nextSessionId}`;
    this.#nextSessionId += 1;
    this.#sessions.set(sessionId, {
      active: true,
      sources: new Set(),
      exclusiveSources: new Map()
    });
    return new BattleAudioSession(this, sessionId);
  }

  beginPresentation(sessionId, request, abortSignal) {
    validatePresentationRequest(request);
    invariant(abortSignal instanceof AbortSignal, "AUDIO_ABORT_SIGNAL_REQUIRED");
    const session = this.#sessions.get(sessionId);
    if (this.#disposed || session?.active !== true || abortSignal.aborted) {
      return createCompletedHandle();
    }

    const handle = new AudioPresentationHandle(abortSignal);
    const themeId = audioThemeForPresentation(request);
    if (themeId !== null) {
      this.startTheme(themeId);
    }
    if (!this.#enabled || this.#context === null || this.#backgroundSuspended) {
      handle.complete();
      return handle;
    }

    for (const descriptor of audioCuesForPresentation(request)) {
      this.#playCue(sessionId, descriptor, handle);
    }
    return handle;
  }

  closeBattleSession(sessionId) {
    const session = this.#sessions.get(sessionId);
    if (session === undefined || !session.active) {
      return false;
    }
    session.active = false;
    for (const source of session.sources) {
      stopSource(source, this.#context?.currentTime ?? 0);
    }
    session.sources.clear();
    session.exclusiveSources.clear();
    this.#sessions.delete(sessionId);
    return true;
  }

  startBattleThemeForChapter(chapterNumber) {
    return this.startTheme(battleThemeForChapter(chapterNumber));
  }

  startResultTheme(outcome) {
    invariant(
      outcome === BattleOutcome.VICTORY || outcome === BattleOutcome.DEFEAT,
      "AUDIO_BATTLE_OUTCOME_INVALID"
    );
    return this.startTheme(
      outcome === BattleOutcome.VICTORY ? AudioThemeId.VICTORY : AudioThemeId.DEFEAT
    );
  }

  startTheme(themeId) {
    invariant(Object.hasOwn(THEME_SPECS, themeId), "AUDIO_THEME_ID_INVALID", { themeId });
    this.#queuedThemeId = themeId;
    this.#themeGeneration += 1;
    const generation = this.#themeGeneration;
    this.#stopThemePlayback(0.3);
    if (
      this.#disposed
      || !this.#enabled
      || this.#context === null
      || this.#backgroundSuspended
    ) {
      return Promise.resolve(false);
    }
    return this.#loadAndStartTheme(themeId, generation);
  }

  stopTheme(fadeDuration = 0.3) {
    invariant(
      typeof fadeDuration === "number" && Number.isFinite(fadeDuration) && fadeDuration >= 0,
      "AUDIO_FADE_DURATION_INVALID"
    );
    this.#queuedThemeId = null;
    this.#themeGeneration += 1;
    this.#stopThemePlayback(fadeDuration);
  }

  async suspendForBackground() {
    if (this.#disposed || this.#backgroundSuspended) {
      return false;
    }
    this.#backgroundSuspended = true;
    if (this.#context === null || this.#context.state !== "running") {
      return true;
    }
    try {
      await this.#context.suspend();
      return true;
    } catch (error) {
      this.#recordDiagnostic("SUSPEND", error);
      return false;
    }
  }

  async resumeFromBackground() {
    if (this.#disposed || !this.#backgroundSuspended) {
      return false;
    }
    this.#backgroundSuspended = false;
    if (!this.#enabled || this.#context === null) {
      return true;
    }
    return this.#resumeContext();
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#themeGeneration += 1;
    this.#queuedThemeId = null;
    for (const sessionId of [...this.#sessions.keys()]) {
      this.closeBattleSession(sessionId);
    }
    this.#stopThemePlayback(0);
    const context = this.#context;
    this.#context = null;
    if (context !== null && typeof context.close === "function") {
      Promise.resolve(context.close()).catch((error) => {
        this.#recordDiagnostic("CLOSE", error);
      });
    }
  }

  async #unlockAudio() {
    try {
      if (this.#context === null) {
        const context = this.#audioContextFactory();
        if (context === null) {
          return false;
        }
        this.#initializeGraph(context);
      }
      if (this.#context.state !== "running") {
        await this.#context.resume();
      }
      setImmediateGain(this.#master, this.#enabled ? MASTER_GAIN_ON : MASTER_GAIN_OFF);
      this.#preloadBattleAssets();
      if (this.#enabled && this.#queuedThemeId !== null) {
        this.#requestTheme(this.#queuedThemeId);
      }
      return true;
    } catch (error) {
      this.#recordDiagnostic("UNLOCK", error);
      return false;
    }
  }

  #initializeGraph(context) {
    invariant(context !== null && typeof context === "object", "AUDIO_CONTEXT_INVALID");
    for (const methodName of [
      "createBuffer",
      "createBufferSource",
      "createBiquadFilter",
      "createDynamicsCompressor",
      "createGain",
      "createOscillator",
      "decodeAudioData",
      "resume"
    ]) {
      invariant(typeof context[methodName] === "function", "AUDIO_CONTEXT_METHOD_MISSING", {
        methodName
      });
    }
    this.#context = context;
    this.#compressor = context.createDynamicsCompressor();
    this.#compressor.threshold.value = -18;
    this.#compressor.knee.value = 18;
    this.#compressor.ratio.value = 5;
    this.#compressor.attack.value = 0.006;
    this.#compressor.release.value = 0.24;
    this.#compressor.connect(context.destination);

    this.#master = context.createGain();
    this.#master.gain.value = this.#enabled ? MASTER_GAIN_ON : MASTER_GAIN_OFF;
    this.#master.connect(this.#compressor);

    this.#bgm = context.createGain();
    this.#bgm.gain.value = 1;
    this.#bgm.connect(this.#master);

    this.#se = context.createGain();
    this.#se.gain.value = 0.92;
    this.#se.connect(this.#master);
  }

  #preloadBattleAssets() {
    for (const assetId of PRELOAD_ASSET_IDS) {
      this.#ensureAsset(assetId).catch((error) => {
        this.#recordDiagnostic("PRELOAD", error, assetId);
      });
    }
  }

  async #ensureAsset(assetId) {
    if (this.#buffers.has(assetId)) {
      return this.#buffers.get(assetId);
    }
    if (this.#loadingPromises.has(assetId)) {
      return this.#loadingPromises.get(assetId);
    }
    invariant(this.#context !== null, "AUDIO_CONTEXT_NOT_READY");
    const loadPromise = (async () => {
      const response = await this.#fetcher(this.#assetUrls[assetId]);
      invariant(response !== null && typeof response === "object", "AUDIO_RESPONSE_INVALID", {
        assetId
      });
      if (Object.hasOwn(response, "ok")) {
        invariant(response.ok, "AUDIO_RESPONSE_FAILED", { assetId, status: response.status });
      }
      invariant(typeof response.arrayBuffer === "function", "AUDIO_RESPONSE_BODY_INVALID", {
        assetId
      });
      const bytes = await response.arrayBuffer();
      const buffer = await this.#context.decodeAudioData(bytes.slice(0));
      this.#buffers.set(assetId, buffer);
      return buffer;
    })();
    this.#loadingPromises.set(assetId, loadPromise);
    try {
      return await loadPromise;
    } finally {
      this.#loadingPromises.delete(assetId);
    }
  }

  #requestTheme(themeId) {
    this.#themeGeneration += 1;
    const generation = this.#themeGeneration;
    this.#stopThemePlayback(0.3);
    return this.#loadAndStartTheme(themeId, generation);
  }

  async #loadAndStartTheme(themeId, generation) {
    const spec = THEME_SPECS[themeId];
    try {
      const buffer = await this.#ensureAsset(spec.assetId);
      if (
        this.#disposed
        || !this.#enabled
        || this.#backgroundSuspended
        || this.#context === null
        || this.#queuedThemeId !== themeId
        || this.#themeGeneration !== generation
      ) {
        return false;
      }
      const source = this.#context.createBufferSource();
      const gainNode = this.#context.createGain();
      source.buffer = buffer;
      source.loop = spec.loop;
      if (spec.loop) {
        source.loopStart = 0;
        source.loopEnd = buffer.duration;
      }
      gainNode.gain.value = spec.gain;
      source.connect(gainNode);
      gainNode.connect(this.#bgm);
      const startTime = this.#context.currentTime + 0.01;
      source.start(startTime, spec.startOffset);
      this.#themePlayback = { source, gainNode, targetGain: spec.gain, themeId };
      source.onended = () => {
        if (this.#themePlayback?.source === source) {
          this.#themePlayback = null;
        }
      };
      return true;
    } catch (error) {
      this.#recordDiagnostic("THEME", error, spec.assetId);
      return false;
    }
  }

  #stopThemePlayback(fadeDuration) {
    if (this.#themePlayback === null) {
      return;
    }
    const playback = this.#themePlayback;
    this.#themePlayback = null;
    playback.source.onended = null;
    const currentTime = this.#context?.currentTime ?? 0;
    if (fadeDuration > 0) {
      try {
        playback.gainNode.gain.cancelScheduledValues(currentTime);
        playback.gainNode.gain.setValueAtTime(
          Math.max(0.0001, playback.gainNode.gain.value),
          currentTime
        );
        playback.gainNode.gain.linearRampToValueAtTime(0.0001, currentTime + fadeDuration);
      } catch (error) {
        setImmediateGain(playback.gainNode, 0);
      }
    }
    stopSource(playback.source, currentTime + fadeDuration);
  }

  async #resumeContext() {
    try {
      if (this.#context !== null && this.#context.state !== "running") {
        await this.#context.resume();
      }
      if (this.#themePlayback === null && this.#queuedThemeId !== null) {
        this.#requestTheme(this.#queuedThemeId);
      }
      return true;
    } catch (error) {
      this.#recordDiagnostic("RESUME", error);
      return false;
    }
  }

  #playCue(sessionId, descriptor, handle) {
    if (!handle.active || !this.#isSessionActive(sessionId)) {
      return;
    }
    const withCry = descriptor.withCry === true;
    const baseDelay = Number.isFinite(descriptor.delay) && descriptor.delay >= 0
      ? descriptor.delay
      : 0;
    if (descriptor.cueId === AudioCueId.MOVE_STEP) {
      this.#playMove(sessionId, handle, baseDelay);
      return;
    }
    if (descriptor.cueId === AudioCueId.CONFUSION_CAST) {
      this.#playStrategyCast(sessionId, handle, baseDelay);
      return;
    }
    if (descriptor.cueId === AudioCueId.ILLUSION_CAST) {
      this.#playIllusionCast(sessionId, handle, baseDelay);
      return;
    }
    if (descriptor.cueId === AudioCueId.CONFIRM) {
      this.#tone(sessionId, handle, 392, 0.08, "triangle", 0.22, baseDelay);
      this.#tone(sessionId, handle, 587.33, 0.12, "triangle", 0.22, baseDelay + 0.07);
      return;
    }
    if (descriptor.cueId === AudioCueId.FAILURE) {
      this.#tone(sessionId, handle, 293.66, 0.30, "sawtooth", 0.25, baseDelay);
      this.#tone(sessionId, handle, 220, 0.38, "sawtooth", 0.27, baseDelay + 0.19);
      this.#tone(sessionId, handle, 146.83, 0.56, "sine", 0.32, baseDelay + 0.40);
      return;
    }
    if (descriptor.cueId === AudioCueId.NORMAL_ATTACK) {
      if (withCry) {
        this.#playBattleCry(sessionId, handle, baseDelay);
      }
      this.#playAsset(
        sessionId,
        handle,
        AudioAssetId.SWORD_CLASH,
        { gain: 0.92, delay: baseDelay + (withCry ? 0.18 : 0.025) }
      );
      return;
    }
    if (descriptor.cueId === AudioCueId.PLAYER_BOW) {
      this.#playAsset(
        sessionId,
        handle,
        AudioAssetId.PLAYER_BOW,
        { gain: 0.90, delay: baseDelay }
      );
      return;
    }
    if (descriptor.cueId === AudioCueId.ENEMY_BOW) {
      this.#playAsset(
        sessionId,
        handle,
        AudioAssetId.ENEMY_BOW,
        { gain: 0.90, delay: baseDelay }
      );
      return;
    }
    if (descriptor.cueId === AudioCueId.CHARGE) {
      if (withCry) {
        this.#playBattleCry(sessionId, handle, baseDelay);
        this.#playAsset(
          sessionId,
          handle,
          AudioAssetId.CHARGE_RUMBLE,
          { gain: 1, delay: baseDelay, exclusiveKey: "charge_rumble" }
        );
      }
      this.#tone(sessionId, handle, 92, 0.22, "sawtooth", 0.27, baseDelay + (withCry ? 0.10 : 0.01));
      this.#tone(sessionId, handle, 138, 0.18, "square", 0.16, baseDelay + (withCry ? 0.14 : 0.07));
      this.#playAsset(
        sessionId,
        handle,
        AudioAssetId.SWORD_CLASH,
        { gain: 0.92, delay: baseDelay + (withCry ? 0.20 : 0.16) }
      );
      return;
    }

    const assetSpecs = {
      [AudioCueId.PHASE_GONG]: {
        assetId: AudioAssetId.TURN_GONG,
        gain: 0.92,
        duckDuration: 3.55
      },
      [AudioCueId.TRAP_DAMAGE]: {
        assetId: AudioAssetId.TRAP_DAMAGE,
        gain: 0.92
      },
      [AudioCueId.CONFUSION_SUCCESS]: {
        assetId: AudioAssetId.CONFUSION_SUCCESS,
        gain: 0.92,
        exclusiveKey: "confusion_success"
      },
      [AudioCueId.ILLUSION_SUCCESS]: {
        assetId: AudioAssetId.ILLUSION_SUCCESS,
        gain: 0.92
      },
      [AudioCueId.WIDE_ILLUSION_START]: {
        assetId: AudioAssetId.WIDE_ILLUSION_START,
        gain: 0.92,
        exclusiveKey: "wide_illusion_start"
      },
      [AudioCueId.FIRE_CAST]: {
        assetId: AudioAssetId.FIRE_CAST,
        gain: 1.15,
        exclusiveKey: "fire_cast"
      },
      [AudioCueId.FIRE_DAMAGE]: {
        assetId: AudioAssetId.FIRE_DAMAGE,
        gain: 0.92,
        exclusiveKey: "fire_damage"
      },
      [AudioCueId.WATER_CAST]: {
        assetId: AudioAssetId.WATER_CAST,
        gain: 1.38,
        exclusiveKey: "water_cast"
      },
      [AudioCueId.WATER_DAMAGE]: {
        assetId: AudioAssetId.WATER_DAMAGE,
        gain: 0.92,
        exclusiveKey: "water_damage"
      }
    };
    const spec = assetSpecs[descriptor.cueId];
    if (spec === undefined) {
      return;
    }
    if (spec.duckDuration !== undefined) {
      this.#duckTheme(spec.duckDuration);
    }
    this.#playAsset(sessionId, handle, spec.assetId, {
      ...spec,
      delay: baseDelay + (spec.delay ?? 0)
    });
  }

  async #playAsset(sessionId, handle, assetId, {
    gain = 0.92,
    delay = 0,
    exclusiveKey = null
  } = {}) {
    try {
      const buffer = await this.#ensureAsset(assetId);
      if (
        !handle.active
        || !this.#enabled
        || this.#backgroundSuspended
        || this.#context === null
        || !this.#isSessionActive(sessionId)
      ) {
        return;
      }
      const session = this.#sessions.get(sessionId);
      if (exclusiveKey !== null) {
        const previous = session.exclusiveSources.get(exclusiveKey) ?? null;
        if (previous !== null) {
          stopSource(previous, this.#context.currentTime);
        }
      }
      const source = this.#context.createBufferSource();
      const gainNode = this.#context.createGain();
      source.buffer = buffer;
      gainNode.gain.value = gain;
      source.connect(gainNode);
      gainNode.connect(this.#se);
      session.sources.add(source);
      if (exclusiveKey !== null) {
        session.exclusiveSources.set(exclusiveKey, source);
      }
      handle.addSource(source, this.#context);
      source.onended = () => {
        session.sources.delete(source);
        if (exclusiveKey !== null && session.exclusiveSources.get(exclusiveKey) === source) {
          session.exclusiveSources.delete(exclusiveKey);
        }
      };
      source.start(this.#context.currentTime + delay);
    } catch (error) {
      this.#recordDiagnostic("CUE", error, assetId);
    }
  }

  #playMove(sessionId, handle, delay = 0) {
    if (this.#context === null) {
      return;
    }
    const time = this.#context.currentTime + delay;
    const variation = this.#footstepIndex % 3;
    this.#footstepIndex += 1;
    this.#duckTheme(0.12);
    const source = this.#context.createBufferSource();
    const bandpass = this.#context.createBiquadFilter();
    const highpass = this.#context.createBiquadFilter();
    const gainNode = this.#context.createGain();
    source.buffer = this.#noiseBuffer(0.105);
    bandpass.type = "bandpass";
    bandpass.frequency.setValueAtTime(1450 + variation * 120, time);
    bandpass.frequency.exponentialRampToValueAtTime(520 + variation * 45, time + 0.095);
    bandpass.Q.value = 0.58;
    highpass.type = "highpass";
    highpass.frequency.value = 260;
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(0.42, time + 0.004);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.105);
    source.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(gainNode);
    gainNode.connect(this.#se);
    this.#startSessionSource(sessionId, handle, source, time);

    const body = this.#context.createOscillator();
    const bodyGain = this.#context.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(185 + variation * 12, time);
    body.frequency.exponentialRampToValueAtTime(105, time + 0.075);
    bodyGain.gain.setValueAtTime(0.11, time);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.082);
    body.connect(bodyGain);
    bodyGain.connect(this.#se);
    this.#startSessionSource(sessionId, handle, body, time, time + 0.09);
  }

  #playStrategyCast(sessionId, handle, delay = 0) {
    if (this.#context === null) {
      return;
    }
    const time = this.#context.currentTime + delay;
    this.#duckTheme(1.05);
    const sweep = this.#context.createOscillator();
    const filter = this.#context.createBiquadFilter();
    const gainNode = this.#context.createGain();
    sweep.type = "sawtooth";
    sweep.frequency.setValueAtTime(440, time);
    sweep.frequency.exponentialRampToValueAtTime(92, time + 0.82);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(2100, time);
    filter.frequency.exponentialRampToValueAtTime(420, time + 0.82);
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(0.24, time + 0.045);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.86);
    sweep.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.#se);
    this.#startSessionSource(sessionId, handle, sweep, time, time + 0.90);
    [392, 329.63, 261.63, 196].forEach((frequency, index) => {
      this.#tone(sessionId, handle, frequency, 0.32, "triangle", 0.17, delay + index * 0.085);
    });
  }

  #playIllusionCast(sessionId, handle, delay = 0) {
    if (this.#context === null) {
      return;
    }
    const time = this.#context.currentTime + delay;
    this.#duckTheme(1.35);
    const bus = this.#context.createGain();
    const filter = this.#context.createBiquadFilter();
    bus.gain.value = 0.72;
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1850, time);
    filter.frequency.exponentialRampToValueAtTime(430, time + 1.20);
    filter.Q.value = 0.78;
    bus.connect(filter);
    filter.connect(this.#se);

    [[246.94, -18], [261.63, 18], [369.99, -9], [523.25, 11]]
      .forEach(([frequency, detune], index) => {
        const oscillator = this.#context.createOscillator();
        const gainNode = this.#context.createGain();
        oscillator.type = index < 2 ? "sawtooth" : "triangle";
        oscillator.frequency.setValueAtTime(frequency, time);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.54, time + 1.18);
        oscillator.detune.setValueAtTime(detune, time);
        oscillator.detune.linearRampToValueAtTime(-detune, time + 1.18);
        gainNode.gain.setValueAtTime(0.0001, time);
        gainNode.gain.linearRampToValueAtTime(0.20 / (1 + index * 0.24), time + 0.055 + index * 0.018);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 1.18);
        oscillator.connect(gainNode);
        gainNode.connect(bus);
        this.#startSessionSource(sessionId, handle, oscillator, time, time + 1.22);
      });

    const breath = this.#context.createBufferSource();
    const breathFilter = this.#context.createBiquadFilter();
    const breathGain = this.#context.createGain();
    breath.buffer = this.#noiseBuffer(1.08);
    breathFilter.type = "bandpass";
    breathFilter.frequency.setValueAtTime(3400, time);
    breathFilter.frequency.exponentialRampToValueAtTime(530, time + 1.04);
    breathFilter.Q.value = 0.65;
    breathGain.gain.setValueAtTime(0.0001, time);
    breathGain.gain.linearRampToValueAtTime(0.24, time + 0.11);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, time + 1.08);
    breath.connect(breathFilter);
    breathFilter.connect(breathGain);
    breathGain.connect(this.#se);
    this.#startSessionSource(sessionId, handle, breath, time);
    this.#tone(sessionId, handle, 1046.50, 0.55, "sine", 0.14, delay + 0.10);
    this.#tone(sessionId, handle, 783.99, 0.70, "sine", 0.12, delay + 0.27);
    this.#tone(sessionId, handle, 523.25, 0.86, "sine", 0.11, delay + 0.43);
  }

  #playBattleCry(sessionId, handle, delay = 0) {
    if (this.#context === null) {
      return;
    }
    const time = this.#context.currentTime + delay;
    this.#vocalSyllable(sessionId, handle, time, 195, 150, 0.22, [520, 1850, 2850]);
    this.#vocalSyllable(sessionId, handle, time + 0.20, 165, 112, 0.34, [820, 1250, 2650]);
    const source = this.#context.createBufferSource();
    const filter = this.#context.createBiquadFilter();
    const gainNode = this.#context.createGain();
    source.buffer = this.#noiseBuffer(0.58);
    filter.type = "bandpass";
    filter.frequency.value = 2100;
    filter.Q.value = 0.7;
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(0.20, time + 0.035);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + 0.58);
    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.#se);
    this.#startSessionSource(sessionId, handle, source, time);
  }

  #vocalSyllable(sessionId, handle, time, startFrequency, endFrequency, duration, formants) {
    const carrier = this.#context.createOscillator();
    const carrierGain = this.#context.createGain();
    carrier.type = "sawtooth";
    carrier.frequency.setValueAtTime(startFrequency, time);
    carrier.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
    carrierGain.gain.setValueAtTime(0.0001, time);
    carrierGain.gain.linearRampToValueAtTime(0.34, time + 0.025);
    carrierGain.gain.setValueAtTime(0.28, time + duration * 0.55);
    carrierGain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    carrier.connect(carrierGain);
    formants.forEach((frequency, index) => {
      const filter = this.#context.createBiquadFilter();
      const gainNode = this.#context.createGain();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(frequency, time);
      filter.Q.value = index === 0 ? 5.5 : 7.5;
      gainNode.gain.value = [0.82, 0.44, 0.23][index];
      carrierGain.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(this.#se);
    });
    this.#startSessionSource(
      sessionId,
      handle,
      carrier,
      time,
      time + duration + 0.03
    );
  }

  #tone(sessionId, handle, frequency, duration, type, volume, delay) {
    if (this.#context === null || !handle.active || !this.#isSessionActive(sessionId)) {
      return;
    }
    const time = this.#context.currentTime + delay;
    const oscillator = this.#context.createOscillator();
    const gainNode = this.#context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gainNode.gain.setValueAtTime(0.0001, time);
    gainNode.gain.linearRampToValueAtTime(volume, time + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    oscillator.connect(gainNode);
    gainNode.connect(this.#se);
    this.#startSessionSource(
      sessionId,
      handle,
      oscillator,
      time,
      time + duration + 0.03
    );
  }

  #noiseBuffer(duration) {
    const length = Math.max(1, Math.floor(this.#context.sampleRate * duration));
    const buffer = this.#context.createBuffer(1, length, this.#context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length);
    }
    return buffer;
  }

  #startSessionSource(sessionId, handle, source, startTime, stopTime = null) {
    const session = this.#sessions.get(sessionId);
    if (session?.active !== true || !handle.active) {
      return;
    }
    session.sources.add(source);
    handle.addSource(source, this.#context);
    source.onended = () => {
      session.sources.delete(source);
    };
    source.start(startTime);
    if (stopTime !== null) {
      source.stop(stopTime);
    }
  }

  #duckTheme(duration) {
    if (this.#context === null || this.#themePlayback === null) {
      return;
    }
    const { gainNode, targetGain } = this.#themePlayback;
    const time = this.#context.currentTime;
    try {
      gainNode.gain.cancelScheduledValues(time);
      gainNode.gain.setValueAtTime(gainNode.gain.value, time);
      gainNode.gain.linearRampToValueAtTime(Math.min(0.16, targetGain), time + 0.018);
      gainNode.gain.linearRampToValueAtTime(targetGain, time + duration);
    } catch (error) {
      // AudioParamのschedule拒否は効果音再生を止めない。
    }
  }

  #isSessionActive(sessionId) {
    return this.#sessions.get(sessionId)?.active === true;
  }

  #recordDiagnostic(stage, error, assetId = null) {
    this.#diagnostics.push({
      stage,
      assetId,
      message: error?.message ?? String(error)
    });
  }
}
