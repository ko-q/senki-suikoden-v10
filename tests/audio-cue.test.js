import test from "node:test";
import assert from "node:assert/strict";

import { ActionType } from "../src/core/action-request.js";
import { BattleOutcome } from "../src/core/battle-result.js";
import {
  PresentationRequestType,
  createSemanticPresentationRequest
} from "../src/core/presentation-request.js";
import { Affiliation } from "../src/domain/army.js";
import { UnitStatus } from "../src/domain/unit.js";
import {
  AudioCueId,
  AudioThemeId,
  audioCuesForPresentation,
  audioThemeForPresentation,
  battleThemeForChapter
} from "../src/audio/audio-cue.js";

function cueIds(request) {
  return audioCuesForPresentation(request).map((descriptor) => descriptor.cueId);
}

function actionRequest(actionType, actorAffiliation = Affiliation.PLAYER) {
  return createSemanticPresentationRequest(PresentationRequestType.ACTION, {
    actionType,
    actorId: "actor",
    targetId: "target",
    actorAffiliation,
    actorIsMob: false,
    forced: false
  });
}

test("semantic combat actions choose the v9 player and enemy audio cues", () => {
  assert.deepEqual(cueIds(actionRequest(ActionType.NORMAL_ATTACK)), [
    AudioCueId.NORMAL_ATTACK
  ]);
  assert.equal(audioCuesForPresentation(actionRequest(ActionType.NORMAL_ATTACK))[0].withCry, true);
  assert.deepEqual(cueIds(actionRequest(ActionType.BOW_ATTACK)), [AudioCueId.PLAYER_BOW]);
  assert.deepEqual(cueIds(actionRequest(ActionType.BOW_ATTACK, Affiliation.ENEMY)), [
    AudioCueId.ENEMY_BOW
  ]);
  assert.deepEqual(cueIds(actionRequest(ActionType.CHARGE)), [AudioCueId.CHARGE]);
});

test("tactic cast, damage and status requests map independently", () => {
  assert.deepEqual(cueIds(actionRequest(ActionType.CONFUSION_LV3)), [
    AudioCueId.CONFUSION_CAST
  ]);
  assert.deepEqual(cueIds(actionRequest(ActionType.WIDE_ILLUSION)), [
    AudioCueId.WIDE_ILLUSION_START,
    AudioCueId.ILLUSION_CAST
  ]);
  assert.deepEqual(
    audioCuesForPresentation(actionRequest(ActionType.WIDE_ILLUSION))
      .map((descriptor) => descriptor.delay),
    [0.3, 2.24]
  );
  assert.deepEqual(cueIds(createSemanticPresentationRequest(
    PresentationRequestType.DAMAGE,
    { operationType: ActionType.FIRE, entries: [] }
  )), [AudioCueId.FIRE_DAMAGE]);
  assert.deepEqual(cueIds(createSemanticPresentationRequest(
    PresentationRequestType.STATUS,
    {
      reason: ActionType.ILLUSION,
      entries: [{ after: [{ type: UnitStatus.ILLUSION, remainingTurns: 1 }] }]
    }
  )), [AudioCueId.ILLUSION_SUCCESS]);
  assert.deepEqual(cueIds(createSemanticPresentationRequest(
    PresentationRequestType.STATUS,
    {
      reason: ActionType.CHARGE,
      entries: [{ after: [{ type: UnitStatus.CONFUSED, remainingTurns: 1 }] }]
    }
  )), [AudioCueId.CONFUSION_SUCCESS]);
});

test("trap, phase and battle result requests keep their dedicated sounds", () => {
  assert.deepEqual(cueIds(createSemanticPresentationRequest(
    PresentationRequestType.TRAP,
    { trapId: "trap", neutralized: true }
  )), [AudioCueId.CONFIRM]);
  assert.deepEqual(cueIds(createSemanticPresentationRequest(
    PresentationRequestType.DAMAGE,
    { operationType: "TRAP", entries: [] }
  )), [AudioCueId.TRAP_DAMAGE]);
  assert.deepEqual(cueIds(createSemanticPresentationRequest(
    PresentationRequestType.PHASE,
    { turn: 2, phase: "ENEMY" }
  )), [AudioCueId.PHASE_GONG]);

  const victory = createSemanticPresentationRequest(
    PresentationRequestType.BATTLE_RESULT,
    { outcome: BattleOutcome.VICTORY }
  );
  const defeat = createSemanticPresentationRequest(
    PresentationRequestType.BATTLE_RESULT,
    { outcome: BattleOutcome.DEFEAT }
  );
  assert.equal(audioThemeForPresentation(victory), AudioThemeId.VICTORY);
  assert.equal(audioThemeForPresentation(defeat), AudioThemeId.DEFEAT);
});

test("chapter themes retain the v9 three-stage rotation", () => {
  assert.equal(battleThemeForChapter(0), AudioThemeId.BATTLE_GENERATED_FIXED);
  assert.equal(battleThemeForChapter(1), AudioThemeId.BATTLE_GENERATED_FIXED);
  assert.equal(battleThemeForChapter(2), AudioThemeId.BATTLE_DS069);
  assert.equal(battleThemeForChapter(3), AudioThemeId.BATTLE_STRATEGY);
  assert.equal(battleThemeForChapter(4), AudioThemeId.BATTLE_GENERATED_FIXED);
});
