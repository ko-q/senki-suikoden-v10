/**
 * BattleCommandPortと画面が共有する戦闘処理状態。
 */
export const BattleFlowState = Object.freeze({
  IDLE: "IDLE",
  RESOLVING_ACTION: "RESOLVING_ACTION",
  TURN_TRANSITION: "TURN_TRANSITION",
  FINISHING: "FINISHING",
  FAULTED: "FAULTED"
});
