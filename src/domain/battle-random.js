import { invariant } from "../core/domain-error.js";

const ZERO_SEED_REPLACEMENT = 0x6d2b79f5;

/**
 * 戦闘結果専用の再現可能なxorshift32乱数。UI・音声用乱数とは共有しない。
 */
export class BattleRandom {
  #state;

  constructor(seed = BattleRandom.createSeed()) {
    this.algorithm = "xorshift32";
    this.#state = 1;
    this.reseed(seed);
  }

  static createSeed() {
    if (
      globalThis.crypto !== undefined
      && typeof globalThis.crypto.getRandomValues === "function"
    ) {
      const values = new Uint32Array(1);
      globalThis.crypto.getRandomValues(values);
      if (values[0] !== 0) {
        return values[0];
      }
    }

    const performancePart = Math.floor((globalThis.performance?.now?.() ?? 0) * 1000);
    const timeSeed = (Date.now() ^ performancePart) >>> 0;
    return timeSeed === 0 ? ZERO_SEED_REPLACEMENT : timeSeed;
  }

  reseed(seed = BattleRandom.createSeed()) {
    const normalized = Number(seed) >>> 0;
    this.#state = normalized === 0 ? ZERO_SEED_REPLACEMENT : normalized;
  }

  next() {
    let value = this.#state >>> 0;
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    this.#state = value >>> 0;
    return this.#state / 0x100000000;
  }

  exportState() {
    return Object.freeze({ algorithm: this.algorithm, state: this.#state >>> 0 });
  }

  importState(savedState) {
    invariant(
      savedState !== null
      && typeof savedState === "object"
      && savedState.algorithm === this.algorithm
      && Number.isInteger(savedState.state)
      && savedState.state >= 1
      && savedState.state <= 0xffffffff,
      "RANDOM_STATE_INVALID"
    );
    this.#state = savedState.state >>> 0;
  }
}
