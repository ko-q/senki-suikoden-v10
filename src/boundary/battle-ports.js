import { invariant } from "../core/domain-error.js";
import { validatePresentationRequest } from "../core/presentation-request.js";

const BATTLE_COMMAND_METHODS = Object.freeze([
  "createSaveSnapshot",
  "dispose",
  "endPlayerTurn",
  "executeAction",
  "executeWait",
  "finalizeTacticFacing",
  "getActionTargets",
  "getAvailableActions",
  "getBattleResult",
  "getCandidatePaths",
  "getReachableCells",
  "getStage",
  "isStableForSave"
]);

/**
 * BattleScreenが利用するcommand/query境界を構造で検査する。
 */
export function requireBattleCommandPort(port) {
  invariant(port !== null && typeof port === "object", "BATTLE_COMMAND_PORT_REQUIRED");
  for (const methodName of BATTLE_COMMAND_METHODS) {
    invariant(typeof port[methodName] === "function", "BATTLE_COMMAND_METHOD_REQUIRED", {
      methodName
    });
  }
  invariant(typeof port.flowState === "string", "BATTLE_COMMAND_FLOW_STATE_REQUIRED");
  return port;
}

/**
 * Presentation実装が満たす構造契約を検査する。
 */
export function requireBattlePresentationPort(port) {
  invariant(port !== null && typeof port === "object", "BATTLE_PRESENTATION_PORT_REQUIRED");
  invariant(typeof port.present === "function", "BATTLE_PRESENTATION_METHOD_REQUIRED");
  return port;
}

/**
 * 回復保存adapterが満たす構造契約を検査する。
 */
export function requireBattleCheckpointPort(port) {
  invariant(port !== null && typeof port === "object", "BATTLE_CHECKPOINT_PORT_REQUIRED");
  invariant(
    typeof port.requestRecoverySave === "function",
    "BATTLE_CHECKPOINT_METHOD_REQUIRED"
  );
  invariant(
    typeof port.requestRecoveryClear === "function",
    "BATTLE_CHECKPOINT_CLEAR_METHOD_REQUIRED"
  );
  return port;
}

/**
 * 画面未接続のtestやDomain検証で使う無表示Port。
 */
export class NullBattlePresentationPort {
  async present(request, abortSignal) {
    validatePresentationRequest(request);
    invariant(abortSignal instanceof AbortSignal, "BATTLE_ABORT_SIGNAL_REQUIRED");
    if (abortSignal.aborted) {
      const error = new Error("BATTLE_PRESENTATION_ABORTED");
      error.name = "AbortError";
      throw error;
    }
    return null;
  }
}

/**
 * SaveService接続前に使う無保存Port。
 */
export class NullBattleCheckpointPort {
  requestRecoverySave(snapshot) {
    invariant(snapshot !== null && typeof snapshot === "object", "BATTLE_SNAPSHOT_REQUIRED");
  }

  requestRecoveryClear() {}
}
