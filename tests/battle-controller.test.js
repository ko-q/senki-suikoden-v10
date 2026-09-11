import test from "node:test";
import assert from "node:assert/strict";

import { createActionRequest, ActionType } from "../src/core/action-request.js";
import { BattleOutcome } from "../src/core/battle-result.js";
import { PresentationRequestType } from "../src/core/presentation-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { HiddenTrapKind } from "../src/domain/hidden-trap.js";
import { ObjectiveOutcome, ObjectiveType } from "../src/domain/objective.js";
import { Position } from "../src/domain/position.js";
import { StagePhase } from "../src/domain/stage.js";
import { StageEventTrigger, StageEventType } from "../src/domain/stage-event.js";
import { Facing, UnitActionState, UnitStatus } from "../src/domain/unit.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import {
  BattleController,
  BattleFlowState
} from "../src/orchestration/battle-controller.js";
import { AIService } from "../src/services/ai-service.js";
import { CombatService } from "../src/services/combat-service.js";
import { MovementService } from "../src/services/movement-service.js";
import { StatusService } from "../src/services/status-service.js";
import { TacticService } from "../src/services/tactic-service.js";
import { createStageDigest } from "../test-support/fixtures.js";
import {
  Affiliation,
  createServiceStage
} from "../test-support/service-fixtures.js";

class RecordingPresentationPort {
  constructor() {
    this.requests = [];
  }

  async present(request) {
    this.requests.push(request);
  }
}

class RecordingCheckpointPort {
  constructor() {
    this.snapshots = [];
  }

  requestRecoverySave(snapshot) {
    this.snapshots.push(snapshot);
  }
}

class FailingCheckpointPort extends RecordingCheckpointPort {
  requestRecoverySave(snapshot) {
    super.requestRecoverySave(snapshot);
    return Promise.reject(new Error("TEST_CHECKPOINT_FAILURE"));
  }
}

class BlockingMovePresentationPort extends RecordingPresentationPort {
  async present(request, abortSignal) {
    this.requests.push(request);
    if (request.type !== PresentationRequestType.MOVE) {
      return;
    }
    await new Promise((resolve, reject) => {
      const rejectAbort = () => {
        const error = new Error("TEST_PRESENTATION_ABORTED");
        error.name = "AbortError";
        reject(error);
      };
      if (abortSignal.aborted) {
        rejectAbort();
        return;
      }
      abortSignal.addEventListener("abort", rejectAbort, { once: true });
    });
  }
}

class FailingActionPresentationPort extends RecordingPresentationPort {
  async present(request) {
    this.requests.push(request);
    if (request.type === PresentationRequestType.ACTION) {
      throw new Error("TEST_PRESENTATION_FAILURE");
    }
  }
}

function createControllerRuntime(stage, {
  seed = 1,
  presentationPort = new RecordingPresentationPort(),
  checkpointPort = new RecordingCheckpointPort()
} = {}) {
  const battleRandom = new BattleRandom(seed);
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
  const controller = new BattleController({
    stage,
    battleRandom,
    movementService,
    combatService,
    tacticService,
    statusService,
    aiService,
    presentationPort,
    checkpointPort
  });
  return {
    controller,
    battleRandom,
    presentationPort,
    checkpointPort
  };
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

async function startNewBattle(runtime) {
  const completion = runtime.controller.startNewBattle();
  await waitUntil(
    () => runtime.controller.flowState === BattleFlowState.IDLE
      || runtime.controller.flowState === BattleFlowState.FAULTED
      || runtime.controller.getBattleResult() !== null,
    "START_NEW_BATTLE"
  );
  return { completion };
}

async function disposePendingBattle(runtime, completion) {
  runtime.controller.dispose();
  await assert.rejects(completion, { name: "AbortError" });
}

test("startNewBattle initializes Trap, Event, phase status and a stable checkpoint", async () => {
  const stage = createServiceStage({
    id: "controller_start",
    map: [["plain", "plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        statusEffects: [{ type: UnitStatus.CONFUSED, remainingTurns: 1 }]
      },
      {
        id: "enemy",
        army: Affiliation.ENEMY,
        position: { x: 3, y: 0 }
      }
    ],
    speeches: [
      {
        id: "intro_speech",
        speakerCharacterId: "actor_character",
        text: "Begin."
      }
    ],
    dialogues: [{ id: "intro", speechIds: ["intro_speech"] }],
    introDialogueId: "intro",
    events: [
      {
        id: "phase_entry",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START,
        presentationRequests: [
          { type: PresentationRequestType.NOTICE, messageKey: "notice.phase_entry" }
        ]
      }
    ],
    hiddenTrapDefinitions: [
      {
        id: "opening_trap",
        kind: HiddenTrapKind.NORMAL,
        position: { x: 1, y: 0 },
        triggerAffiliations: [Affiliation.PLAYER]
      }
    ]
  });
  const runtime = createControllerRuntime(stage);
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const enemy = stage.getUnit("enemy");

  assert.equal(stage.getHiddenTraps().length, 1);
  assert.deepEqual(stage.eventManager.getCompletedEventIds(), ["phase_entry"]);
  assert.equal(actor.getStatusTurns(UnitStatus.CONFUSED), 0);
  assert.equal(actor.actionState, UnitActionState.FINISHED);
  assert.equal(enemy.actionState, UnitActionState.FINISHED);
  assert.equal(runtime.controller.isStableForSave(), true);
  assert.equal(runtime.checkpointPort.snapshots.length, 1);
  assert.deepEqual(runtime.presentationPort.requests.map((request) => request.type), [
    PresentationRequestType.DIALOGUE,
    PresentationRequestType.PHASE,
    PresentationRequestType.NOTICE,
    PresentationRequestType.STATUS
  ]);

  await disposePendingBattle(runtime, completion);
});

test("a failed player commit changes neither Domain nor BattleRandom", async () => {
  const stage = createServiceStage({
    id: "controller_reject",
    map: [["plain", "plain", "plain"]],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }
    ]
  });
  const runtime = createControllerRuntime(stage, { seed: 9 });
  const { completion } = await startNewBattle(runtime);
  const request = createActionRequest(
    ActionType.NORMAL_ATTACK,
    stage.getUnit("actor"),
    stage.getUnit("target")
  );
  const domainBefore = createStageDigest(stage);
  const randomBefore = runtime.battleRandom.exportState();
  const checkpointCountBefore = runtime.checkpointPort.snapshots.length;

  assert.equal(await runtime.controller.executeAction(request, []), false);
  assert.equal(createStageDigest(stage), domainBefore);
  assert.deepEqual(runtime.battleRandom.exportState(), randomBefore);
  assert.equal(runtime.checkpointPort.snapshots.length, checkpointCountBefore);

  await disposePendingBattle(runtime, completion);
});

test("movement and attack remove a defeated Unit before latching victory", async () => {
  const stage = createServiceStage({
    id: "controller_victory",
    map: [["plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        character: { martial: 100, command: 100 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 0 },
        maxTroops: 10,
        troops: 10,
        character: { command: 0 }
      }
    ],
    objectives: [
      {
        id: "eliminate_enemy",
        type: ObjectiveType.ELIMINATION,
        outcome: ObjectiveOutcome.VICTORY,
        targetArmy: Affiliation.ENEMY
      }
    ]
  });
  const runtime = createControllerRuntime(stage);
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const request = createActionRequest(ActionType.NORMAL_ATTACK, actor, target);

  assert.equal(
    await runtime.controller.executeAction(request, [{ x: 1, y: 0 }]),
    true
  );
  const result = await completion;

  assert.equal(result.outcome, BattleOutcome.VICTORY);
  assert.equal(result.objectiveId, "eliminate_enemy");
  assert.equal(stage.map.getPosition(target), null);
  assert.equal(target.troops, 0);
  assert.equal(actor.actionState, UnitActionState.FINISHED);
  assert.equal(runtime.controller.flowState, BattleFlowState.FINISHING);
  assert.deepEqual(runtime.presentationPort.requests.map((item) => item.type).slice(-4), [
    PresentationRequestType.MOVE,
    PresentationRequestType.ACTION,
    PresentationRequestType.DAMAGE,
    PresentationRequestType.BATTLE_RESULT
  ]);
});

test("a Trap interrupts movement and cancels the planned action without another RNG use", async () => {
  const stage = createServiceStage({
    id: "controller_trap",
    map: [["plain", "plain", "plain", "plain"]],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "target", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }
    ],
    events: [
      {
        id: "trap_seen",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.TRAP_TRIGGERED
      },
      {
        id: "operation_finished",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.AFTER_OPERATION
      }
    ],
    hiddenTrapDefinitions: [
      {
        id: "route_trap",
        kind: HiddenTrapKind.NORMAL,
        position: { x: 1, y: 0 },
        triggerAffiliations: [Affiliation.PLAYER]
      }
    ]
  });
  const runtime = createControllerRuntime(stage, { seed: 17 });
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const request = createActionRequest(ActionType.NORMAL_ATTACK, actor, target);
  const targetTroopsBefore = target.troops;
  const randomBeforeAction = runtime.battleRandom.exportState();

  assert.equal(await runtime.controller.executeAction(request, [
    { x: 1, y: 0 },
    { x: 2, y: 0 }
  ]), true);

  assert.deepEqual(stage.map.getPosition(actor), new Position(1, 0));
  assert.equal(actor.troops, actor.maxTroops - 20);
  assert.equal(actor.actionState, UnitActionState.FINISHED);
  assert.equal(target.troops, targetTroopsBefore);
  assert.deepEqual(runtime.battleRandom.exportState(), randomBeforeAction);
  assert.deepEqual(stage.eventManager.getCompletedEventIds(), [
    "trap_seen",
    "operation_finished"
  ]);
  assert.equal(
    runtime.presentationPort.requests.some((item) => item.type === PresentationRequestType.ACTION),
    false
  );

  await disposePendingBattle(runtime, completion);
});

test("a player Tactic becomes a stable committed state until facing is finalized", async () => {
  const stage = createServiceStage({
    id: "controller_tactic",
    map: [["plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        abilities: [UnitAbility.CONFUSION_LEVEL_1],
        maxUses: { [UnitUse.TACTIC]: 1 }
      },
      { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }
    ],
    events: [
      {
        id: "after_tactic",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.AFTER_OPERATION
      }
    ]
  });
  const runtime = createControllerRuntime(stage);
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const request = createActionRequest(ActionType.CONFUSION_LV1, actor, target);

  assert.equal(await runtime.controller.executeAction(request, []), true);
  assert.equal(actor.actionState, UnitActionState.TACTIC_COMMITTED);
  assert.equal(runtime.controller.isStableForSave(), true);
  const snapshot = runtime.controller.createSaveSnapshot();
  assert.equal(snapshot.units
    .find((unit) => unit.id === "actor").actionState, UnitActionState.TACTIC_COMMITTED);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.randomState), true);
  assert.equal(Object.isFrozen(snapshot.units), true);
  assert.equal(Object.isFrozen(snapshot.units[0]), true);
  assert.equal(Object.isFrozen(snapshot.units[0].position), true);
  assert.equal(Object.isFrozen(snapshot.units[0].remainingUses), true);
  assert.equal(Object.isFrozen(snapshot.completedEventIds), true);
  assert.equal(await runtime.controller.endPlayerTurn(), false);
  assert.deepEqual(stage.eventManager.getCompletedEventIds(), ["after_tactic"]);

  assert.equal(await runtime.controller.finalizeTacticFacing(actor, Facing.NORTH), true);
  assert.equal(actor.facing, Facing.NORTH);
  assert.equal(actor.actionState, UnitActionState.FINISHED);
  assert.deepEqual(stage.eventManager.getCompletedEventIds(), ["after_tactic"]);
  assert.equal(runtime.controller.isStableForSave(), true);

  await disposePendingBattle(runtime, completion);
});

test("enemy phase runs remaining READY units and advances to the next Player turn", async () => {
  const stage = createServiceStage({
    id: "controller_enemy_phase",
    map: [["plain", "plain"]],
    units: [
      {
        id: "player",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        maxTroops: 300,
        troops: 300
      },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 1, y: 0 } }
    ]
  });
  const runtime = createControllerRuntime(stage);
  const { completion } = await startNewBattle(runtime);
  const player = stage.getUnit("player");
  const enemy = stage.getUnit("enemy");

  assert.equal(await runtime.controller.endPlayerTurn(), true);

  assert.equal(stage.turn, 2);
  assert.equal(stage.phase, StagePhase.PLAYER);
  assert.equal(player.troops < 300, true);
  assert.equal(player.actionState, UnitActionState.READY);
  assert.equal(enemy.actionState, UnitActionState.FINISHED);
  assert.equal(runtime.controller.flowState, BattleFlowState.IDLE);
  assert.equal(runtime.checkpointPort.snapshots.some((snapshot) => (
    snapshot.phase === StagePhase.ENEMY
  )), true);

  await disposePendingBattle(runtime, completion);
});

test("phase-start ILLUSION uses the dedicated allied attack path", async () => {
  const stage = createServiceStage({
    id: "controller_forced_illusion",
    map: [["plain", "plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        statusEffects: [{ type: UnitStatus.ILLUSION, remainingTurns: 1 }]
      },
      {
        id: "ally",
        army: Affiliation.PLAYER,
        position: { x: 1, y: 0 },
        maxTroops: 400,
        troops: 400
      },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }
    ]
  });
  const runtime = createControllerRuntime(stage);
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const ally = stage.getUnit("ally");

  assert.equal(actor.getStatusTurns(UnitStatus.ILLUSION), 0);
  assert.equal(actor.actionState, UnitActionState.FINISHED);
  assert.equal(ally.troops < 400, true);
  const forcedAction = runtime.presentationPort.requests.find((request) => (
    request.type === PresentationRequestType.ACTION
  ));
  assert.equal(forcedAction.payload.forced, true);
  assert.equal(forcedAction.payload.targetId, "ally");

  await disposePendingBattle(runtime, completion);
});

test("dispose aborts an in-flight Presentation before the planned attack", async () => {
  const stage = createServiceStage({
    id: "controller_abort",
    map: [["plain", "plain", "plain"]],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }
    ]
  });
  const presentationPort = new BlockingMovePresentationPort();
  const runtime = createControllerRuntime(stage, { presentationPort });
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const targetTroopsBefore = target.troops;
  const actionPromise = runtime.controller.executeAction(
    createActionRequest(ActionType.NORMAL_ATTACK, actor, target),
    [{ x: 1, y: 0 }]
  );
  await waitUntil(
    () => presentationPort.requests.some((request) => request.type === PresentationRequestType.MOVE),
    "MOVE_PRESENTATION"
  );

  runtime.controller.dispose();

  await assert.rejects(actionPromise, { name: "AbortError" });
  await assert.rejects(completion, { name: "AbortError" });
  assert.equal(runtime.controller.isDisposed, true);
  assert.equal(runtime.controller.isStableForSave(), false);
  assert.deepEqual(stage.map.getPosition(actor), new Position(1, 0));
  assert.equal(target.troops, targetTroopsBefore);
  assert.equal(actor.actionState, UnitActionState.MOVED);
});

test("a non-abort Presentation failure is recorded and Domain resolution continues", async () => {
  const stage = createServiceStage({
    id: "controller_presentation_fallback",
    map: [["plain", "plain"]],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 1, y: 0 },
        maxTroops: 300,
        troops: 300
      }
    ]
  });
  const presentationPort = new FailingActionPresentationPort();
  const runtime = createControllerRuntime(stage, { presentationPort });
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");

  assert.equal(await runtime.controller.executeAction(
    createActionRequest(ActionType.NORMAL_ATTACK, actor, target),
    []
  ), true);

  assert.equal(target.troops < 300, true);
  assert.equal(actor.actionState, UnitActionState.FINISHED);
  assert.equal(runtime.controller.flowState, BattleFlowState.IDLE);
  assert.deepEqual(runtime.controller.getDiagnostics().map((item) => item.source), [
    "PRESENTATION"
  ]);

  await disposePendingBattle(runtime, completion);
});

test("an unexpected mutation error moves the Controller to FAULTED", async () => {
  const stage = createServiceStage({
    id: "controller_fault",
    map: [["plain", "plain", "plain"]],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "target", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }
    ]
  });
  const runtime = createControllerRuntime(stage);
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  stage.map.moveUnit = () => {
    throw new Error("TEST_MOVE_FAILURE");
  };

  await assert.rejects(
    runtime.controller.executeAction(
      createActionRequest(ActionType.NORMAL_ATTACK, actor, target),
      [{ x: 1, y: 0 }]
    ),
    /TEST_MOVE_FAILURE/
  );
  await assert.rejects(completion, /TEST_MOVE_FAILURE/);

  assert.equal(runtime.controller.flowState, BattleFlowState.FAULTED);
  assert.equal(runtime.controller.isStableForSave(), false);
  assert.equal(await runtime.controller.executeWait(actor, [], Facing.EAST), false);
  assert.deepEqual(runtime.controller.getDiagnostics().map((item) => item.source), ["DOMAIN"]);
});

test("resumeLoadedBattle reruns neither phase entry, status decay nor Trap generation", async () => {
  const stage = createServiceStage({
    id: "controller_resume",
    map: [["plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        statusEffects: [{ type: UnitStatus.CONFUSED, remainingTurns: 2 }]
      },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }
    ],
    events: [
      {
        id: "phase_entry",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START
      }
    ],
    hiddenTrapDefinitions: [
      {
        id: "load_forbidden_trap",
        kind: HiddenTrapKind.NORMAL,
        position: { x: 1, y: 0 },
        triggerAffiliations: [Affiliation.PLAYER]
      }
    ]
  });
  stage.setTurnAndPhase(3, StagePhase.PLAYER);
  stage.getUnit("enemy").setReadyForPhase(false);
  const runtime = createControllerRuntime(stage);
  const completion = runtime.controller.resumeLoadedBattle();
  await waitUntil(
    () => runtime.controller.flowState === BattleFlowState.IDLE,
    "RESUME_PLAYER"
  );

  assert.equal(stage.turn, 3);
  assert.equal(stage.phase, StagePhase.PLAYER);
  assert.equal(stage.getUnit("actor").getStatusTurns(UnitStatus.CONFUSED), 2);
  assert.equal(stage.getHiddenTraps().length, 0);
  assert.deepEqual(stage.eventManager.getCompletedEventIds(), []);
  assert.deepEqual(runtime.presentationPort.requests, []);
  assert.equal(runtime.checkpointPort.snapshots.length, 1);

  await disposePendingBattle(runtime, completion);
});

test("resumeLoadedBattle continues only remaining READY enemies before the next turn", async () => {
  const stage = createServiceStage({
    id: "controller_resume_enemy",
    map: [["plain", "plain", "plain", "plain"]],
    units: [
      {
        id: "player",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        actionState: UnitActionState.FINISHED,
        maxTroops: 500,
        troops: 500
      },
      {
        id: "enemy_ready",
        army: Affiliation.ENEMY,
        position: { x: 1, y: 0 },
        actionState: UnitActionState.READY
      },
      {
        id: "enemy_finished",
        army: Affiliation.ENEMY,
        position: { x: 3, y: 0 },
        actionState: UnitActionState.FINISHED
      }
    ]
  });
  stage.setTurnAndPhase(4, StagePhase.ENEMY);
  const runtime = createControllerRuntime(stage);
  const completion = runtime.controller.resumeLoadedBattle();

  await waitUntil(
    () => stage.turn === 5
      && stage.phase === StagePhase.PLAYER
      && runtime.controller.flowState === BattleFlowState.IDLE,
    "RESUME_ENEMY"
  );

  const actionRequests = runtime.presentationPort.requests.filter((request) => (
    request.type === PresentationRequestType.ACTION
  ));
  assert.deepEqual(actionRequests.map((request) => request.payload.actorId), [
    "enemy_ready"
  ]);
  assert.equal(stage.getUnit("player").troops < 500, true);
  assert.equal(stage.getUnit("player").actionState, UnitActionState.READY);
  assert.equal(stage.getUnit("enemy_ready").actionState, UnitActionState.FINISHED);
  assert.equal(stage.getUnit("enemy_finished").actionState, UnitActionState.FINISHED);
  assert.equal(runtime.checkpointPort.snapshots.some((snapshot) => (
    snapshot.turn === 4 && snapshot.phase === StagePhase.ENEMY
  )), true);

  await disposePendingBattle(runtime, completion);
});

test("an asynchronous checkpoint failure never blocks or faults Domain progress", async () => {
  const stage = createServiceStage({
    id: "controller_checkpoint_fallback",
    map: [["plain", "plain"]],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 1, y: 0 } }
    ]
  });
  const checkpointPort = new FailingCheckpointPort();
  const runtime = createControllerRuntime(stage, { checkpointPort });
  const { completion } = await startNewBattle(runtime);

  await waitUntil(
    () => runtime.controller.getDiagnostics().some((item) => item.source === "CHECKPOINT"),
    "CHECKPOINT_DIAGNOSTIC"
  );

  assert.equal(runtime.controller.flowState, BattleFlowState.IDLE);
  assert.equal(runtime.controller.isStableForSave(), true);
  assert.deepEqual(runtime.controller.getDiagnostics().map((item) => item.source), [
    "CHECKPOINT"
  ]);
  assert.equal(checkpointPort.snapshots.length, 1);

  await disposePendingBattle(runtime, completion);
});
