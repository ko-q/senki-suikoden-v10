import test from "node:test";
import assert from "node:assert/strict";

import { AudioController } from "../src/audio/audio-controller.js";
import { AudioThemeId } from "../src/audio/audio-cue.js";
import { ActionType } from "../src/core/action-request.js";
import { BattleOutcome } from "../src/core/battle-result.js";
import {
  PresentationRequestType,
  createSemanticPresentationRequest
} from "../src/core/presentation-request.js";
import { Affiliation } from "../src/domain/army.js";
import {
  FakeAudioContext,
  createFakeAudioFetcher,
  flushAudioTasks
} from "../test-support/fake-audio.js";

function createController(context = new FakeAudioContext()) {
  const requestedUrls = [];
  return {
    context,
    requestedUrls,
    controller: new AudioController({
      audioContextFactory: () => context,
      fetcher: createFakeAudioFetcher(requestedUrls)
    })
  };
}

test("a queued battle theme starts only after the first audio unlock", async () => {
  const runtime = createController();
  assert.equal(await runtime.controller.startBattleThemeForChapter(2), false);
  assert.equal(runtime.controller.queuedThemeId, AudioThemeId.BATTLE_DS069);
  assert.equal(runtime.context.startedSources.length, 0);

  assert.equal(await runtime.controller.unlock(), true);
  await flushAudioTasks();
  assert.equal(runtime.controller.currentThemeId, AudioThemeId.BATTLE_DS069);
  assert.equal(runtime.context.startedSources.length, 1);
  assert.equal(runtime.context.startedSources[0].loop, true);
  assert.equal(
    runtime.requestedUrls.some((url) => url.endsWith("/battle-ds069.ogg")),
    true
  );
  runtime.controller.dispose();
});

test("defeat replaces battle BGM once and keeps the v9 start offset", async () => {
  const runtime = createController();
  runtime.controller.startBattleThemeForChapter(1);
  await runtime.controller.unlock();
  await flushAudioTasks();
  const battleSource = runtime.context.startedSources[0];

  assert.equal(await runtime.controller.startResultTheme(BattleOutcome.DEFEAT), true);
  const defeatSource = runtime.context.startedSources.at(-1);
  assert.equal(runtime.controller.currentThemeId, AudioThemeId.DEFEAT);
  assert.equal(defeatSource.loop, false);
  assert.equal(defeatSource.started[0][1], 3.3);
  assert.equal(battleSource.stopped.length, 1);
  runtime.controller.dispose();
});

test("a Battle audio session owns and stops its transient sources", async () => {
  const runtime = createController();
  await runtime.controller.unlock();
  await flushAudioTasks();
  const session = runtime.controller.createBattleSession();
  const request = createSemanticPresentationRequest(PresentationRequestType.ACTION, {
    actionType: ActionType.BOW_ATTACK,
    actorId: "enemy",
    targetId: "player",
    actorAffiliation: Affiliation.ENEMY,
    actorIsMob: true,
    forced: false
  });
  const handle = session.present(request, new AbortController().signal);
  await flushAudioTasks();
  handle.complete();
  const source = runtime.context.startedSources.at(-1);
  assert.equal(source.kind, "buffer");
  assert.equal(source.stopped.length, 0);

  session.dispose();
  assert.equal(source.stopped.length, 1);
  runtime.controller.dispose();
});

test("wide illusion schedules its start cue and cast cue at the v9 visual boundaries", async () => {
  const runtime = createController();
  await runtime.controller.unlock();
  await flushAudioTasks();
  const session = runtime.controller.createBattleSession();
  const request = createSemanticPresentationRequest(PresentationRequestType.ACTION, {
    actionType: ActionType.WIDE_ILLUSION,
    actorId: "enemy",
    targetId: "enemy",
    actorAffiliation: Affiliation.ENEMY,
    actorIsMob: false,
    forced: false
  });
  const handle = session.present(request, new AbortController().signal);
  await flushAudioTasks();
  handle.complete();

  const startTimes = runtime.context.startedSources
    .map((source) => source.started[0]?.[0])
    .filter((time) => Number.isFinite(time));
  assert.equal(startTimes.some((time) => Math.abs(time - 2.3) < 0.000001), true);
  assert.equal(startTimes.some((time) => Math.abs(time - 4.24) < 0.000001), true);
  session.dispose();
  runtime.controller.dispose();
});

test("a disposed Battle never plays a cue after its deferred decode finishes", async () => {
  const context = new FakeAudioContext({ deferredDecode: true });
  const runtime = createController(context);
  await runtime.controller.unlock();
  const session = runtime.controller.createBattleSession();
  const request = createSemanticPresentationRequest(
    PresentationRequestType.PHASE,
    { turn: 1, phase: "PLAYER" }
  );
  session.present(request, new AbortController().signal);
  session.dispose();
  context.resolvePendingDecodes();
  await flushAudioTasks(8);

  assert.equal(context.startedSources.length, 0);
  runtime.controller.dispose();
});

test("visibility suspension and audio toggle do not touch Domain state", async () => {
  const runtime = createController();
  await runtime.controller.unlock();
  assert.equal(runtime.controller.toggleEnabled(), false);
  assert.equal(runtime.controller.isEnabled, false);
  assert.equal(await runtime.controller.suspendForBackground(), true);
  assert.equal(runtime.context.suspendCount, 1);
  assert.equal(await runtime.controller.resumeFromBackground(), true);
  assert.equal(runtime.context.resumeCount, 1);
  assert.equal(runtime.controller.toggleEnabled(), true);
  assert.equal(runtime.controller.isEnabled, true);
  runtime.controller.dispose();
  await flushAudioTasks();
  assert.equal(runtime.context.closeCount, 1);
});
