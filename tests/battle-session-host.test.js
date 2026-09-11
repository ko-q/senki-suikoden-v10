import test from "node:test";
import assert from "node:assert/strict";

import { BattleRandom } from "../src/domain/battle-random.js";
import { BattleController } from "../src/orchestration/battle-controller.js";
import {
  BattleSession,
  BattleSessionHost
} from "../src/orchestration/battle-session-host.js";
import { BattleEffectManager } from "../src/presentation/battle-effect-manager.js";
import { BattleRenderer } from "../src/presentation/battle-renderer.js";
import { BattleScreen, InteractionMode } from "../src/presentation/battle-screen.js";
import { SaveKind } from "../src/persistence/save-codec.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { AIService } from "../src/services/ai-service.js";
import { CombatService } from "../src/services/combat-service.js";
import { MovementService } from "../src/services/movement-service.js";
import { SaveService } from "../src/services/save-service.js";
import { StatusService } from "../src/services/status-service.js";
import { TacticService } from "../src/services/tactic-service.js";
import {
  createFakeBattleElements,
  installFakeDocument
} from "../test-support/fake-battle-dom.js";
import { MemoryStorage } from "../test-support/memory-storage.js";
import { createPopulatedSaveBattle } from "../test-support/save-fixtures.js";

class FakeController {
  constructor(stage, events, label) {
    this.stage = stage;
    this.events = events;
    this.label = label;
    this.disposed = false;
  }

  getStage() {
    return this.stage;
  }

  resumeLoadedBattle() {
    this.events.push(`${this.label}:resume`);
    return Promise.resolve("resumed");
  }

  startNewBattle() {
    this.events.push(`${this.label}:start`);
    return Promise.resolve("started");
  }

  dispose() {
    this.disposed = true;
    this.events.push(`${this.label}:controller-dispose`);
  }
}

class FakeScreen {
  constructor(events, label, { failConnect = false } = {}) {
    this.events = events;
    this.label = label;
    this.failConnect = failConnect;
    this.disposed = false;
  }

  connectCommandPort() {
    this.events.push(`${this.label}:connect`);
    if (this.failConnect) {
      throw new Error("TEST_CONNECT_FAILED");
    }
  }

  dispose() {
    this.disposed = true;
    this.events.push(`${this.label}:screen-dispose`);
  }
}

class FakeView {
  constructor(events, label, { failActivate = false } = {}) {
    this.events = events;
    this.label = label;
    this.failActivate = failActivate;
    this.disposed = false;
  }

  activate() {
    this.events.push(`${this.label}:activate`);
    if (this.failActivate) {
      throw new Error("TEST_ACTIVATE_FAILED");
    }
  }

  dispose() {
    this.disposed = true;
    this.events.push(`${this.label}:view-dispose`);
  }
}

function createPreparedLoad() {
  const fixture = createPopulatedSaveBattle();
  const repository = new SaveRepository({
    storage: new MemoryStorage(),
    clock: () => 100
  });
  const service = new SaveService({
    repository,
    stageFactory: fixture.stageFactory,
    writerId: "test_writer",
    clock: () => 100
  });
  service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  return {
    fixture,
    prepared: service.prepareLoad({
      slotId: "manual_01",
      saveKind: SaveKind.MANUAL
    })
  };
}

function createSession(stage, random, events, label, screenOptions = {}, view = null) {
  return new BattleSession({
    stage,
    battleRandom: random,
    controller: new FakeController(stage, events, label),
    screen: new FakeScreen(events, label, screenOptions),
    view
  });
}

function createActualLoadedSession(prepared) {
  const battleRandom = new BattleRandom(1);
  battleRandom.importState(prepared.randomState);
  const movementService = new MovementService();
  const combatService = new CombatService();
  const tacticService = new TacticService();
  const statusService = new StatusService();
  const aiService = new AIService({
    movementService,
    combatService,
    tacticService,
    battleRandom
  });
  const renderer = new BattleRenderer(createFakeBattleElements());
  const screen = new BattleScreen({
    stage: prepared.stage,
    renderer,
    effectManager: new BattleEffectManager({ renderer })
  });
  const controller = new BattleController({
    stage: prepared.stage,
    battleRandom,
    movementService,
    combatService,
    tacticService,
    statusService,
    aiService,
    presentationPort: screen
  });
  return new BattleSession({
    stage: prepared.stage,
    battleRandom,
    controller,
    screen
  });
}

async function waitUntil(predicate, label) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  throw new Error(`WAIT_TIMEOUT_${label}`);
}

test("BattleSessionHost leaves the current session alive when hidden connection validation fails", () => {
  const { fixture, prepared } = createPreparedLoad();
  const events = [];
  const oldSession = createSession(
    fixture.stage,
    fixture.battleRandom,
    events,
    "old"
  );
  let failedCandidate = null;
  const host = new BattleSessionHost({
    currentSession: oldSession,
    createLoadedSession: () => {
      const random = new BattleRandom(1);
      random.importState(prepared.randomState);
      failedCandidate = createSession(
        prepared.stage,
        random,
        events,
        "candidate",
        { failConnect: true }
      );
      return failedCandidate;
    }
  });

  assert.throws(
    () => host.replaceWithPreparedLoad(prepared),
    { message: "TEST_CONNECT_FAILED" }
  );
  assert.equal(host.currentSession, oldSession);
  assert.equal(oldSession.isDisposed, false);
  assert.equal(failedCandidate.isDisposed, true);
  assert.deepEqual(events, [
    "candidate:connect",
    "candidate:screen-dispose",
    "candidate:controller-dispose"
  ]);
});

test("BattleSessionHost disposes the old session only after candidate validation and then resumes", async () => {
  const { fixture, prepared } = createPreparedLoad();
  const events = [];
  const oldSession = createSession(
    fixture.stage,
    fixture.battleRandom,
    events,
    "old"
  );
  const host = new BattleSessionHost({
    currentSession: oldSession,
    createLoadedSession: () => {
      const random = new BattleRandom(1);
      random.importState(prepared.randomState);
      return createSession(prepared.stage, random, events, "candidate");
    }
  });

  const replacement = host.replaceWithPreparedLoad(prepared);

  assert.notEqual(host.currentSession, oldSession);
  assert.equal(oldSession.isDisposed, true);
  assert.equal(host.currentSession.isConnected, true);
  assert.equal(await replacement.completion, "resumed");
  assert.deepEqual(events, [
    "candidate:connect",
    "old:screen-dispose",
    "old:controller-dispose",
    "candidate:resume"
  ]);
});

test("BattleSessionHost rejects a candidate with the wrong random state before connection", () => {
  const { fixture, prepared } = createPreparedLoad();
  const events = [];
  const oldSession = createSession(
    fixture.stage,
    fixture.battleRandom,
    events,
    "old"
  );
  const host = new BattleSessionHost({
    currentSession: oldSession,
    createLoadedSession: () => createSession(
      prepared.stage,
      new BattleRandom(9),
      events,
      "candidate"
    )
  });

  assert.throws(
    () => host.replaceWithPreparedLoad(prepared),
    { code: "BATTLE_LOADED_RANDOM_MISMATCH" }
  );
  assert.equal(host.currentSession, oldSession);
  assert.equal(oldSession.isDisposed, false);
  assert.deepEqual(events, [
    "candidate:screen-dispose",
    "candidate:controller-dispose"
  ]);
});

test("BattleSessionHost leaves the old session alive when detached view activation fails", () => {
  const { fixture, prepared } = createPreparedLoad();
  const events = [];
  const oldSession = createSession(
    fixture.stage,
    fixture.battleRandom,
    events,
    "old"
  );
  let candidate = null;
  const host = new BattleSessionHost({
    currentSession: oldSession,
    createLoadedSession: () => {
      const random = new BattleRandom(1);
      random.importState(prepared.randomState);
      candidate = createSession(
        prepared.stage,
        random,
        events,
        "candidate",
        {},
        new FakeView(events, "candidate", { failActivate: true })
      );
      return candidate;
    }
  });

  assert.throws(
    () => host.replaceWithPreparedLoad(prepared),
    { message: "TEST_ACTIVATE_FAILED" }
  );
  assert.equal(host.currentSession, oldSession);
  assert.equal(oldSession.isDisposed, false);
  assert.equal(candidate.isDisposed, true);
  assert.deepEqual(events, [
    "candidate:connect",
    "candidate:activate",
    "candidate:screen-dispose",
    "candidate:controller-dispose",
    "candidate:view-dispose"
  ]);
});

test("BattleSessionHost starts a new candidate only after activation and old disposal", async () => {
  const { fixture } = createPreparedLoad();
  const events = [];
  const oldSession = createSession(
    fixture.stage,
    fixture.battleRandom,
    events,
    "old"
  );
  const stage = fixture.stageFactory.create("save_stage");
  const candidate = createSession(
    stage,
    new BattleRandom(4),
    events,
    "candidate",
    {},
    new FakeView(events, "candidate")
  );
  const host = new BattleSessionHost({
    currentSession: oldSession,
    createLoadedSession() {
      throw new Error("UNUSED");
    }
  });

  const replacement = host.replaceWithNewBattle(candidate);
  assert.equal(await replacement.completion, "started");
  assert.equal(host.currentSession, candidate);
  assert.deepEqual(events, [
    "candidate:connect",
    "candidate:activate",
    "old:screen-dispose",
    "old:controller-dispose",
    "candidate:start"
  ]);
});

test("an actual loaded Controller and Screen resume a committed tactic at facing selection", async () => {
  const restoreDocument = installFakeDocument();
  const { fixture, prepared } = createPreparedLoad();
  const events = [];
  const oldSession = createSession(
    fixture.stage,
    fixture.battleRandom,
    events,
    "old"
  );
  const host = new BattleSessionHost({
    currentSession: oldSession,
    createLoadedSession: createActualLoadedSession
  });

  let replacement = null;
  try {
    replacement = host.replaceWithPreparedLoad(prepared);
    await waitUntil(
      () => replacement.session.screen.mode === InteractionMode.TACTIC_FACING_SELECT,
      "TACTIC_FACING_SELECT"
    );

    assert.equal(replacement.session.stage, prepared.stage);
    assert.equal(replacement.session.screen.mode, InteractionMode.TACTIC_FACING_SELECT);
  } finally {
    if (replacement !== null) {
      replacement.session.dispose();
      await assert.rejects(replacement.completion, { name: "AbortError" });
    }
    restoreDocument();
  }
});
