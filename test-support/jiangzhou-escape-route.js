import { createActionRequest } from "../src/core/action-request.js";

// Unmodified fifth-chapter data, seed 1. Chao Gai arrives first; Song Jiang joins him on turn 7.
export const JIANGZHOU_ESCAPE_ROUTE = Object.freeze([
  Object.freeze([["li_kui",3,10,"NORMAL_ATTACK","jiangzhou_archer4"],["dai_zong",2,12,"CONFUSION_LV1","huang_wenbing"],["song_jiang_jiangzhou",1,15,"CONFUSION_LV1","jiangzhou_cavalry1","EAST"],["li_jun_jiangzhou",0,5,null,null,"SOUTH"],["zhang_heng_jiangzhou",1,5,null,null,"SOUTH"],["zhang_shun_jiangzhou",3,4,"CONFUSION_LV1","executioner"],["tong_wei_jiangzhou",5,4,"CONFUSION_LV1","jiangzhou_guard1"],["tong_meng_jiangzhou",7,4,"CONFUSION_LV1","jiangzhou_guard2"]].map(Object.freeze)),
  Object.freeze([["hua_rong_jiangzhou",2,6,"CHARGE","jiangzhou_archer6"],["chao_gai_jiangzhou",0,7,null,null,"EAST"],["wang_ying_jiangzhou",1,11,"CHARGE","jiangzhou_archer4"],["dai_zong",3,10,"CONFUSION_LV1","jiangzhou_soldier3"],["song_jiang_jiangzhou",1,12,"CONFUSION_LV1","jiangzhou_soldier6","SOUTH"],["yan_shun_jiangzhou",1,13,null,null,"SOUTH"],["huang_xin_jiangzhou",3,11,"CHARGE","huang_wenbing"],["liu_tang_jiangzhou",3,8,"NORMAL_ATTACK","jiangzhou_spear1"],["zheng_tianshou_jiangzhou",2,7,"NORMAL_ATTACK","jiangzhou_mid_archer1"],["li_jun_jiangzhou",1,7,"CONFUSION_LV1","jiangzhou_mid_archer1"],["zhang_heng_jiangzhou",2,5,"NORMAL_ATTACK","jiangzhou_archer5"],["zhang_shun_jiangzhou",4,2,null,null,"SOUTH"],["tong_wei_jiangzhou",6,2,null,null,"SOUTH"],["tong_meng_jiangzhou",7,1,null,null,"SOUTH"]].map(Object.freeze)),
  Object.freeze([["hua_rong_jiangzhou",2,6,"BOW_ATTACK","jiangzhou_mid_archer1"],["zheng_tianshou_jiangzhou",3,6,"NORMAL_ATTACK","executioner"],["li_jun_jiangzhou",3,7,"CONFUSION_LV1","jiangzhou_water_soldier1"],["liu_tang_jiangzhou",3,8,"NORMAL_ATTACK","jiangzhou_spear1"],["huang_xin_jiangzhou",3,10,"CHARGE","jiangzhou_cavalry5"],["wang_ying_jiangzhou",2,12,"NORMAL_ATTACK","jiangzhou_soldier6"],["song_jiang_jiangzhou",1,9,null,null,"EAST"],["yan_shun_jiangzhou",1,13,"CHARGE","jiangzhou_cavalry4"],["zhang_heng_jiangzhou",3,4,"NORMAL_ATTACK","jiangzhou_archer5"],["zhang_shun_jiangzhou",4,3,"CONFUSION_LV1","executioner"],["chao_gai_jiangzhou",0,4,null,null,"EAST"],["tong_wei_jiangzhou",6,0,null,null,"SOUTH"],["tong_meng_jiangzhou",7,0,null,null,"SOUTH"]].map(Object.freeze)),
  Object.freeze([["hua_rong_jiangzhou",3,5,"BOW_ATTACK","executioner"],["zhang_heng_jiangzhou",3,3,"CONFUSION_LV1","jiangzhou_guard3"],["zhang_shun_jiangzhou",5,1,"CONFUSION_LV1","jiangzhou_guard1"],["zheng_tianshou_jiangzhou",3,6,"NORMAL_ATTACK","executioner"],["li_jun_jiangzhou",2,5,"CONFUSION_LV1","jiangzhou_guard3"],["song_jiang_jiangzhou",2,7,null,null,"SOUTH"],["chao_gai_jiangzhou",2,4,null,null,"EAST"],["tong_wei_jiangzhou",6,0,null,null,"SOUTH"],["tong_meng_jiangzhou",7,0,null,null,"SOUTH"]].map(Object.freeze)),
  Object.freeze([["hua_rong_jiangzhou",4,5,"NORMAL_ATTACK","executioner"],["li_jun_jiangzhou",4,6,"CONFUSION_LV1","jiangzhou_water_soldier1"],["song_jiang_jiangzhou",3,5,null,null,"SOUTH"],["zhang_heng_jiangzhou",3,0,null,null,"SOUTH"],["chao_gai_jiangzhou",3,1,null,null,"SOUTH"],["zhang_shun_jiangzhou",5,1,"CONFUSION_LV1","jiangzhou_guard1"],["tong_wei_jiangzhou",6,0,null,null,"SOUTH"],["tong_meng_jiangzhou",7,0,null,null,"SOUTH"]].map(Object.freeze)),
  Object.freeze([["song_jiang_jiangzhou",3,2,"CONFUSION_LV1","jiangzhou_guard3","SOUTH"],["li_jun_jiangzhou",4,6,"CONFUSION_LV1","jiangzhou_water_soldier1"],["zhang_heng_jiangzhou",4,1,null,null,"SOUTH"],["chao_gai_jiangzhou",4,0,null,null,"SOUTH"],["zhang_shun_jiangzhou",6,1,"NORMAL_ATTACK","jiangzhou_guard2"],["tong_wei_jiangzhou",6,0,null,null,"SOUTH"],["tong_meng_jiangzhou",7,0,null,null,"SOUTH"]].map(Object.freeze)),
  Object.freeze([["song_jiang_jiangzhou",3,0,"ESCAPE"]].map(Object.freeze))
]);

export async function playJiangzhouEscape(controller, {
  fromTurn = 1, fromCommand = 0, onCheckpoint = () => {}
} = {}) {
  const stage = controller.getStage();
  for (let turn = fromTurn; turn <= JIANGZHOU_ESCAPE_ROUTE.length; turn++) {
    if (stage.turn !== turn || stage.phase !== "PLAYER") throw new Error(`JIANGZHOU_PHASE: ${stage.turn}`);
    const commands = JIANGZHOU_ESCAPE_ROUTE[turn - 1];
    for (let index = turn === fromTurn ? fromCommand : 0; index <= commands.length; index++) {
      await onCheckpoint(stage, { turn, commandIndex: index });
      if (index === commands.length) break;
      const [id, x, y, type, targetId, facing = "NORTH"] = commands[index];
      const unit = stage.getUnit(id);
      if (!unit.hasTroops() || unit.actionState !== "READY") throw new Error(`JIANGZHOU_UNAVAILABLE: ${id}`);
      const path = controller.getCandidatePaths(unit, { x, y })[0];
      if (!path) throw new Error(`JIANGZHOU_UNREACHABLE: ${id} ${x},${y}`);
      const accepted = type === "ESCAPE" ? await controller.executeImmediateMove(unit, path)
        : type ? await controller.executeAction(createActionRequest(type, unit, stage.getUnit(targetId)), path)
          : await controller.executeWait(unit, path, facing);
      if (!accepted) throw new Error(`JIANGZHOU_REJECTED: ${id}`);
      if (unit.actionState === "TACTIC_COMMITTED" && !await controller.finalizeTacticFacing(unit, facing)) {
        throw new Error(`JIANGZHOU_FACING_REJECTED: ${id}`);
      }
      stage.validateRuntime();
    }
    if (turn < JIANGZHOU_ESCAPE_ROUTE.length && !await controller.endPlayerTurn()) throw new Error("JIANGZHOU_END_REJECTED");
  }
}

