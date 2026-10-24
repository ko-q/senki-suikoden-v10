import test from "node:test";
import assert from "node:assert/strict";

import { ObjectiveOutcome, ObjectiveType, UnitDefeatMatch } from "../src/domain/objective.js";
import { StageEventTrigger, StageEventType } from "../src/domain/stage-event.js";
import { StagePhase } from "../src/domain/stage.js";
import { createStage, createStageDigest } from "../test-support/fixtures.js";
import { Affiliation, createServiceStage } from "../test-support/service-fixtures.js";

test("projected escape requires every living deployed participant and an active victory objective", () => {
  const stage = createServiceStage({ id: "projected_escape", map: Array.from({ length: 3 }, () => Array(5).fill("plain")),
    units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 2 } },
      { id: "partner", army: Affiliation.PLAYER, position: { x: 3, y: 1 } },
      { id: "other", army: Affiliation.PLAYER, position: { x: 0, y: 0 } }],
    events: ["open", "close"].map(id => ({ id, type: StageEventType.MISSION_TRANSITION, trigger: StageEventTrigger.AFTER_OPERATION })),
    objectives: [{ id: "reach_defeat", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.DEFEAT,
      unitIds: ["actor"], destination: { x: 2, y: 0 } },
      { id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
        unitIds: ["actor", "partner"], destination: { x: 3, y: 0 }, radius: 1,
        activeAfterEventId: "open", inactiveAfterEventId: "close" }] });
  const actor = stage.getUnit("actor"), partner = stage.getUnit("partner"), manager = stage.objectiveManager;
  const forecast = (unit = actor, destination = { x: 2, y: 0 }) => {
    const before = createStageDigest(stage), events = stage.eventManager.getCompletedEventIds();
    const result = manager.findReachVictoryAfterMove(stage, unit, destination)?.id ?? null;
    assert.equal(createStageDigest(stage), before);
    assert.deepEqual(stage.eventManager.getCompletedEventIds(), events);
    return result;
  };
  assert.equal(forecast(), null);
  stage.eventManager.markCompleted(stage.eventManager.get("open"));
  assert.equal(forecast(), "escape");
  assert.equal(manager.evaluateVictory(stage), null, "forecast must not move the actor");
  assert.equal(forecast(stage.getUnit("other")), null);
  assert.equal(forecast(actor, { x: 2, y: 1 }), null, "radius uses Manhattan distance");
  stage.map.moveUnit(partner, { x: 4, y: 1 });
  assert.equal(forecast(), null);
  stage.map.removeUnit(partner);
  assert.equal(forecast(), null, "an undeployed partner cannot escape");
  stage.map.placeUnit(partner, { x: 3, y: 1 });
  stage.map.removeUnit(actor);
  assert.equal(forecast(), null, "a forecast cannot deploy the moving unit");
  stage.map.placeUnit(actor, { x: 0, y: 2 });
  stage.eventManager.markCompleted(stage.eventManager.get("close"));
  assert.equal(forecast(), null);
});

test("projected escape never counts a defeated required unit", () => {
  for (const defeatedId of ["actor", "partner"]) {
    const stage = createServiceStage({ id: `projected_defeat_${defeatedId}`, map: [["plain", "plain", "plain", "plain"]],
      units: [{ id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
        { id: "partner", army: Affiliation.PLAYER, position: { x: 3, y: 0 } }],
      objectives: [{ id: "escape", type: ObjectiveType.REACH, outcome: ObjectiveOutcome.VICTORY,
        unitIds: ["actor", "partner"], destination: { x: 2, y: 0 }, radius: 1 }] });
    const defeated = stage.getUnit(defeatedId);
    defeated.applyDamage(defeated.maxTroops);
    assert.equal(stage.objectiveManager.findReachVictoryAfterMove(stage, stage.getUnit("actor"), { x: 1, y: 0 }), null);
  }
});

test("EliminationObjective ignores unassigned reinforcements and obeys Event gating", () => {
  const stage = createStage({
    id: "elimination_objective_test",
    events: [
      {
        id: "reinforcement_arrived",
        type: StageEventType.MISSION_TRANSITION,
        trigger: StageEventTrigger.PHASE_START
      }
    ],
    objectives: [
      {
        id: "eliminate_enemy",
        type: ObjectiveType.ELIMINATION,
        outcome: ObjectiveOutcome.VICTORY,
        targetArmy: "ENEMY",
        activeAfterEventId: "reinforcement_arrived"
      }
    ]
  });
  const enemy = stage.getUnit("elimination_objective_test_enemy");
  enemy.applyDamage(enemy.maxTroops);

  assert.equal(stage.objectiveManager.evaluateVictory(stage), null);
  stage.eventManager.markCompleted(stage.eventManager.get("reinforcement_arrived"));
  assert.equal(stage.objectiveManager.evaluateVictory(stage)?.id, "eliminate_enemy");
});

test("ReachObjective reads the current BattleMap position without removing its Unit", () => {
  const stage = createStage({
    id: "reach_objective_test",
    objectives: [
      {
        id: "reach_exit",
        type: ObjectiveType.REACH,
        outcome: ObjectiveOutcome.VICTORY,
        unitIds: ["reach_objective_test_player"],
        destination: { x: 1, y: 1 },
        radius: 0
      }
    ]
  });
  const player = stage.getUnit("reach_objective_test_player");

  assert.equal(stage.objectiveManager.evaluateVictory(stage), null);
  stage.map.moveUnit(player, { x: 1, y: 1 });

  assert.equal(stage.objectiveManager.evaluateVictory(stage)?.id, "reach_exit");
  assert.equal(stage.map.getCellAt(1, 1).occupant, player);
});

test("UnitDefeatObjective keeps ANY and ALL conjunction inside the Objective", () => {
  const stage = createStage({
    id: "unit_defeat_objective_test",
    objectives: [
      {
        id: "player_any_defeated",
        type: ObjectiveType.UNIT_DEFEAT,
        outcome: ObjectiveOutcome.DEFEAT,
        unitIds: ["unit_defeat_objective_test_player"],
        match: UnitDefeatMatch.ANY
      },
      {
        id: "all_targets_defeated",
        type: ObjectiveType.UNIT_DEFEAT,
        outcome: ObjectiveOutcome.VICTORY,
        unitIds: ["unit_defeat_objective_test_enemy"],
        match: UnitDefeatMatch.ALL
      }
    ]
  });
  const player = stage.getUnit("unit_defeat_objective_test_player");
  const enemy = stage.getUnit("unit_defeat_objective_test_enemy");

  enemy.applyDamage(enemy.maxTroops);
  assert.equal(stage.objectiveManager.evaluateVictory(stage)?.id, "all_targets_defeated");
  assert.equal(stage.objectiveManager.evaluateDefeat(stage), null);

  player.applyDamage(player.maxTroops);
  assert.equal(stage.objectiveManager.evaluateDefeat(stage)?.id, "player_any_defeated");
});

test("TurnLimit and SurviveUntilTurn are evaluated only at their phase checkpoints", () => {
  const stage = createStage({
    id: "timed_objective_test",
    objectives: [
      {
        id: "turn_limit",
        type: ObjectiveType.TURN_LIMIT,
        maxTurn: 3
      },
      {
        id: "survive",
        type: ObjectiveType.SURVIVE_UNTIL_TURN,
        targetTurn: 3
      }
    ]
  });
  stage.setTurnAndPhase(3, StagePhase.PLAYER);

  assert.equal(stage.objectiveManager.evaluateVictory(stage), null);
  assert.equal(stage.objectiveManager.evaluateDefeat(stage), null);
  assert.equal(stage.objectiveManager.evaluatePlayerPhaseEndDefeat(stage)?.id, "turn_limit");
  assert.equal(stage.objectiveManager.evaluatePlayerPhaseStartVictory(stage)?.id, "survive");
});
