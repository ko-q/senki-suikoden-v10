import { ActionType } from "../core/action-request.js";
import { invariant } from "../core/domain-error.js";
import { PresentationRequestType, validatePresentationRequest } from "../core/presentation-request.js";
import { Stage } from "../domain/stage.js";
import { Affiliation } from "../domain/army.js";
import { UnitAbility } from "../domain/unit-ability.js";
import { CharacterPortraitView } from "./character-portrait-view.js";

// v9.7.75 game.js: actionDialogue / actionLabel / showActionCutIn.
const lines = new Map([
  ["花栄", { bow: "この一矢、外しはしない！" }],
  ["秦明", { charge: "退け！　霹靂火・秦明が押し通る！" }],
  ["林冲", { charge: "豹子頭・林冲、参る！" }],
  ["楊志", { charge: "青面獣の槍、受けてみろ！" }],
  ["呉用", { strategy: "敵の心を乱せ。策はすでに成った。" }],
  ["単廷珪", { water: "水勢を借り、敵陣を崩す！" }],
  ["魏定国", { fire: "炎よ、敵陣を焼き崩せ！" }],
  ["公孫勝", { illusion: "天地の気よ、我が術に応えよ！" }],
  ["高廉", { illusion: "我が妖術から逃れられると思うな！" }]
]);
const defaults = Object.freeze({
  bow: "狙いは定まった。放て！", charge: "全軍、突撃！　一気に押し崩せ！",
  strategy: "敵陣を乱す。今こそ策を放つ！", fire: "炎で敵陣を焼き崩す！",
  water: "水勢で敵陣を押し流す！", illusion: "幻に惑え。もはや敵も味方も見分けられまい！"
});
const kinds = new Map([
  [ActionType.BOW_ATTACK, ["bow", "弓撃"]], [ActionType.CHARGE, ["charge", "突撃"]],
  [ActionType.CONFUSION_LV1, ["strategy", "撹乱"]],
  [ActionType.CONFUSION_LV2, ["strategy", "撹乱"]],
  [ActionType.CONFUSION_LV3, ["strategy", "撹乱"]],
  [ActionType.ILLUSION, ["illusion", "幻術"]],
  [ActionType.WIDE_ILLUSION, ["illusion", "幻術"]],
  [ActionType.FIRE, ["fire", "火計"]], [ActionType.WATER, ["water", "水計"]]
]);
export const V9_ACTION_CUT_IN_TIMING = Object.freeze({
  DISPLAY_MS: 680, GAP_MS: 80, ENEMY_PROJECTILE_GAP_MS: 70, ENEMY_CHARGE_GAP_MS: 0
});

export function getActionCutIn(unit, actionType, affiliation = Affiliation.PLAYER) {
  const definition = kinds.get(actionType);
  if (definition === undefined) return null;
  const [kind, label] = definition;
  const throwOnly = kind === "bow" && unit.hasAbility(UnitAbility.THROW_ATTACK)
    && !unit.hasAbility(UnitAbility.BOW_ATTACK);
  return Object.freeze({
    speaker: unit.character,
    actionLabel: throwOnly ? "投擲" : label,
    gapMs: affiliation === Affiliation.ENEMY && kind === "bow"
      ? V9_ACTION_CUT_IN_TIMING.ENEMY_PROJECTILE_GAP_MS
      : affiliation === Affiliation.ENEMY && kind === "charge"
        ? V9_ACTION_CUT_IN_TIMING.ENEMY_CHARGE_GAP_MS : V9_ACTION_CUT_IN_TIMING.GAP_MS,
    text: lines.get(unit.character.name)?.[kind] ?? defaults[kind]
  });
}

function abortError() { return Object.assign(new Error("ACTION_CUT_IN_ABORTED"), { name: "AbortError" }); }

/** Battle-owned timed dialogue before action audio/visuals; never advances the Domain. */
export class ActionCutInSession {
  #stage;
  #host;
  #lifetime = new AbortController();
  #active = null;

  constructor({ stage, host }) {
    invariant(stage instanceof Stage, "ACTION_CUT_IN_STAGE_REQUIRED");
    invariant(typeof host?.append === "function", "ACTION_CUT_IN_HOST_REQUIRED");
    this.#stage = stage;
    this.#host = host;
  }

  async present(request, abortSignal, durationOverride = undefined) {
    validatePresentationRequest(request);
    invariant(abortSignal instanceof AbortSignal, "ACTION_CUT_IN_SIGNAL_REQUIRED");
    invariant(durationOverride === undefined || (Number.isInteger(durationOverride) && durationOverride >= 0),
      "ACTION_CUT_IN_DURATION_INVALID");
    if (this.#lifetime.signal.aborted || abortSignal.aborted) throw abortError();
    if (request.type !== PresentationRequestType.ACTION || !kinds.has(request.payload.actionType)) return false;
    invariant(this.#active === null, "ACTION_CUT_IN_ALREADY_ACTIVE");
    const unit = this.#stage.getUnit(request.payload.actorId);
    const line = getActionCutIn(unit, request.payload.actionType,
      request.payload.actorAffiliation ?? this.#stage.armyManager.getAffiliation(unit));
    const root = document.createElement("section");
    root.className = "dialogue-overlay action-cut-in";
    root.setAttribute("aria-live", "polite");
    const card = document.createElement("div");
    card.className = "dialogue-card";
    const face = document.createElement("div");
    face.className = "character-portrait dialogue-portrait";
    const speaker = document.createElement("p");
    speaker.className = "dialogue-speaker";
    speaker.textContent = `${line.speaker.name} · ${line.actionLabel}`;
    const text = document.createElement("p");
    text.className = "dialogue-text";
    text.textContent = line.text;
    card.append(face, speaker, text);
    root.append(card);
    const portrait = new CharacterPortraitView(face);
    portrait.render(line.speaker);
    this.#active = { root, portrait };
    this.#host.append(root);
    try {
      await this.#wait(durationOverride ?? V9_ACTION_CUT_IN_TIMING.DISPLAY_MS, abortSignal);
      root.hidden = true;
      await this.#wait(durationOverride === undefined ? line.gapMs : 0, abortSignal);
      return true;
    } finally {
      this.#remove();
    }
  }

  #wait(duration, signal) {
    if (signal.aborted || this.#lifetime.signal.aborted) return Promise.reject(abortError());
    return new Promise((resolve, reject) => {
      const finish = (error) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        this.#lifetime.signal.removeEventListener("abort", abort);
        error ? reject(error) : resolve();
      };
      const abort = () => finish(abortError());
      const timer = setTimeout(() => finish(), duration);
      signal.addEventListener("abort", abort, { once: true });
      this.#lifetime.signal.addEventListener("abort", abort, { once: true });
    });
  }

  #remove() {
    this.#active?.portrait.dispose();
    this.#active?.root.remove();
    this.#active = null;
  }

  dispose() {
    this.#lifetime.abort();
    this.#remove();
  }
}
