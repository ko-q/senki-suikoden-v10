import { createActionRequest } from "../src/core/action-request.js";

// Reproducible seed-1 playthrough using the unmodified V9 chapter and public commands.
// This is a regression route, not a promise of victory for every random seed.
export const SECOND_CHAPTER_ROUTE = [
  [["lin_chong", 3, 13], ["lu_zhishen", 3, 14]],
  [["lin_chong", 5, 12, "NORMAL_ATTACK", "escort_yz4"], ["lu_zhishen", 4, 13, "NORMAL_ATTACK", "escort_yz4"]],
  [["lin_chong", 4, 12, "CHARGE", "kaifeng_adviser"], ["lu_zhishen", 3, 12]],
  [["lin_chong", 6, 12, "CHARGE", "escort_yz2"], ["lu_zhishen", 4, 12, "CONFUSION_LV1", "escort_yz1", "WEST"]],
  [["lin_chong", 6, 9, "CHARGE", "dong_chao"], ["lu_zhishen", 3, 12, "NORMAL_ATTACK", "escort_yz5"]],
  [["lu_zhishen", 2, 11, "NORMAL_ATTACK", "escort_yz5"], ["lin_chong", 5, 8, "NORMAL_ATTACK", "xue_ba"]],
  [["lu_zhishen", 3, 12, "CONFUSION_LV1", "escort_yz1"], ["lin_chong", 4, 9, "NORMAL_ATTACK", "xue_ba"]],
  [["lin_chong", 3, 10, "NORMAL_ATTACK", "escort_yz1"], ["lu_zhishen", 4, 11, "NORMAL_ATTACK", "escort_yz1"]]
];

export async function playSecondChapter(controller, { fromTurn = 1, onCheckpoint = () => {} } = {}) {
  const stage = controller.getStage();
  for (let turn = fromTurn; turn <= SECOND_CHAPTER_ROUTE.length; turn++) {
    if (stage.turn !== turn || stage.phase !== "PLAYER") throw new Error(`SECOND_ROUTE_PHASE: ${stage.turn}`);
    for (const [id, x, y, type, targetId, facing = "NORTH"] of SECOND_CHAPTER_ROUTE[turn - 1]) {
      const unit = stage.getUnit(id), origin = stage.map.getPosition(unit);
      if (!unit.hasTroops() || unit.actionState !== "READY") throw new Error(`SECOND_ROUTE_UNAVAILABLE: ${id}`);
      const path = origin.x === x && origin.y === y ? [] : controller.getCandidatePaths(unit, { x, y })[0];
      if (!path) throw new Error(`SECOND_ROUTE_UNREACHABLE: ${id} ${x},${y}`);
      const accepted = type ? await controller.executeAction(createActionRequest(type, unit, stage.getUnit(targetId)), path)
        : await controller.executeWait(unit, path, facing);
      if (!accepted) throw new Error(`SECOND_ROUTE_REJECTED: ${id}`);
      if (unit.actionState === "TACTIC_COMMITTED" && !await controller.finalizeTacticFacing(unit, facing)) {
        throw new Error(`SECOND_ROUTE_FACING_REJECTED: ${id}`);
      }
    }
    if (turn < SECOND_CHAPTER_ROUTE.length && !await controller.endPlayerTurn()) throw new Error("SECOND_ROUTE_END_REJECTED");
    await onCheckpoint(stage);
  }
}
