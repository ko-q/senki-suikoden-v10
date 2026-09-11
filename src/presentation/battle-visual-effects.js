import { ActionType } from "../core/action-request.js";
import { invariant } from "../core/domain-error.js";
import {
  PresentationRequestType,
  validatePresentationRequest
} from "../core/presentation-request.js";
import { Position } from "../domain/position.js";
import { Stage } from "../domain/stage.js";
import { UnitStatus } from "../domain/unit.js";
import { hasClearLineOfSight, manhattanDistance } from "../services/action-targeting-rules.js";
import {
  BattleVisualAssetId,
  DEFAULT_BATTLE_VISUAL_ASSET_URLS,
  requireBattleVisualAssetCatalog
} from "./battle-visual-assets.js";

export const V9_BATTLE_VISUAL_TIMING = Object.freeze({
  MOVE_STEP_MS: 80,
  BOW_PROJECTILE_MS: 230,
  BOW_SEQUENCE_END_PADDING_MS: 250,
  STRATEGY_CAST_FLASH_MS: 140,
  UNIT_FLASH_MS: 480,
  DAMAGE_POPUP_MS: 780,
  CHARGE_DUST_MS: 1440,
  CHARGE_IMPACT_MOB_MS: 160,
  CHARGE_IMPACT_NAMED_MS: 200,
  NORMAL_ILLUSION_SKULL_MS: 720,
  CONFUSION_SYMBOL_MS: 720,
  FIRE_TACTIC_BURST_MS: 1440,
  WATER_TACTIC_BURST_MS: 960,
  WIDE_ILLUSION_OVERLAY_MS: 2240
});

const TACTIC_LEVELS = Object.freeze({
  [ActionType.CONFUSION_LV1]: 1,
  [ActionType.CONFUSION_LV2]: 2,
  [ActionType.CONFUSION_LV3]: 3,
  [ActionType.ILLUSION]: 1,
  [ActionType.WIDE_ILLUSION]: 4,
  [ActionType.FIRE]: 2,
  [ActionType.WATER]: 2
});

const PLAYER_BOW_TIMINGS_SECONDS = Object.freeze([0, 0.153, 0.25, 0.32]);
const ENEMY_BOW_TIMINGS_SECONDS = Object.freeze([0, 0.06, 0.22, 0.277]);
const BOW_LANE_OFFSETS = Object.freeze([-4, 2, -1, 4]);

function createAbortError() {
  const error = new Error("BATTLE_VISUAL_EFFECT_ABORTED");
  error.name = "AbortError";
  return error;
}

function requireElementMethod(element, methodName, code) {
  invariant(element !== null && typeof element === "object", code);
  invariant(typeof element[methodName] === "function", code, { methodName });
}

function requireDurationOverride(durationOverride) {
  invariant(
    durationOverride === undefined
      || (Number.isInteger(durationOverride) && durationOverride >= 0),
    "BATTLE_VISUAL_DURATION_OVERRIDE_INVALID"
  );
  return durationOverride;
}

function setStyleProperty(style, propertyName, value) {
  if (typeof style.setProperty === "function") {
    style.setProperty(propertyName, value);
    return;
  }
  style[propertyName] = value;
}

function finiteGeometryValue(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function statusTurns(statusEffects, statusType) {
  if (!Array.isArray(statusEffects)) {
    return 0;
  }
  return statusEffects.find((effect) => effect.type === statusType)?.remainingTurns ?? 0;
}

function uniqueStatusEntries(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    const key = `${entry.unitId}:${entry.statusType}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * v9互換の戦闘画像演出をBattle単位で所有する。Domain更新と乱数には触れない。
 */
export class BattleVisualEffectSession {
  #stage;
  #board;
  #effectLayer;
  #assetUrls;
  #elements;
  #timers;
  #disposeAbortController;
  #disposed;

  constructor({
    stage,
    board,
    effectLayer,
    assetUrls = DEFAULT_BATTLE_VISUAL_ASSET_URLS
  }) {
    invariant(stage instanceof Stage, "BATTLE_VISUAL_STAGE_REQUIRED");
    requireElementMethod(board, "append", "BATTLE_VISUAL_BOARD_INVALID");
    requireElementMethod(effectLayer, "append", "BATTLE_VISUAL_LAYER_INVALID");
    this.#stage = stage;
    this.#board = board;
    this.#effectLayer = effectLayer;
    this.#assetUrls = requireBattleVisualAssetCatalog(assetUrls);
    this.#elements = new Set();
    this.#timers = new Set();
    this.#disposeAbortController = new AbortController();
    this.#disposed = false;
  }

  /**
   * 対応する意味的要求だけを描画する。未対応ならfalseを返し、呼出側の汎用待機へ委ねる。
   */
  async present(request, abortSignal, durationOverride = undefined) {
    validatePresentationRequest(request);
    invariant(abortSignal instanceof AbortSignal, "BATTLE_VISUAL_ABORT_SIGNAL_REQUIRED");
    requireDurationOverride(durationOverride);
    this.#throwIfUnavailable(abortSignal);

    if (request.type === PresentationRequestType.MOVE) {
      await this.#showMove(request.payload, abortSignal, durationOverride);
      return true;
    }
    if (request.type === PresentationRequestType.ACTION) {
      return this.#presentAction(request.payload, abortSignal, durationOverride);
    }
    if (request.type === PresentationRequestType.DAMAGE) {
      await this.#showDamage(request.payload, abortSignal, durationOverride);
      return true;
    }
    if (request.type === PresentationRequestType.STATUS) {
      return this.#showStatus(request.payload, abortSignal, durationOverride);
    }
    return false;
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    this.#disposeAbortController.abort();
    for (const timerId of this.#timers) {
      clearTimeout(timerId);
    }
    this.#timers.clear();
    for (const element of [...this.#elements]) {
      this.#removeElement(element);
    }
  }

  async #presentAction(payload, abortSignal, durationOverride) {
    const actionType = payload.actionType;
    if (actionType === ActionType.BOW_ATTACK) {
      await this.#showBow(payload, abortSignal, durationOverride);
      return true;
    }
    if (actionType === ActionType.CHARGE) {
      await this.#showCharge(payload, abortSignal, durationOverride);
      return true;
    }
    if (actionType === ActionType.FIRE || actionType === ActionType.WATER) {
      await this.#showElementalCast(payload, abortSignal, durationOverride);
      return true;
    }
    if (actionType === ActionType.WIDE_ILLUSION) {
      await this.#showWideIllusion(payload, abortSignal, durationOverride);
      return true;
    }
    if (Object.hasOwn(TACTIC_LEVELS, actionType)) {
      await this.#showStrategyFlash(payload, abortSignal, durationOverride);
      return true;
    }
    return false;
  }

  async #showMove(payload, abortSignal, durationOverride) {
    const duration = durationOverride ?? V9_BATTLE_VISUAL_TIMING.MOVE_STEP_MS;
    const fromCell = this.#cellAt(payload.from);
    const toCell = this.#cellAt(payload.to);
    const token = this.#unitToken(toCell, payload.unitId);
    if (fromCell === null || toCell === null || token === null) {
      await this.#wait(duration, abortSignal);
      return;
    }

    const from = this.#geometryForCell(fromCell);
    const to = this.#geometryForCell(toCell);
    const clone = token.cloneNode(true);
    clone.classList.add("battle-effect-unit", "battle-effect-unit-move");
    clone.setAttribute("aria-hidden", "true");
    this.#placeUnitClone(clone, to);
    setStyleProperty(clone.style, "--move-from-x", `${from.centerX - to.centerX}px`);
    setStyleProperty(clone.style, "--move-from-y", `${from.centerY - to.centerY}px`);
    clone.style.animationDuration = `${duration}ms`;
    const previousVisibility = token.style.visibility ?? "";
    token.style.visibility = "hidden";
    this.#appendElement(clone);

    try {
      await this.#wait(duration, abortSignal);
    } finally {
      token.style.visibility = previousVisibility;
      this.#removeElement(clone);
    }
  }

  async #showBow(payload, abortSignal, durationOverride) {
    const actorCell = this.#cellAt(payload.actorPosition);
    const targetCell = this.#cellAt(payload.targetPosition);
    if (actorCell === null || targetCell === null) {
      await this.#wait(durationOverride ?? V9_BATTLE_VISUAL_TIMING.BOW_SEQUENCE_END_PADDING_MS, abortSignal);
      return;
    }

    const actor = this.#geometryForCell(actorCell);
    const target = this.#geometryForCell(targetCell);
    const deltaX = target.centerX - actor.centerX;
    const deltaY = target.centerY - actor.centerY;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 1) {
      await this.#wait(durationOverride ?? 0, abortSignal);
      return;
    }

    const enemy = payload.actorAffiliation === "ENEMY";
    const timings = enemy ? ENEMY_BOW_TIMINGS_SECONDS : PLAYER_BOW_TIMINGS_SECONDS;
    const sequenceDuration = durationOverride ?? (
      Math.round(timings[timings.length - 1] * 1000)
      + V9_BATTLE_VISUAL_TIMING.BOW_SEQUENCE_END_PADDING_MS
    );
    const projectileDuration = durationOverride === undefined
      ? V9_BATTLE_VISUAL_TIMING.BOW_PROJECTILE_MS
      : durationOverride;
    const perpendicularX = -deltaY / distance;
    const perpendicularY = deltaX / distance;
    const angle = Math.atan2(deltaY, deltaX);
    const lineLength = Math.max(22, Math.min(38, distance * 0.34));
    const travelDistance = Math.max(0, distance - lineLength * 0.35);
    const lines = [];

    for (let index = 0; index < timings.length; index += 1) {
      const line = this.#createElement("div");
      const laneOffset = BOW_LANE_OFFSETS[index];
      const delay = durationOverride === undefined ? Math.round(timings[index] * 1000) : 0;
      line.className = "bow-shot-line";
      line.setAttribute("aria-hidden", "true");
      line.style.left = `${actor.centerX + perpendicularX * laneOffset}px`;
      line.style.top = `${actor.centerY + perpendicularY * laneOffset}px`;
      line.style.width = `${lineLength}px`;
      line.style.animationDelay = `${delay}ms`;
      line.style.animationDuration = `${projectileDuration}ms`;
      setStyleProperty(line.style, "--bow-shot-angle", `${angle}rad`);
      setStyleProperty(line.style, "--bow-shot-travel", `${travelDistance}px`);
      this.#appendElement(line);
      lines.push(line);
    }

    try {
      await this.#wait(sequenceDuration, abortSignal);
    } finally {
      for (const line of lines) {
        this.#removeElement(line);
      }
    }
  }

  async #showCharge(payload, abortSignal, durationOverride) {
    const cell = this.#cellAt(payload.targetPosition);
    if (cell === null) {
      await this.#wait(durationOverride ?? 0, abortSignal);
      return;
    }
    const geometry = this.#geometryForCell(cell);
    const effect = this.#createImage(
      "charge-dust-effect",
      BattleVisualAssetId.CHARGE_DUST
    );
    this.#placeRect(effect, geometry.left, geometry.top, geometry.width, geometry.height);
    this.#appendElement(effect);

    const dustDuration = durationOverride ?? V9_BATTLE_VISUAL_TIMING.CHARGE_DUST_MS;
    this.#scheduleRemoval(effect, dustDuration, abortSignal);
    const impactDuration = durationOverride ?? (
      payload.actorIsMob === true
        ? V9_BATTLE_VISUAL_TIMING.CHARGE_IMPACT_MOB_MS
        : V9_BATTLE_VISUAL_TIMING.CHARGE_IMPACT_NAMED_MS
    );
    await this.#wait(impactDuration, abortSignal);
  }

  async #showElementalCast(payload, abortSignal, durationOverride) {
    if (durationOverride !== undefined) {
      const elements = [
        ...this.#createElementalBurst(payload),
        ...this.#createStrategyFlashElements(payload)
      ];
      await this.#waitAndRemove(elements, durationOverride, abortSignal);
      return;
    }

    const burstDuration = payload.actionType === ActionType.FIRE
      ? V9_BATTLE_VISUAL_TIMING.FIRE_TACTIC_BURST_MS
      : V9_BATTLE_VISUAL_TIMING.WATER_TACTIC_BURST_MS;
    await this.#waitAndRemove(this.#createElementalBurst(payload), burstDuration, abortSignal);
    await this.#waitAndRemove(
      this.#createStrategyFlashElements(payload),
      V9_BATTLE_VISUAL_TIMING.STRATEGY_CAST_FLASH_MS,
      abortSignal
    );
  }

  #createElementalBurst(payload) {
    const cell = this.#cellAt(payload.targetPosition);
    if (cell === null) {
      return [];
    }
    const geometry = this.#geometryForCell(cell);
    const fire = payload.actionType === ActionType.FIRE;
    const effect = this.#createImage(
      fire ? "fire-tactic-burst-effect" : "water-tactic-burst-effect",
      fire ? BattleVisualAssetId.FIRE_TACTIC_BURST : BattleVisualAssetId.WATER_TACTIC_BURST
    );
    const width = geometry.width * (fire ? 2.25 : 2.9375);
    const height = geometry.height * (fire ? 2.25 : 2.15);
    this.#placeCentered(effect, geometry.centerX, geometry.centerY, width, height);
    this.#appendElement(effect);
    return [effect];
  }

  async #showWideIllusion(payload, abortSignal, durationOverride) {
    if (durationOverride !== undefined) {
      const elements = [
        ...this.#createWideIllusionElements(payload),
        ...this.#createStrategyFlashElements(payload)
      ];
      await this.#waitAndRemove(elements, durationOverride, abortSignal);
      return;
    }

    await this.#waitAndRemove(
      this.#createWideIllusionElements(payload),
      V9_BATTLE_VISUAL_TIMING.WIDE_ILLUSION_OVERLAY_MS,
      abortSignal
    );
    await this.#waitAndRemove(
      this.#createStrategyFlashElements(payload),
      V9_BATTLE_VISUAL_TIMING.STRATEGY_CAST_FLASH_MS,
      abortSignal
    );
  }

  #createWideIllusionElements(payload) {
    const cell = this.#cellAt(payload.actorPosition);
    if (cell === null) {
      return [];
    }
    const geometry = this.#geometryForCell(cell);
    const overlay = this.#createElement("div");
    overlay.className = "wide-illusion-overlay";
    overlay.setAttribute("aria-hidden", "true");
    this.#placeRect(
      overlay,
      geometry.left - geometry.width * 3,
      geometry.top - geometry.height * 3,
      geometry.width * 7,
      geometry.height * 7
    );
    const mist = this.#createImage(
      "wide-illusion-mist",
      BattleVisualAssetId.WIDE_ILLUSION_MIST
    );
    const skeleton = this.#createImage(
      "wide-illusion-skeleton",
      BattleVisualAssetId.WIDE_ILLUSION_SKELETON
    );
    overlay.append(mist, skeleton);
    this.#appendElement(overlay);
    return [overlay];
  }

  async #showStrategyFlash(payload, abortSignal, durationOverride) {
    const duration = durationOverride ?? V9_BATTLE_VISUAL_TIMING.STRATEGY_CAST_FLASH_MS;
    await this.#waitAndRemove(
      this.#createStrategyFlashElements(payload),
      duration,
      abortSignal
    );
  }

  #createStrategyFlashElements(payload) {
    const elements = [];
    for (const position of this.#strategyPositions(payload)) {
      const cell = this.#cellAt(position);
      if (cell === null) {
        continue;
      }
      const geometry = this.#geometryForCell(cell);
      const effect = this.#createElement("div");
      effect.className = "strategy-cast-cell-flash";
      effect.setAttribute("aria-hidden", "true");
      this.#placeRect(effect, geometry.left, geometry.top, geometry.width, geometry.height);
      this.#appendElement(effect);
      elements.push(effect);
    }
    return elements;
  }

  #strategyPositions(payload) {
    const level = TACTIC_LEVELS[payload.actionType] ?? 1;
    const centerValue = payload.actionType === ActionType.WIDE_ILLUSION
      ? payload.actorPosition
      : payload.targetPosition;
    if (centerValue === null || centerValue === undefined || payload.actorPosition === null) {
      return [];
    }
    const center = Position.from(centerValue);
    const actorPosition = Position.from(payload.actorPosition);
    const radius = Math.max(0, level - 1);
    const positions = [];
    for (let y = 0; y < this.#stage.map.height; y += 1) {
      for (let x = 0; x < this.#stage.map.width; x += 1) {
        const position = new Position(x, y);
        const cell = this.#stage.map.getCellAt(x, y);
        if (
          manhattanDistance(center, position) <= radius
          && cell.terrain.id !== "wall"
          && hasClearLineOfSight(this.#stage, actorPosition, position)
        ) {
          positions.push(position);
        }
      }
    }
    return positions;
  }

  async #showDamage(payload, abortSignal, durationOverride) {
    const entries = Array.isArray(payload.entries)
      ? payload.entries.filter((entry) => Number.isFinite(entry.damage) && entry.damage > 0)
      : [];
    const elements = [];
    const flashType = payload.operationType === ActionType.FIRE
      ? "fire"
      : payload.operationType === ActionType.WATER
        ? "water"
        : "hit";
    for (const entry of entries) {
      const popup = this.#createDamagePopup(entry);
      if (popup !== null) {
        elements.push(popup);
      }
      const flash = this.#createUnitFlash(entry, flashType, 1);
      if (flash !== null) {
        elements.push(flash);
      }
    }
    const duration = durationOverride ?? V9_BATTLE_VISUAL_TIMING.DAMAGE_POPUP_MS;
    await this.#waitAndRemove(elements, duration, abortSignal);
  }

  #createDamagePopup(entry) {
    const cell = this.#cellAt(entry.position);
    if (cell === null) {
      return null;
    }
    const geometry = this.#geometryForCell(cell);
    const popup = this.#createElement("div");
    popup.className = "damage-popup";
    popup.textContent = String(Math.max(0, Math.round(entry.damage)));
    popup.setAttribute("aria-hidden", "true");
    popup.style.left = `${geometry.centerX}px`;
    popup.style.top = `${geometry.top + geometry.height * 0.58}px`;
    popup.style.width = `${geometry.width}px`;
    this.#appendElement(popup);
    return popup;
  }

  async #showStatus(payload, abortSignal, durationOverride) {
    const entries = this.#statusEntries(payload);
    if (entries.length === 0) {
      return false;
    }

    const elements = [];
    let longestDuration = 0;
    for (const entry of entries) {
      const repetitions = entry.effectTurns >= 2 ? 2 : 1;
      const flashType = entry.statusType === UnitStatus.ILLUSION ? "illusion" : "confusion";
      const flash = this.#createUnitFlash(entry, flashType, repetitions);
      if (flash !== null) {
        elements.push(flash);
      }
      longestDuration = Math.max(
        longestDuration,
        V9_BATTLE_VISUAL_TIMING.UNIT_FLASH_MS * repetitions
      );

      if (entry.statusType === UnitStatus.CONFUSED) {
        const symbol = this.#createConfusionSymbol(entry);
        if (symbol !== null) {
          elements.push(symbol);
        }
        longestDuration = Math.max(
          longestDuration,
          V9_BATTLE_VISUAL_TIMING.CONFUSION_SYMBOL_MS
        );
      } else if (
        entry.statusType === UnitStatus.ILLUSION
        && payload.reason !== ActionType.WIDE_ILLUSION
      ) {
        const skull = this.#createIllusionSkull(entry);
        if (skull !== null) {
          elements.push(skull);
        }
        longestDuration = Math.max(
          longestDuration,
          V9_BATTLE_VISUAL_TIMING.NORMAL_ILLUSION_SKULL_MS
        );
      }
    }

    await this.#waitAndRemove(
      elements,
      durationOverride ?? longestDuration,
      abortSignal
    );
    return true;
  }

  #statusEntries(payload) {
    if (payload.reason === "PHASE_START") {
      return [];
    }
    if (
      payload.reason === "TRAP"
      && payload.statusChange !== null
      && typeof payload.statusChange === "object"
    ) {
      return [{
        unitId: payload.unitId,
        position: payload.position,
        statusType: payload.statusChange.type,
        effectTurns: payload.statusChange.afterTurns
      }];
    }
    if (!Array.isArray(payload.entries)) {
      return [];
    }

    const entries = [];
    for (const entry of payload.entries) {
      for (const statusType of [UnitStatus.CONFUSED, UnitStatus.ILLUSION]) {
        const beforeTurns = statusTurns(entry.before, statusType);
        const afterTurns = statusTurns(entry.after, statusType);
        if (afterTurns <= beforeTurns) {
          continue;
        }
        entries.push({
          unitId: entry.unitId,
          position: entry.position,
          statusType,
          effectTurns: entry.effectTurns ?? afterTurns
        });
      }
    }
    return uniqueStatusEntries(entries);
  }

  #createConfusionSymbol(entry) {
    const cell = this.#cellAt(entry.position);
    if (cell === null) {
      return null;
    }
    const geometry = this.#geometryForCell(cell);
    const twoTurns = entry.effectTurns >= 2;
    const symbol = this.#createImage(
      "confusion-symbol-effect",
      twoTurns
        ? BattleVisualAssetId.CONFUSION_ALERT
        : BattleVisualAssetId.CONFUSION_QUESTION
    );
    const scale = twoTurns ? 1 : 1.5;
    this.#placeCentered(
      symbol,
      geometry.centerX,
      geometry.centerY,
      geometry.width * scale,
      geometry.height * scale
    );
    setStyleProperty(symbol.style, "--confusion-rise-distance", `${-geometry.height / 2}px`);
    this.#appendElement(symbol);
    return symbol;
  }

  #createIllusionSkull(entry) {
    const cell = this.#cellAt(entry.position);
    if (cell === null) {
      return null;
    }
    const geometry = this.#geometryForCell(cell);
    const skull = this.#createImage(
      "normal-illusion-skull-effect",
      BattleVisualAssetId.NORMAL_ILLUSION_SKULL
    );
    this.#placeCentered(
      skull,
      geometry.centerX,
      geometry.centerY,
      geometry.width * 1.5,
      geometry.height * 1.5
    );
    this.#appendElement(skull);
    return skull;
  }

  #createUnitFlash(entry, effectType, repetitions) {
    const cell = this.#cellAt(entry.position);
    if (cell === null) {
      return null;
    }
    const geometry = this.#geometryForCell(cell);
    const token = this.#unitToken(cell, entry.unitId);
    const flash = token === null ? this.#createElement("div") : token.cloneNode(true);
    flash.classList.add(
      "battle-effect-unit",
      "battle-effect-unit-flash",
      `battle-effect-unit-${effectType}`
    );
    flash.setAttribute("aria-hidden", "true");
    flash.style.animationIterationCount = String(repetitions);
    flash.style.animationDuration = `${V9_BATTLE_VISUAL_TIMING.UNIT_FLASH_MS}ms`;
    this.#placeUnitClone(flash, geometry);
    this.#appendElement(flash);
    return flash;
  }

  #placeUnitClone(element, geometry) {
    const size = Math.min(geometry.width, geometry.height) * 0.62;
    this.#placeCentered(element, geometry.centerX, geometry.centerY, size, size);
  }

  #cellAt(positionValue) {
    if (
      positionValue === null
      || positionValue === undefined
      || !Number.isInteger(positionValue.x)
      || !Number.isInteger(positionValue.y)
    ) {
      return null;
    }
    for (const cell of this.#board.children) {
      if (
        Number(cell.dataset?.x) === positionValue.x
        && Number(cell.dataset?.y) === positionValue.y
      ) {
        return cell;
      }
    }
    return null;
  }

  #unitToken(cell, unitId) {
    if (cell === null) {
      return null;
    }
    for (const child of cell.children) {
      if (child.dataset?.unitId === unitId) {
        return child;
      }
    }
    return null;
  }

  #geometryForCell(cell) {
    const width = finiteGeometryValue(cell.offsetWidth, finiteGeometryValue(cell.clientWidth, 48));
    const height = finiteGeometryValue(cell.offsetHeight, finiteGeometryValue(cell.clientHeight, width));
    const left = Number.isFinite(cell.offsetLeft) ? cell.offsetLeft : Number(cell.dataset.x) * width;
    const top = Number.isFinite(cell.offsetTop) ? cell.offsetTop : Number(cell.dataset.y) * height;
    return Object.freeze({
      left,
      top,
      width,
      height,
      centerX: left + width / 2,
      centerY: top + height / 2
    });
  }

  #createElement(tagName) {
    const ownerDocument = this.#effectLayer.ownerDocument ?? globalThis.document;
    invariant(
      ownerDocument !== null
        && ownerDocument !== undefined
        && typeof ownerDocument.createElement === "function",
      "BATTLE_VISUAL_DOCUMENT_REQUIRED"
    );
    return ownerDocument.createElement(tagName);
  }

  #createImage(className, assetId) {
    const image = this.#createElement("img");
    image.className = className;
    image.src = this.#assetUrls[assetId];
    image.alt = "";
    image.draggable = false;
    image.setAttribute("aria-hidden", "true");
    return image;
  }

  #placeRect(element, left, top, width, height) {
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
    element.style.width = `${width}px`;
    element.style.height = `${height}px`;
  }

  #placeCentered(element, centerX, centerY, width, height) {
    this.#placeRect(element, centerX, centerY, width, height);
  }

  #appendElement(element) {
    this.#effectLayer.append(element);
    this.#elements.add(element);
  }

  #removeElement(element) {
    if (!this.#elements.delete(element)) {
      return;
    }
    element.remove();
  }

  async #waitAndRemove(elements, duration, abortSignal) {
    try {
      await this.#wait(duration, abortSignal);
    } finally {
      for (const element of elements) {
        this.#removeElement(element);
      }
    }
  }

  #scheduleRemoval(element, duration, abortSignal) {
    if (duration === 0) {
      this.#removeElement(element);
      return;
    }
    let timerId = null;
    const disposeSignal = this.#disposeAbortController.signal;
    const cleanup = () => {
      if (timerId !== null) {
        clearTimeout(timerId);
        this.#timers.delete(timerId);
        timerId = null;
      }
      abortSignal.removeEventListener("abort", handleAbort);
      disposeSignal.removeEventListener("abort", handleAbort);
      this.#removeElement(element);
    };
    const handleAbort = () => cleanup();
    timerId = setTimeout(cleanup, duration);
    this.#timers.add(timerId);
    abortSignal.addEventListener("abort", handleAbort, { once: true });
    disposeSignal.addEventListener("abort", handleAbort, { once: true });
  }

  #wait(duration, abortSignal) {
    this.#throwIfUnavailable(abortSignal);
    if (duration === 0) {
      return Promise.resolve();
    }
    const disposeSignal = this.#disposeAbortController.signal;
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback) => {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timerId);
        this.#timers.delete(timerId);
        abortSignal.removeEventListener("abort", handleAbort);
        disposeSignal.removeEventListener("abort", handleAbort);
        callback();
      };
      const handleAbort = () => finish(() => reject(createAbortError()));
      const timerId = setTimeout(() => finish(resolve), duration);
      this.#timers.add(timerId);
      abortSignal.addEventListener("abort", handleAbort, { once: true });
      disposeSignal.addEventListener("abort", handleAbort, { once: true });
    });
  }

  #throwIfUnavailable(abortSignal) {
    if (this.#disposed || this.#disposeAbortController.signal.aborted || abortSignal.aborted) {
      throw createAbortError();
    }
  }
}
