import { invariant } from "../core/domain-error.js";
import { Unit, UnitStatus } from "../domain/unit.js";

export const PhaseStartStatusResult = Object.freeze({
  NONE: "NONE",
  CONFUSION_SKIP: "CONFUSION_SKIP",
  ILLUSION: "ILLUSION"
});

/**
 * phase開始時の状態残りターンと、そのphaseに発動する効果だけを確定する。
 */
export class StatusService {
  processPhaseStart(unit) {
    invariant(unit instanceof Unit, "STATUS_UNIT_REQUIRED");
    const hadConfusion = unit.getStatusTurns(UnitStatus.CONFUSED) > 0;
    const hadIllusion = unit.getStatusTurns(UnitStatus.ILLUSION) > 0;

    if (hadConfusion) {
      unit.setStatus(
        UnitStatus.CONFUSED,
        unit.getStatusTurns(UnitStatus.CONFUSED) - 1
      );
    }
    if (hadIllusion) {
      unit.setStatus(
        UnitStatus.ILLUSION,
        unit.getStatusTurns(UnitStatus.ILLUSION) - 1
      );
    }

    if (hadIllusion) {
      return PhaseStartStatusResult.ILLUSION;
    }
    if (hadConfusion) {
      return PhaseStartStatusResult.CONFUSION_SKIP;
    }
    return PhaseStartStatusResult.NONE;
  }
}
