import { createActionRequest } from "../src/core/action-request.js";

// Unmodified fourth-chapter data, seed 1. Four enemies remain when Song Jiang escapes.
export const QINGFENG_ESCAPE_ROUTE = Object.freeze([
  Object.freeze([["hua_rong",0,10,"CHARGE","qingzhou5"],["song_jiang",1,13],["yan_shun",2,12],["wang_ying",3,14,null,null,"SOUTH"],["zheng_tianshou",4,14,null,null,"EAST"]].map(Object.freeze)),
  Object.freeze([["hua_rong",2,8,"CONFUSION_LV1","qingzhou3"],["song_jiang",1,10,"CONFUSION_LV1","qingzhou6"],["yan_shun",2,12,"CHARGE","qingzhou6"],["wang_ying",0,13,null,null,"EAST"]].map(Object.freeze)),
  Object.freeze([["hua_rong",3,9,"CHARGE","qingzhou1"],["song_jiang",2,8,"NORMAL_ATTACK","qingzhou1"],["wang_ying",1,11,null,null,"SOUTH"]].map(Object.freeze)),
  Object.freeze([["song_jiang",3,6,"CONFUSION_LV1","qingzhou3","SOUTH"],["wang_ying",2,10,"CHARGE","qingzhou6"]].map(Object.freeze)),
  Object.freeze([["song_jiang",3,3,null,null,"SOUTH"]].map(Object.freeze)),
  Object.freeze([["song_jiang",3,0]].map(Object.freeze))
]);

export async function playQingfengEscape(controller, { fromTurn = 1, onCheckpoint = () => {} } = {}) {
  const stage = controller.getStage();
  for (let turn = fromTurn; turn <= QINGFENG_ESCAPE_ROUTE.length; turn++) {
    if (stage.turn !== turn || stage.phase !== "PLAYER") throw new Error(`QINGFENG_PHASE: ${stage.turn}`);
    await onCheckpoint(stage);
    for (const [id, x, y, type, targetId, facing = "NORTH"] of QINGFENG_ESCAPE_ROUTE[turn - 1]) {
      const unit = stage.getUnit(id);
      if (!unit.hasTroops() || unit.actionState !== "READY") throw new Error(`QINGFENG_UNAVAILABLE: ${id}`);
      const path = controller.getCandidatePaths(unit, { x, y })[0];
      if (!path) throw new Error(`QINGFENG_UNREACHABLE: ${id} ${x},${y}`);
      const accepted = turn === QINGFENG_ESCAPE_ROUTE.length
        ? await controller.executeImmediateMove(unit, path)
        : type ? await controller.executeAction(createActionRequest(type, unit, stage.getUnit(targetId)), path)
          : await controller.executeWait(unit, path, facing);
      if (!accepted) throw new Error(`QINGFENG_REJECTED: ${id}`);
      if (unit.actionState === "TACTIC_COMMITTED" && !await controller.finalizeTacticFacing(unit, facing)) {
        throw new Error(`QINGFENG_FACING_REJECTED: ${id}`);
      }
    }
    if (turn < QINGFENG_ESCAPE_ROUTE.length && !await controller.endPlayerTurn()) throw new Error("QINGFENG_END_REJECTED");
    stage.validateRuntime();
  }
}

