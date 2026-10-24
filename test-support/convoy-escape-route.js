import { createActionRequest } from "../src/core/action-request.js";

// Seed-1 full escape route, using unmodified V9 data and public commands only.
// The convoy falls during turn five; thirteen pursuers remain at the escape.
export const CONVOY_ESCAPE_ROUTE = [
  [["gongsun_sheng", 3, 12, "ILLUSION", "yang_zhi"], ["liu_tang", 5, 12, "NORMAL_ATTACK", "convoy_cart"],
    ["ruan_xiaoqi", 4, 13, "NORMAL_ATTACK", "convoy_cart"], ["ruan_xiaoer", 0, 11, "NORMAL_ATTACK", "escort6"],
    ["ruan_xiaowu", 1, 12, "NORMAL_ATTACK", "escort6"], ["wu_yong", 2, 13, "CONFUSION_LV1", "escort2"],
    ["bai_sheng", 6, 13, "NORMAL_ATTACK", "escort3"], ["chao_gai", 1, 13]],
  [["ruan_xiaoer", 2, 11, "NORMAL_ATTACK", "escort4"], ["ruan_xiaoqi", 5, 10, "NORMAL_ATTACK", "escort1"],
    ["gongsun_sheng", 3, 12, "NORMAL_ATTACK", "escort4"], ["wu_yong", 4, 11, "NORMAL_ATTACK", "escort2"],
    ["ruan_xiaowu", 2, 10, "NORMAL_ATTACK", "yang_zhi"], ["bai_sheng", 5, 12, "NORMAL_ATTACK", "escort3"], ["chao_gai", 1, 9]],
  [["wu_yong", 4, 9, "CONFUSION_LV1", "yang_zhi"], ["ruan_xiaoqi", 7, 12, "NORMAL_ATTACK", "escort3"],
    ["gongsun_sheng", 5, 10, "NORMAL_ATTACK", "escort1"], ["ruan_xiaoer", 5, 12, "NORMAL_ATTACK", "escort5"],
    ["ruan_xiaowu", 3, 11, "NORMAL_ATTACK", "yang_zhi"], ["chao_gai", 1, 6]],
  [["wu_yong", 4, 11, "CONFUSION_LV1", "yang_zhi"], ["ruan_xiaoer", 5, 12, "NORMAL_ATTACK", "escort5"],
    ["ruan_xiaowu", 3, 9, "NORMAL_ATTACK", "yang_zhi"], ["chao_gai", 1, 5],
    ["gongsun_sheng", 1, 10], ["ruan_xiaoqi", 5, 10, "NORMAL_ATTACK", "escort1"]],
  [["ruan_xiaoqi", 5, 7, null, null, "SOUTH"], ["ruan_xiaowu", 2, 6], ["ruan_xiaoer", 5, 12, "NORMAL_ATTACK", "escort5"],
    ["chao_gai", 1, 4], ["gongsun_sheng", 1, 6, "ILLUSION", "raid_guard2", "WEST"],
    ["wu_yong", 2, 9, "CONFUSION_LV1", "raid_soldier3"]],
  [["ruan_xiaowu", 2, 3, "NORMAL_ATTACK", "raid_water_soldier"], ["chao_gai", 1, 4, "NORMAL_ATTACK", "raid_water_soldier"],
    ["gongsun_sheng", 1, 5, "ILLUSION", "raid_water_soldier", "SOUTH"]],
  [["ruan_xiaowu", 3, 4, "NORMAL_ATTACK", "raid_water_soldier2"], ["gongsun_sheng", 1, 5, "ILLUSION", "raid_water_soldier2", "SOUTH"],
    ["chao_gai", 1, 3, null, null, "SOUTH"]],
  [["ruan_xiaowu", 3, 4, "NORMAL_ATTACK", "raid_water_soldier2"], ["chao_gai", 1, 2, null, null, "SOUTH"]],
  [["chao_gai", 1, 1, null, null, "SOUTH"]], [["chao_gai", 2, 1]], [["chao_gai", 2, 0, null, null, "SOUTH"]], [["chao_gai", 3, 0, null, null, "SOUTH"]]
];

export async function playConvoyEscape(controller, { fromTurn = 1, onCheckpoint = () => {} } = {}) {
  const stage = controller.getStage();
  for (let turn = fromTurn; turn <= CONVOY_ESCAPE_ROUTE.length; turn++) {
    if (stage.turn !== turn || stage.phase !== "PLAYER") throw new Error(`ESCAPE_ROUTE_PHASE: ${stage.turn}`);
    await onCheckpoint(stage);
    for (const [id, x, y, type, targetId, facing = "NORTH"] of CONVOY_ESCAPE_ROUTE[turn - 1]) {
      const unit = stage.getUnit(id);
      if (!unit.hasTroops() || unit.actionState !== "READY") throw new Error(`ESCAPE_ROUTE_UNAVAILABLE: ${id}`);
      const path = controller.getCandidatePaths(unit, { x, y })[0];
      if (!path) throw new Error(`ESCAPE_ROUTE_UNREACHABLE: ${id} ${x},${y}`);
      const accepted = type ? await controller.executeAction(createActionRequest(type, unit, stage.getUnit(targetId)), path)
        : await controller.executeWait(unit, path, facing);
      if (!accepted) throw new Error(`ESCAPE_ROUTE_REJECTED: ${id}`);
      if (unit.actionState === "TACTIC_COMMITTED" && !await controller.finalizeTacticFacing(unit, facing)) {
        throw new Error(`ESCAPE_ROUTE_FACING_REJECTED: ${id}`);
      }
    }
    if (turn < CONVOY_ESCAPE_ROUTE.length && !await controller.endPlayerTurn()) throw new Error("ESCAPE_ROUTE_END_REJECTED");
    stage.validateRuntime();
  }
}
