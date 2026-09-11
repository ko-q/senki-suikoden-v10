import {
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireIntegerInRange
} from "./domain-error.js";
import { Stage } from "../domain/stage.js";

export const BattleResumeKind = Object.freeze({
  UNIT_SELECT: "UNIT_SELECT",
  TACTIC_FACING_SELECT: "TACTIC_FACING_SELECT",
  ENEMY_CONTINUE: "ENEMY_CONTINUE"
});

export function createResumeContext(kind, committedUnitId = null) {
  requireEnumValue(kind, BattleResumeKind, "BATTLE_RESUME_KIND_INVALID");
  if (kind === BattleResumeKind.TACTIC_FACING_SELECT) {
    requireIdentifier(committedUnitId, "BATTLE_RESUME_UNIT_ID_INVALID");
  } else {
    invariant(committedUnitId === null, "BATTLE_RESUME_UNIT_ID_FORBIDDEN");
  }
  return Object.freeze({ kind, committedUnitId });
}

/**
 * 旧sessionを変更せず、新sessionを組み立てられるところまで検証済みのLoad結果。
 */
export class PreparedBattleLoad {
  constructor({ document, stage, randomState, resumeContext, sourceRevision }) {
    invariant(document !== null && typeof document === "object", "PREPARED_LOAD_DOCUMENT_REQUIRED");
    invariant(stage instanceof Stage, "PREPARED_LOAD_STAGE_REQUIRED");
    invariant(
      randomState !== null
        && typeof randomState === "object"
        && randomState.algorithm === "xorshift32"
        && Number.isInteger(randomState.state),
      "PREPARED_LOAD_RANDOM_STATE_INVALID"
    );
    invariant(
      resumeContext !== null
        && typeof resumeContext === "object"
        && Object.values(BattleResumeKind).includes(resumeContext.kind),
      "PREPARED_LOAD_RESUME_CONTEXT_INVALID"
    );
    requireIntegerInRange(
      sourceRevision,
      1,
      Number.MAX_SAFE_INTEGER,
      "PREPARED_LOAD_SOURCE_REVISION_INVALID"
    );
    this.document = document;
    this.stage = stage;
    this.randomState = Object.freeze({
      algorithm: randomState.algorithm,
      state: randomState.state
    });
    this.resumeContext = resumeContext;
    this.sourceRevision = sourceRevision;
    Object.freeze(this);
  }
}
