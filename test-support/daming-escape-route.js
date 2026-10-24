import { createActionRequest } from "../src/core/action-request.js";

// Unmodified eighth chapter, seed 1: Lu Junyi arrives first, then Shi Xiu escapes on turn 6.
export const DAMING_ESCAPE_ROUTE = Object.freeze([
  Object.freeze([["kong_ming_daming",0,6,"NORMAL_ATTACK","daming_archer1","NORTH"],["kong_liang_daming",2,6,"NORMAL_ATTACK","daming_archer1","NORTH"],["cai_fu_daming",1,5,"NORMAL_ATTACK","daming_archer1","NORTH"],["yan_qing_daming",2,4,"CONFUSION_LV2","li_cheng","NORTH"],["cai_qing_daming",5,6,"NORMAL_ATTACK","daming_guard6","NORTH"],["shi_xiu_daming",5,5,"NORMAL_ATTACK","daming_guard2","NORTH"],["yue_he_daming",7,4,"CONFUSION_LV1","daming_archer2","NORTH"],["lu_junyi_daming",6,4,null,null,"NORTH"],["wu_yong_daming",4,11,"CONFUSION_LV3","daming_adviser","NORTH"],["hua_rong_daming",3,11,"CHARGE","daming_soldier1","NORTH"],["yang_zhi_daming",6,13,"BOW_ATTACK","daming_front_infantry_right","NORTH"],["sun_li_daming",1,13,"BOW_ATTACK","daming_front_infantry_left","NORTH"],["zou_run_daming",7,7,"NORMAL_ATTACK","daming_gate_ambush_right","SOUTH"],["zou_yuan_daming",7,6,"NORMAL_ATTACK","daming_archer2","WEST"],["chai_jin_daming",0,5,"CONFUSION_LV1","daming_guard1","EAST"],["dai_zong_daming",7,12,"CONFUSION_LV1","daming_reinforcement_infantry_right","NORTH"],["lin_chong_daming",2,12,"CONFUSION_LV1","daming_cavalry1","NORTH"],["qin_ming_daming",4,12,null,null,"NORTH"],["guan_sheng_daming",1,14,null,null,"NORTH"]].map(Object.freeze)),
  Object.freeze([["yan_qing_daming",2,5,"CONFUSION_LV2","daming_guard6","EAST"],["hua_rong_daming",4,9,"CHARGE","daming_soldier2","NORTH"],["lin_chong_daming",3,9,"CHARGE","daming_adviser2","NORTH"],["wu_yong_daming",4,10,"CONFUSION_LV3","daming_street_blocker_right","NORTH"],["lu_junyi_daming",6,5,"CHARGE","daming_archer2","SOUTH"],["zou_run_daming",7,7,"NORMAL_ATTACK","daming_gate_ambush_right","SOUTH"],["yang_zhi_daming",5,12,"BOW_ATTACK","daming_cavalry2","EAST"],["sun_li_daming",2,12,"BOW_ATTACK","daming_cavalry1","WEST"],["qin_ming_daming",6,12,"CHARGE","daming_front_infantry_right","NORTH"],["guan_sheng_daming",1,12,"CHARGE","daming_front_infantry_left","NORTH"],["cai_qing_daming",6,8,"NORMAL_ATTACK","daming_street_blocker_right","EAST"],["shi_xiu_daming",5,7,"NORMAL_ATTACK","daming_street_blocker_right","WEST"],["kong_ming_daming",1,7,"NORMAL_ATTACK","daming_gate_ambush_left","SOUTH"],["dai_zong_daming",7,12,"CONFUSION_LV1","daming_reinforcement_infantry_right","NORTH"],["chai_jin_daming",0,5,"CONFUSION_LV1","daming_guard1","EAST"],["zou_yuan_daming",5,6,"NORMAL_ATTACK","daming_guard6","WEST"],["cai_fu_daming",0,4,"CONFUSION_LV1","daming_gate_ambush_left","SOUTH"],["yue_he_daming",4,4,"CONFUSION_LV1","daming_inner_cavalry5","NORTH"]].map(Object.freeze)),
  Object.freeze([["wu_yong_daming",3,10,"CONFUSION_LV3","daming_captain2","WEST"],["lu_junyi_daming",6,7,"CONFUSION_LV1","daming_reinforcement_infantry_right","WEST"],["hua_rong_daming",3,8,"CHARGE","daming_adviser","NORTH"],["yan_qing_daming",2,5,"CONFUSION_LV2","daming_inner_archer1","EAST"],["yang_zhi_daming",4,9,"CHARGE","daming_cavalry2","EAST"],["chai_jin_daming",1,5,"NORMAL_ATTACK","daming_gate_ambush_left","SOUTH"],["dai_zong_daming",7,12,"CONFUSION_LV1","daming_reinforcement_infantry_right","NORTH"],["guan_sheng_daming",0,12,"CONFUSION_LV1","daming_reinforcement_infantry_left","NORTH"],["kong_ming_daming",0,8,"NORMAL_ATTACK","daming_reinforcement_infantry_left","EAST"],["cai_qing_daming",6,9,"NORMAL_ATTACK","daming_reinforcement_infantry_right","EAST"],["sun_li_daming",2,12,"CONFUSION_LV1","daming_cavalry1","NORTH"],["zou_run_daming",7,7,"NORMAL_ATTACK","daming_archer4","SOUTH"],["qin_ming_daming",6,11,null,null,"NORTH"],["cai_fu_daming",0,5,null,null,"EAST"]].map(Object.freeze)),
  Object.freeze([["lu_junyi_daming",4,8,"CHARGE","daming_captain3","NORTH"],["shi_xiu_daming",5,9,"CONFUSION_LV1","daming_cavalry1","EAST"],["yan_qing_daming",2,5,"CONFUSION_LV2","daming_guard6","EAST"],["yang_zhi_daming",3,9,"NORMAL_ATTACK","daming_cavalry1","WEST"],["hua_rong_daming",3,8,"BOW_ATTACK","daming_guard6","NORTH"],["zou_run_daming",5,7,"NORMAL_ATTACK","daming_captain3","WEST"],["sun_li_daming",2,11,"CONFUSION_LV1","daming_street_blocker_left","NORTH"],["cai_qing_daming",6,9,"NORMAL_ATTACK","daming_reinforcement_infantry_right","EAST"],["chai_jin_daming",0,6,"CONFUSION_LV1","daming_reinforcement_infantry_left","EAST"],["guan_sheng_daming",1,11,"CONFUSION_LV1","daming_archer3","NORTH"],["kong_liang_daming",2,7,"NORMAL_ATTACK","daming_captain2","EAST"],["cai_fu_daming",1,7,"NORMAL_ATTACK","daming_archer3","SOUTH"],["zou_yuan_daming",4,6,"NORMAL_ATTACK","daming_guard5","NORTH"],["wu_yong_daming",3,10,"CONFUSION_LV1","daming_captain2","NORTH"],["dai_zong_daming",7,12,"CONFUSION_LV1","daming_reinforcement_infantry_right","NORTH"],["qin_ming_daming",6,10,null,null,"EAST"]].map(Object.freeze)),
  Object.freeze([["lu_junyi_daming",3,11,null,null,"NORTH"],["shi_xiu_daming",4,12,null,null,"NORTH"],["yang_zhi_daming",2,9,"CHARGE","daming_street_blocker_left","NORTH"],["guan_sheng_daming",1,9,"NORMAL_ATTACK","daming_reinforcement_infantry_left","NORTH"],["hua_rong_daming",4,8,"BOW_ATTACK","daming_guard2","NORTH"],["cai_qing_daming",6,9,"NORMAL_ATTACK","daming_reinforcement_infantry_right","NORTH"],["yan_qing_daming",0,5,"BOW_ATTACK","daming_guard1","EAST"],["zou_run_daming",6,7,"NORMAL_ATTACK","daming_archer4","SOUTH"],["chai_jin_daming",0,6,"CONFUSION_LV1","daming_guard5","EAST"],["dai_zong_daming",6,11,"CONFUSION_LV1","daming_archer4","NORTH"],["cai_fu_daming",0,8,"NORMAL_ATTACK","daming_archer3","EAST"],["kong_liang_daming",1,7,"NORMAL_ATTACK","daming_archer3","SOUTH"],["wu_yong_daming",2,8,"NORMAL_ATTACK","daming_archer3","WEST"],["sun_li_daming",1,11,"CONFUSION_LV1","daming_archer3","NORTH"],["qin_ming_daming",6,10,null,null,"NORTH"]].map(Object.freeze)),
  Object.freeze([["lu_junyi_daming",3,14,null,null,"NORTH"],["shi_xiu_daming",4,15,"ESCAPE",null,"NORTH"]].map(Object.freeze))
]);

export async function playDamingEscape(controller, {
  fromTurn = 1, fromCommand = 0, onCheckpoint = () => {}
} = {}) {
  const stage = controller.getStage();
  for (let turn = fromTurn; turn <= DAMING_ESCAPE_ROUTE.length; turn++) {
    if (stage.turn !== turn || stage.phase !== "PLAYER") throw new Error(`DAMING_PHASE: ${stage.turn}`);
    const commands = DAMING_ESCAPE_ROUTE[turn - 1];
    for (let index = turn === fromTurn ? fromCommand : 0; index <= commands.length; index++) {
      await onCheckpoint(stage, { turn, commandIndex: index });
      if (index === commands.length) break;
      const [id, x, y, type, targetId, facing = "NORTH"] = commands[index];
      const unit = stage.getUnit(id);
      if (!unit.hasTroops() || unit.actionState !== "READY") throw new Error(`DAMING_UNAVAILABLE: ${id}`);
      const path = controller.getCandidatePaths(unit, { x, y })[0];
      if (!path) throw new Error(`DAMING_UNREACHABLE: ${id} ${x},${y}`);
      const accepted = type === "ESCAPE" ? await controller.executeImmediateMove(unit, path)
        : type ? await controller.executeAction(createActionRequest(type, unit, stage.getUnit(targetId)), path)
          : await controller.executeWait(unit, path, facing);
      if (!accepted) throw new Error(`DAMING_REJECTED: ${id}`);
      if (unit.actionState === "TACTIC_COMMITTED" && !await controller.finalizeTacticFacing(unit, facing)) {
        throw new Error(`DAMING_FACING_REJECTED: ${id}`);
      }
      stage.validateRuntime();
    }
    if (turn < DAMING_ESCAPE_ROUTE.length && !await controller.endPlayerTurn()) throw new Error("DAMING_END_REJECTED");
  }
}

