import test from "node:test";
import assert from "node:assert/strict";

import { createActionQueryContext } from "../src/core/action-query-context.js";
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

test("player and enemy tactic success dialogues finish before checkpoints or the next phase, and abort safely", async () => {
  for (const enemy of [false, true]) for (const abort of [false, true]) {
    const stage = createServiceStage({ units: [
      { id: "caster", army: enemy ? "ENEMY" : "PLAYER", position: { x: 0, y: 0 }, move: 0,
        character: { intelligence: 100 }, abilities: [UnitAbility.CONFUSION_LEVEL_1], maxUses: { strategy: 2 } },
      { id: "target", army: enemy ? "PLAYER" : "ENEMY", position: { x: 2, y: 0 }, move: 0,
        character: { intelligence: 0 } }
    ] });
    let release;
    const port = new RecordingPresentationPort();
    port.present = async (request, signal) => {
      port.requests.push(request);
      if (request.type !== "DIALOGUE" || request.dialogue.id !== "tactic_success") return;
      await new Promise((resolve, reject) => {
        const cancel = () => reject(Object.assign(new Error("TEST_ABORT"), { name: "AbortError" }));
        release = () => { signal.removeEventListener("abort", cancel); resolve(); };
        signal.addEventListener("abort", cancel, { once: true });
      });
    };
    const runtime = createControllerRuntime(stage, { presentationPort: port });
    const { completion } = await startNewBattle(runtime); completion.catch(() => {});
    const action = enemy ? runtime.controller.endPlayerTurn()
      : runtime.controller.executeAction(createActionRequest(ActionType.CONFUSION_LV1, stage.getUnit("caster"), stage.getUnit("target")));
    action.catch(() => {});
    try {
      await waitUntil(() => typeof release === "function", "TACTIC_RESULT_WAIT");
      assert.equal(runtime.controller.isStableForSave(), false);
      assert.equal(stage.turn, 1);
      assert.equal(stage.phase, enemy ? "ENEMY" : "PLAYER");
      assert.equal(port.requests.at(-1).dialogue.speeches[0].speaker, stage.getUnit("caster").character);
      const before = createStageDigest(stage), random = runtime.battleRandom.exportState();
      const saves = runtime.checkpointPort.snapshots.length;
      assert.equal(await runtime.controller.endPlayerTurn(), false);
      assert.equal(await runtime.controller.finalizeTacticFacing(stage.getUnit("caster"), Facing.NORTH), false);
      assert.equal(createStageDigest(stage), before);
      assert.deepEqual(runtime.battleRandom.exportState(), random);
      if (abort) {
        runtime.controller.dispose();
        await assert.rejects(action, { name: "AbortError" });
        assert.equal(runtime.checkpointPort.snapshots.length, saves);
        assert.equal(createStageDigest(stage), before);
      } else {
        release(); assert.equal(await action, true);
        assert.equal(stage.turn, enemy ? 2 : 1);
        assert.equal(runtime.checkpointPort.snapshots.length > saves, true);
      }
      assert.deepEqual(runtime.controller.getDiagnostics(), []);
    } finally { runtime.controller.dispose(); await completion.catch(() => {}); }
  }
});

class RecordingCheckpointPort {
  constructor() {
    this.snapshots = [];
    this.clearCount = 0;
  }

  requestRecoverySave(snapshot) {
    this.snapshots.push(snapshot);
  }

  requestRecoveryClear() {
    this.clearCount += 1;
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

test("committed movement faces along each step before presentation and preserves the chosen wait facing", async () => {
  const stage = createServiceStage({ id: "movement_facing", map: Array.from({ length: 3 }, () => Array(4).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 }, facing: Facing.SOUTH },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }] });
  const actor = stage.getUnit("actor"), steps = [];
  const runtime = createControllerRuntime(stage, { presentationPort: { async present(request) {
    if (request.type === PresentationRequestType.MOVE) steps.push({ position: stage.map.getPosition(actor).toKey(), facing: actor.facing });
  } } });
  const { completion } = await startNewBattle(runtime);
  try {
    const random = runtime.battleRandom.exportState();
    assert.equal(await runtime.controller.executeWait(actor, [{ x: 1, y: 2 }, { x: 1, y: 1 }], Facing.WEST), true);
    assert.deepEqual(steps, [{ position: "1,2", facing: Facing.EAST }, { position: "1,1", facing: Facing.NORTH }]);
    assert.equal(actor.facing, Facing.WEST);
    assert.deepEqual(runtime.battleRandom.exportState(), random);
    assert.equal(runtime.controller.createSaveSnapshot().units.find(unit => unit.id === actor.id).facing, Facing.WEST);
  } finally { await disposePendingBattle(runtime, completion); }
});

test("escape during committed movement retains the direction of arrival rather than the old or planned wait facing", async () => {
  const stage = createServiceStage({ id: "escape_facing", map: Array.from({ length: 3 }, () => Array(4).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 }, facing: Facing.SOUTH },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }],
    objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
      unitIds: ["actor"], destination: { x: 1, y: 1 }, radius: 0 }] });
  const runtime = createControllerRuntime(stage), actor = stage.getUnit("actor");
  const { completion } = await startNewBattle(runtime);
  try {
    assert.equal(await runtime.controller.executeWait(actor, [{ x: 1, y: 2 }, { x: 1, y: 1 }], Facing.WEST), true);
    assert.equal((await completion).objectiveId, "escape");
    assert.equal(actor.facing, Facing.NORTH);
    assert.equal(stage.map.getPosition(actor).toKey(), "1,1");
    assert.deepEqual(runtime.controller.getDiagnostics(), []);
  } finally { runtime.controller.dispose(); }
});

test("escape movement queries and rejected commands preserve Domain, random, logs and checkpoints", async () => {
  const stage = createServiceStage({ id: "escape_command", map: Array.from({ length: 3 }, () => Array(4).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }],
    objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
      unitIds: ["actor"], destination: { x: 1, y: 1 } }] });
  const runtime = createControllerRuntime(stage), { controller, battleRandom, checkpointPort, presentationPort } = runtime;
  const actor = stage.getUnit("actor"), path = [{ x: 1, y: 2 }, { x: 1, y: 1 }];
  const { completion } = await startNewBattle(runtime);
  try {
    const before = createStageDigest(stage), random = battleRandom.exportState();
    const snapshots = checkpointPort.snapshots.length, presentations = presentationPort.requests.length;
    const logs = stage.battleLog.getEntries();
    assert.equal(controller.canExecuteImmediateMove(actor, path), true);
    for (const [unit, invalidPath] of [[actor, []], [actor, null], [actor, [null]], [null, path],
      [stage.getUnit("enemy"), path], [actor, [{ x: 1, y: 1 }]],
      [actor, [{ x: 0, y: 1 }]], [actor, [...path, { x: 2, y: 1 }]]]) {
      assert.equal(controller.canExecuteImmediateMove(unit, invalidPath), false);
      assert.equal(await controller.executeImmediateMove(unit, invalidPath), false);
    }
    assert.equal(createStageDigest(stage), before);
    assert.deepEqual(battleRandom.exportState(), random);
    assert.deepEqual(stage.battleLog.getEntries(), logs);
    assert.equal(checkpointPort.snapshots.length, snapshots);
    assert.equal(presentationPort.requests.length, presentations);
    const accepted = controller.executeImmediateMove(actor, path);
    assert.equal(controller.canExecuteImmediateMove(actor, path), false);
    assert.equal(await controller.executeImmediateMove(actor, path), false, "in-flight input must be rejected");
    assert.equal(await accepted, true);
    assert.equal((await completion).objectiveId, "escape");
    assert.equal(await controller.executeImmediateMove(actor, path), false, "finished battle must reject input");
    assert.equal(stage.map.getPosition(actor).toKey(), "1,1");
    assert.equal(actor.facing, Facing.NORTH);
    assert.deepEqual(battleRandom.exportState(), random);
    assert.equal(checkpointPort.clearCount, 1);
    assert.equal(presentationPort.requests.filter(request => request.type === PresentationRequestType.BATTLE_RESULT).length, 1);
    assert.equal(presentationPort.requests.some(request => request.type === PresentationRequestType.ACTION), false);
  } finally { controller.dispose(); await completion.catch(() => {}); }
});

test("trap reactions follow damage and status, including defeat and spell neutralization", async () => {
  const cases = [
    ["normal", 125, [], "actor", "罠", "しまった、罠だ！　隊列が乱れた。ここで立て直すぞ！"],
    ["normal", 10, [], "actor", "罠", "ぐっ……足元に罠が……！"],
    ["spell", 125, [], "actor", "妖術罠", "何だ、この妖気は……！　敵と味方の姿が歪んで見える！"],
    ["spell", 5, [], "actor", "妖術罠", "ぐっ……地面から妖気が……ここにも術が仕込まれていたか……！"],
    ["spell", 125, [UnitAbility.ILLUSION], "actor", "妖術罠無効", "術の流れは見切った。この幻術罠は私には通じぬ――破！"],
    ["spell", 125, [UnitAbility.ILLUSION], "公孫勝", "妖術罠無効", "妖符の理は見切りました。この程度の幻術罠ならば――破！"]
  ];
  for (const [kind, troops, abilities, name, label, text] of cases) {
    const stage = createServiceStage({ id: "trap_reactions", map: [["plain", "plain", "plain"]],
      units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 }, troops, abilities, character: { name } },
        { id: "enemy", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }],
      objectives: [{ id: "leader_lost", type: ObjectiveType.UNIT_DEFEAT, outcome: ObjectiveOutcome.DEFEAT, unitIds: ["actor"] }],
      hiddenTrapDefinitions: [{ id: "trap", kind, position: { x: 1, y: 0 }, triggerAffiliations: [Affiliation.PLAYER] }] });
    const runtime = createControllerRuntime(stage), { controller, presentationPort } = runtime;
    const { completion } = await startNewBattle(runtime);
    try {
      const start = presentationPort.requests.length, actor = stage.getUnit("actor");
      assert.equal(await controller.executeImmediateMove(actor, [{ x: 1, y: 0 }]), true);
      const requests = presentationPort.requests.slice(start), dialogue = requests.find(request => request.type === "DIALOGUE");
      assert.equal(dialogue.dialogue.speeches[0].speaker, actor.character);
      assert.equal(dialogue.dialogue.speeches[0].actionLabel, label);
      assert.equal(dialogue.dialogue.speeches[0].text, text);
      const neutralized = abilities.length > 0, defeated = !actor.hasTroops();
      assert.deepEqual(requests.map(request => request.type), ["MOVE", "TRAP",
        ...(!neutralized ? ["DAMAGE"] : []), ...(!neutralized && !defeated ? ["STATUS"] : []),
        "DIALOGUE", ...(defeated ? ["BATTLE_RESULT"] : [])]);
      if (defeated) assert.equal((await completion).objectiveId, "leader_lost");
      else assert.equal(controller.isStableForSave(), true);
      assert.deepEqual(controller.getDiagnostics(), []);
    } finally { controller.dispose(); await completion.catch(() => {}); }
  }
});

test("immediate trap movement queries are pure and reject a trap consumed before the command", async () => {
  const stage = createServiceStage({ id: "trap_query", map: [["plain", "plain", "plain", "plain"]],
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }],
    hiddenTrapDefinitions: [{ id: "trap", kind: HiddenTrapKind.NORMAL, position: { x: 1, y: 0 },
      triggerAffiliations: [Affiliation.PLAYER] }] });
  const runtime = createControllerRuntime(stage), { controller, battleRandom, checkpointPort, presentationPort } = runtime;
  const { completion } = await startNewBattle(runtime);
  try {
    const actor = stage.getUnit("actor"), path = [{ x: 1, y: 0 }, { x: 2, y: 0 }];
    const before = controller.createSaveSnapshot(), random = battleRandom.exportState();
    const checkpoints = checkpointPort.snapshots.length, presentations = presentationPort.requests.length;
    assert.equal(controller.canExecuteImmediateMove(actor, path), true);
    for (const invalidPath of [[], null, [{ x: 2, y: 0 }], [...path, { x: 3, y: 0 }]]) {
      assert.equal(controller.canExecuteImmediateMove(actor, invalidPath), false);
      assert.equal(await controller.executeImmediateMove(actor, invalidPath), false);
    }
    assert.deepEqual(controller.createSaveSnapshot(), before);
    assert.deepEqual(battleRandom.exportState(), random);
    assert.equal(checkpointPort.snapshots.length, checkpoints);
    assert.equal(presentationPort.requests.length, presentations);
    stage.getHiddenTraps()[0].deactivate();
    const consumed = controller.createSaveSnapshot();
    assert.equal(await controller.executeImmediateMove(actor, path), false);
    assert.deepEqual(controller.createSaveSnapshot(), consumed);
    assert.equal(checkpointPort.snapshots.length, checkpoints);
    assert.equal(presentationPort.requests.length, presentations);
  } finally { await disposePendingBattle(runtime, completion); }
});

test("escape movement rechecks a changed objective gate before accepting the command", async () => {
  const stage = createServiceStage({ id: "escape_gate", map: [["plain", "plain", "plain"]],
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 2, y: 0 } }],
    events: [{ id: "close_exit", type: StageEventType.MISSION_TRANSITION, trigger: StageEventTrigger.AFTER_OPERATION }],
    objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
      unitIds: ["actor"], destination: { x: 1, y: 0 }, inactiveAfterEventId: "close_exit" }] });
  const runtime = createControllerRuntime(stage), actor = stage.getUnit("actor"), path = [{ x: 1, y: 0 }];
  const { completion } = await startNewBattle(runtime);
  try {
    assert.equal(runtime.controller.canExecuteImmediateMove(actor, path), true);
    stage.eventManager.markCompleted(stage.eventManager.get("close_exit"));
    const before = createStageDigest(stage), random = runtime.battleRandom.exportState();
    assert.equal(await runtime.controller.executeImmediateMove(actor, path), false);
    assert.equal(createStageDigest(stage), before);
    assert.deepEqual(runtime.battleRandom.exportState(), random);
  } finally { await disposePendingBattle(runtime, completion); }
});

test("an escape attempt stopped by a trap uses the actual stop and gives defeat priority", async () => {
  for (const [troops, destinationX, expected] of [[125, 2, null], [125, 1, BattleOutcome.VICTORY], [10, 1, BattleOutcome.DEFEAT]]) {
    const stage = createServiceStage({ id: `escape_trap_${troops}_${destinationX}`, map: [["plain", "plain", "plain", "plain"]],
      units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 }, troops },
        { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }],
      objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
        unitIds: ["actor"], destination: { x: destinationX, y: 0 } },
        { id: "leader_lost", type: ObjectiveType.UNIT_DEFEAT, outcome: ObjectiveOutcome.DEFEAT, unitIds: ["actor"] }],
      hiddenTrapDefinitions: [{ id: "trap", kind: HiddenTrapKind.NORMAL, position: { x: 1, y: 0 },
        triggerAffiliations: [Affiliation.PLAYER] }] });
    const runtime = createControllerRuntime(stage), actor = stage.getUnit("actor");
    const { completion } = await startNewBattle(runtime);
    try {
      const path = runtime.controller.getCandidatePaths(actor, { x: destinationX, y: 0 })[0];
      assert.equal(runtime.controller.canExecuteImmediateMove(actor, path), true);
      assert.equal(await runtime.controller.executeImmediateMove(actor, path), true);
      assert.equal(runtime.controller.getBattleResult()?.outcome ?? null, expected);
      assert.equal(stage.map.getPosition(actor)?.toKey() ?? null, troops > 20 ? "1,0" : null);
      assert.equal(actor.facing, Facing.EAST);
      if (expected === null) {
        assert.equal(actor.actionState, UnitActionState.FINISHED);
        assert.equal(runtime.controller.isStableForSave(), true);
        assert.equal(runtime.controller.createSaveSnapshot().units.find(unit => unit.id === actor.id).troops, 105);
      } else {
        assert.equal((await completion).objectiveId, expected === BattleOutcome.DEFEAT ? "leader_lost" : "escape");
      }
      assert.equal(stage.validateRuntime(), true);
    } finally { runtime.controller.dispose(); await completion.catch(() => {}); }
  }
});

test("crossing an escape zone without stopping there does not end the battle", async () => {
  const stage = createServiceStage({ id: "escape_crossing", map: Array.from({ length: 3 }, () => Array(4).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }],
    objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
      unitIds: ["actor"], destination: { x: 1, y: 1 } }] });
  const runtime = createControllerRuntime(stage), actor = stage.getUnit("actor");
  const { completion } = await startNewBattle(runtime);
  try {
    assert.equal(await runtime.controller.executeWait(actor, [{ x: 1, y: 2 }, { x: 1, y: 1 }, { x: 2, y: 1 }], Facing.SOUTH), true);
    assert.equal(runtime.controller.getBattleResult(), null);
    assert.equal(stage.map.getPosition(actor).toKey(), "2,1");
    assert.equal(actor.actionState, UnitActionState.FINISHED);
    assert.equal(runtime.controller.isStableForSave(), true);
  } finally { runtime.controller.dispose(); await completion.catch(() => {}); }
});

test("entering an escape radius finishes the selected path before presenting victory", async () => {
  const stage = createServiceStage({ id: "escape_radius", map: Array.from({ length: 2 }, () => Array(5).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 4, y: 1 } }],
    objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
      unitIds: ["actor"], destination: { x: 3, y: 0 }, radius: 1 }] });
  const runtime = createControllerRuntime(stage), actor = stage.getUnit("actor");
  const { completion } = await startNewBattle(runtime);
  try {
    assert.equal(await runtime.controller.executeWait(actor, [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }], Facing.SOUTH), true);
    assert.equal((await completion).objectiveId, "escape");
    assert.equal(stage.map.getPosition(actor).toKey(), "3,0");
    assert.equal(actor.facing, Facing.EAST);
    assert.equal(runtime.presentationPort.requests.filter(request => request.type === PresentationRequestType.MOVE).length, 3);
  } finally { runtime.controller.dispose(); }
});

test("a trap that stops movement inside the escape zone still resolves victory there", async () => {
  const stage = createServiceStage({ id: "escape_trap_stop", map: [["plain", "plain", "plain", "plain"]],
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 3, y: 0 } }],
    objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
      unitIds: ["actor"], destination: { x: 1, y: 0 } }],
    hiddenTrapDefinitions: [{ id: "trap", kind: HiddenTrapKind.NORMAL, position: { x: 1, y: 0 },
      triggerAffiliations: [Affiliation.PLAYER] }] });
  const runtime = createControllerRuntime(stage), actor = stage.getUnit("actor");
  const { completion } = await startNewBattle(runtime);
  try {
    assert.equal(await runtime.controller.executeWait(actor, [{ x: 1, y: 0 }, { x: 2, y: 0 }], Facing.WEST), true);
    assert.equal((await completion).objectiveId, "escape");
    assert.equal(stage.map.getPosition(actor).toKey(), "1,0");
    assert.equal(actor.troops, actor.maxTroops - 20);
    assert.equal(actor.facing, Facing.EAST);
    assert.deepEqual(runtime.controller.getDiagnostics(), []);
  } finally { runtime.controller.dispose(); }
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
    ],
    speeches: [{
      id: "victory_speech",
      speakerCharacterId: "actor_character",
      text: "Victory dialogue."
    }],
    dialogues: [{ id: "victory_dialogue", speechIds: ["victory_speech"] }],
    victoryDialogueId: "victory_dialogue"
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
  assert.equal(runtime.checkpointPort.clearCount, 1);
  assert.deepEqual(runtime.presentationPort.requests.map((item) => item.type).slice(-5), [
    PresentationRequestType.MOVE,
    PresentationRequestType.ACTION,
    PresentationRequestType.DAMAGE,
    PresentationRequestType.BATTLE_RESULT,
    PresentationRequestType.DIALOGUE
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
  assert.equal(actor.facing, Facing.EAST, "a trap must preserve the direction of the interrupted step");
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

test("friendly-fire casualties finish their action before phase-start or elemental checkpoints", async () => {
  for (const type of ["ILLUSION", "FIRE", "WATER"]) {
    const stage = createServiceStage({ id: `friendly_casualty_${type.toLowerCase()}`,
      map: [Array(5).fill("plain")], units: [
        { id: "actor", army: "PLAYER", position: { x: 0, y: 0 },
          abilities: [UnitAbility.FIRE_TACTIC, UnitAbility.WATER_TACTIC], maxUses: { strategy: 3 },
          statusEffects: type === "ILLUSION" ? [{ type: "ILLUSION", remainingTurns: 1 }] : [] },
        { id: "ally", army: "PLAYER", position: { x: 1, y: 0 }, maxTroops: 1, troops: 1 },
        { id: "target", army: "ENEMY", position: { x: 2, y: 0 }, maxTroops: 500, troops: 500 }
      ] });
    const runtime = createControllerRuntime(stage), { controller, checkpointPort } = runtime;
    const { completion } = await startNewBattle(runtime);
    try {
      const actor = stage.getUnit("actor"), ally = stage.getUnit("ally");
      if (type !== "ILLUSION") {
        assert.equal(await controller.executeAction(createActionRequest(type, actor, stage.getUnit("target")), []), true);
        assert.equal(actor.actionState, "TACTIC_COMMITTED");
        assert.equal(await controller.finalizeTacticFacing(actor, "EAST"), true);
      }
      assert.equal(ally.troops, 0);
      assert.equal(stage.map.getPosition(ally), null);
      assert.equal(ally.actionState, "FINISHED", type);
      assert.equal(controller.getBattleResult(), null);
      assert.equal(controller.isStableForSave(), true);
      assert.doesNotThrow(() => controller.createSaveSnapshot());
      assert.ok(checkpointPort.snapshots.length > 0);
      const savedAlly = checkpointPort.snapshots.at(-1).units.find(unit => unit.id === "ally");
      assert.equal(savedAlly.troops, 0); assert.equal(savedAlly.position, null);
      assert.equal(savedAlly.actionState, "FINISHED");
      assert.equal(stage.battleLog.getEntries().filter(entry => entry.type === "DEFEATED").length, 1);
      assert.deepEqual(controller.getDiagnostics(), []);
    } finally { await disposePendingBattle(runtime, completion); }
  }
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


test("battle log records committed damage once, survives checkpoints and is unchanged by queries or resume", async () => {
  const stage = createServiceStage({ id: "record_battle", map: [["plain", "plain", "plain"]],
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 1, y: 0 }, maxTroops: 500, troops: 500 }] });
  const runtime = createControllerRuntime(stage, { presentationPort: new FailingActionPresentationPort() });
  const { completion } = await startNewBattle(runtime);
  const actor = stage.getUnit("actor"), enemy = stage.getUnit("enemy");
  const initial = stage.battleLog.getEntries();
  assert.match(initial[0].text, /味方ターン 1/);
  runtime.controller.getReachableCells(actor); runtime.controller.getAvailableActions(createActionQueryContext(actor, stage.map.getPosition(actor)));
  assert.deepEqual(stage.battleLog.getEntries(), initial);
  const beforeTroops = enemy.troops;
  assert.equal(await runtime.controller.executeAction(createActionRequest(ActionType.NORMAL_ATTACK, actor, enemy), []), true);
  const entries = stage.battleLog.getEntries();
  const actions = entries.filter((entry) => entry.type === "ACTION");
  assert.equal(actions.length, 1); assert.match(actions[0].text, new RegExp(`${beforeTroops - enemy.troops}ダメージ`));
  assert.deepEqual(actions[0].unitIds, ["actor", "enemy"]);
  assert.deepEqual(runtime.checkpointPort.snapshots.at(-1).logs, entries);
  await disposePendingBattle(runtime, completion);
  const resumed = createControllerRuntime(stage), resumedCompletion = resumed.controller.resumeLoadedBattle();
  await waitUntil(() => resumed.controller.isStableForSave(), "LOG_RESUME");
  assert.deepEqual(stage.battleLog.getEntries(), entries);
  await disposePendingBattle(resumed, resumedCompletion);
});
