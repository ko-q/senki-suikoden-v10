import { ActionType } from "../core/action-request.js";
import { BattleOutcome } from "../core/battle-result.js";
import { invariant } from "../core/domain-error.js";
import {
  PresentationRequestType,
  validatePresentationRequest
} from "../core/presentation-request.js";
import { Affiliation } from "../domain/army.js";
import { UnitStatus } from "../domain/unit.js";

export const AudioCueId = Object.freeze({
  CONFIRM: "CONFIRM",
  CONFUSION_CAST: "CONFUSION_CAST",
  CONFUSION_SUCCESS: "CONFUSION_SUCCESS",
  FAILURE: "FAILURE",
  FIRE_CAST: "FIRE_CAST",
  FIRE_DAMAGE: "FIRE_DAMAGE",
  ILLUSION_CAST: "ILLUSION_CAST",
  ILLUSION_SUCCESS: "ILLUSION_SUCCESS",
  MOVE_STEP: "MOVE_STEP",
  NORMAL_ATTACK: "NORMAL_ATTACK",
  PHASE_GONG: "PHASE_GONG",
  PLAYER_BOW: "PLAYER_BOW",
  ENEMY_BOW: "ENEMY_BOW",
  CHARGE: "CHARGE",
  TRAP_DAMAGE: "TRAP_DAMAGE",
  WATER_CAST: "WATER_CAST",
  WATER_DAMAGE: "WATER_DAMAGE",
  WIDE_ILLUSION_START: "WIDE_ILLUSION_START"
});

export const AudioThemeId = Object.freeze({
  TITLE: "TITLE",
  STAGE_SELECT: "STAGE_SELECT",
  BATTLE_STRATEGY: "BATTLE_STRATEGY",
  BATTLE_DS069: "BATTLE_DS069",
  BATTLE_GENERATED_FIXED: "BATTLE_GENERATED_FIXED",
  VICTORY: "VICTORY",
  DEFEAT: "DEFEAT"
});

function cue(cueId, options = {}) {
  invariant(Object.values(AudioCueId).includes(cueId), "AUDIO_CUE_ID_INVALID", { cueId });
  return Object.freeze({ cueId, ...options });
}

function actionCues(payload) {
  const withCry = payload.actorIsMob === false;
  if (payload.actionType === ActionType.NORMAL_ATTACK) {
    return [cue(AudioCueId.NORMAL_ATTACK, { withCry })];
  }
  if (payload.actionType === ActionType.BOW_ATTACK) {
    return [cue(
      payload.actorAffiliation === Affiliation.ENEMY
        ? AudioCueId.ENEMY_BOW
        : AudioCueId.PLAYER_BOW
    )];
  }
  if (payload.actionType === ActionType.CHARGE) {
    return [cue(AudioCueId.CHARGE, { withCry })];
  }
  if (
    payload.actionType === ActionType.CONFUSION_LV1
    || payload.actionType === ActionType.CONFUSION_LV2
    || payload.actionType === ActionType.CONFUSION_LV3
  ) {
    return [cue(AudioCueId.CONFUSION_CAST)];
  }
  if (payload.actionType === ActionType.ILLUSION) {
    return [cue(AudioCueId.ILLUSION_CAST)];
  }
  if (payload.actionType === ActionType.WIDE_ILLUSION) {
    return [
      cue(AudioCueId.WIDE_ILLUSION_START),
      cue(AudioCueId.ILLUSION_CAST)
    ];
  }
  if (payload.actionType === ActionType.FIRE) {
    return [cue(AudioCueId.FIRE_CAST)];
  }
  if (payload.actionType === ActionType.WATER) {
    return [cue(AudioCueId.WATER_CAST)];
  }
  if (payload.actionType === "WAIT") {
    return [cue(AudioCueId.CONFIRM)];
  }
  if (payload.actionType === "ILLUSION_WAIT") {
    return [cue(AudioCueId.FAILURE)];
  }
  return [];
}

function damageCues(payload) {
  if (payload.operationType === ActionType.FIRE) {
    return [cue(AudioCueId.FIRE_DAMAGE)];
  }
  if (payload.operationType === ActionType.WATER) {
    return [cue(AudioCueId.WATER_DAMAGE)];
  }
  if (payload.operationType === "TRAP") {
    return [cue(AudioCueId.TRAP_DAMAGE)];
  }
  return [];
}

function hasStatusAfter(entries, statusType) {
  if (!Array.isArray(entries)) {
    return false;
  }
  return entries.some((entry) => (
    Array.isArray(entry.after)
    && entry.after.some((effect) => effect.type === statusType)
  ));
}

function statusCues(payload) {
  if (payload.reason === "PHASE_START") {
    return payload.statusResult === "CONFUSION_SKIP"
      ? [cue(AudioCueId.FAILURE)]
      : [];
  }
  if (payload.reason === "TRAP") {
    return payload.statusChange?.type === UnitStatus.ILLUSION
      ? [cue(AudioCueId.ILLUSION_SUCCESS)]
      : [cue(AudioCueId.CONFUSION_SUCCESS)];
  }
  if (
    payload.reason === ActionType.ILLUSION
    || payload.reason === ActionType.WIDE_ILLUSION
    || hasStatusAfter(payload.entries, UnitStatus.ILLUSION)
  ) {
    return [cue(AudioCueId.ILLUSION_SUCCESS)];
  }
  if (hasStatusAfter(payload.entries, UnitStatus.CONFUSED)) {
    return [cue(AudioCueId.CONFUSION_SUCCESS)];
  }
  return [];
}

/**
 * Domainに音源名を持ち込まず、意味的Presentationだけを音声cueへ写像する。
 */
export function audioCuesForPresentation(request) {
  validatePresentationRequest(request);
  let cues = [];
  if (request.type === PresentationRequestType.MOVE) {
    cues = [cue(AudioCueId.MOVE_STEP)];
  } else if (request.type === PresentationRequestType.ACTION) {
    cues = actionCues(request.payload);
  } else if (request.type === PresentationRequestType.DAMAGE) {
    cues = damageCues(request.payload);
  } else if (request.type === PresentationRequestType.STATUS) {
    cues = statusCues(request.payload);
  } else if (request.type === PresentationRequestType.TRAP && request.payload.neutralized) {
    cues = [cue(AudioCueId.CONFIRM)];
  } else if (request.type === PresentationRequestType.PHASE) {
    cues = [cue(AudioCueId.PHASE_GONG)];
  }
  return Object.freeze(cues);
}

export function audioThemeForPresentation(request) {
  validatePresentationRequest(request);
  if (request.type !== PresentationRequestType.BATTLE_RESULT) {
    return null;
  }
  return request.payload.outcome === BattleOutcome.VICTORY
    ? AudioThemeId.VICTORY
    : AudioThemeId.DEFEAT;
}

export function battleThemeForChapter(chapterNumber) {
  invariant(
    Number.isInteger(chapterNumber) && chapterNumber >= 0,
    "AUDIO_CHAPTER_NUMBER_INVALID"
  );
  const normalizedChapter = Math.max(1, chapterNumber);
  const remainder = normalizedChapter % 3;
  if (remainder === 0) {
    return AudioThemeId.BATTLE_STRATEGY;
  }
  if (remainder === 2) {
    return AudioThemeId.BATTLE_DS069;
  }
  return AudioThemeId.BATTLE_GENERATED_FIXED;
}
