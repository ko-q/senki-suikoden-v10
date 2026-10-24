import { createActionRequest } from "../src/core/action-request.js";

// Seed-1 regression route with unmodified V9 data, through convoy clearance.
// This stops before reinforcements; it is not a complete chapter victory route.
const turns = [
  [["gongsun_sheng", 3, 12, "ILLUSION", "yang_zhi"], ["liu_tang", 5, 12, "NORMAL_ATTACK", "convoy_cart"],
    ["ruan_xiaoqi", 4, 13, "NORMAL_ATTACK", "convoy_cart"], ["ruan_xiaoer", 0, 11, "NORMAL_ATTACK", "escort6"],
    ["ruan_xiaowu", 1, 12, "NORMAL_ATTACK", "escort6"], ["wu_yong", 2, 13, "CONFUSION_LV1", "escort2"],
    ["bai_sheng", 6, 13, "NORMAL_ATTACK", "escort3"], ["chao_gai", 5, 14]],
  [["ruan_xiaoer", 2, 11, "NORMAL_ATTACK", "escort4"], ["ruan_xiaoqi", 5, 10, "NORMAL_ATTACK", "escort1"],
    ["gongsun_sheng", 3, 12, "NORMAL_ATTACK", "escort4"], ["wu_yong", 4, 11, "NORMAL_ATTACK", "escort2"],
    ["ruan_xiaowu", 2, 10, "NORMAL_ATTACK", "yang_zhi"], ["bai_sheng", 5, 12, "NORMAL_ATTACK", "escort3"],
    ["chao_gai", 2, 13]],
  [["wu_yong", 4, 11, "CONFUSION_LV1", "yang_zhi"], ["ruan_xiaoqi", 7, 12, "NORMAL_ATTACK", "escort3"],
    ["gongsun_sheng", 6, 11, "NORMAL_ATTACK", "escort1"], ["ruan_xiaoer", 5, 12, "NORMAL_ATTACK", "escort5"],
    ["ruan_xiaowu", 3, 11, "NORMAL_ATTACK", "yang_zhi"], ["chao_gai", 2, 9]],
  [["wu_yong", 4, 11, "CONFUSION_LV1", "yang_zhi"], ["ruan_xiaoer", 5, 12, "NORMAL_ATTACK", "escort5"],
    ["ruan_xiaowu", 3, 11, "NORMAL_ATTACK", "yang_zhi"], ["chao_gai", 2, 9, null, null, "SOUTH"],
    ["gongsun_sheng", 6, 7], ["ruan_xiaoqi", 7, 8]]
];

export async function playConvoyRaid(controller) {
  const stage = controller.getStage();
  for (const [index, commands] of turns.entries()) {
    if (stage.turn !== index + 1 || stage.phase !== "PLAYER") throw new Error("RAID_ROUTE_PHASE");
    for (const [id, x, y, type, targetId, facing = "NORTH"] of commands) {
      const unit = stage.getUnit(id), origin = stage.map.getPosition(unit);
      if (!unit.hasTroops() || unit.actionState !== "READY") throw new Error(`RAID_ROUTE_UNAVAILABLE: ${id}`);
      const path = origin.x === x && origin.y === y ? [] : controller.getCandidatePaths(unit, { x, y })[0];
      if (!path) throw new Error(`RAID_ROUTE_UNREACHABLE: ${id} ${x},${y}`);
      const accepted = type ? await controller.executeAction(createActionRequest(type, unit, stage.getUnit(targetId)), path)
        : await controller.executeWait(unit, path, facing);
      if (!accepted) throw new Error(`RAID_ROUTE_REJECTED: ${id}`);
      if (unit.actionState === "TACTIC_COMMITTED" && !await controller.finalizeTacticFacing(unit, facing)) {
        throw new Error(`RAID_ROUTE_FACING_REJECTED: ${id}`);
      }
    }
    if (index < turns.length - 1 && !await controller.endPlayerTurn()) throw new Error("RAID_ROUTE_END_REJECTED");
    stage.validateRuntime();
  }
}
