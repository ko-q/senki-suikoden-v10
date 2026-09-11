import { invariant, requireEnumValue } from "./domain-error.js";
import { Objective } from "../domain/objective.js";
import { Stage } from "../domain/stage.js";

export const BattleOutcome = Object.freeze({
  VICTORY: "VICTORY",
  DEFEAT: "DEFEAT"
});

/**
 * Gameへ返す戦闘終了結果をdata-only snapshotとして固定する。
 */
export function createBattleResult({ stage, outcome, objective }) {
  invariant(stage instanceof Stage, "BATTLE_RESULT_STAGE_REQUIRED");
  requireEnumValue(outcome, BattleOutcome, "BATTLE_RESULT_OUTCOME_INVALID");
  invariant(objective instanceof Objective, "BATTLE_RESULT_OBJECTIVE_REQUIRED");
  return Object.freeze({
    stageId: stage.id,
    outcome,
    objectiveId: objective.id,
    turn: stage.turn,
    phase: stage.phase
  });
}
