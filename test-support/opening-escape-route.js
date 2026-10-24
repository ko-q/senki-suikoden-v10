import { createActionRequest } from "../src/core/action-request.js";

// Unmodified chapter one, seed 1: Shi Jin reaches the escape cell on turn 6.
export const OPENING_ESCAPE_ROUTE = Object.freeze([
  [["zhu_wu",2,10,"CONFUSION_LV1","mid_archer1"], ["shi_jin",1,11,"CHARGE","mid_guard1"],
    ["chen_da",2,12], ["yang_chun",1,12]],
  [["zhu_wu",2,9,"CONFUSION_LV1","mid_archer1"], ["chen_da",2,10,"CHARGE","mid_guard1"],
    ["shi_jin",1,7], ["yang_chun",0,12]],
  [["zhu_wu",2,8,"CONFUSION_LV1","mid_archer1"], ["shi_jin",1,5], ["yang_chun",0,12]],
  [["zhu_wu",1,6,"CONFUSION_LV1","guard1"], ["shi_jin",1,3], ["yang_chun",1,11]],
  [["shi_jin",3,2,"CONFUSION_LV1","soldier2"]],
  [["shi_jin",3,0,"ESCAPE"]]
].map(commands => Object.freeze(commands.map(Object.freeze))));

export async function playOpeningEscape(controller, {
  fromTurn = 1, fromCommand = 0, onCheckpoint = () => {}
} = {}) {
  const stage = controller.getStage();
  for (let turn = fromTurn; turn <= OPENING_ESCAPE_ROUTE.length; turn++) {
    if (stage.turn !== turn || stage.phase !== "PLAYER") throw new Error(`OPENING_PHASE: ${stage.turn}`);
    const commands = OPENING_ESCAPE_ROUTE[turn - 1];
    for (let index = turn === fromTurn ? fromCommand : 0; index <= commands.length; index++) {
      await onCheckpoint(stage, { turn, commandIndex: index });
      if (index === commands.length) break;
      const [id, x, y, type, targetId] = commands[index], unit = stage.getUnit(id);
      if (!unit.hasTroops() || unit.actionState !== "READY") throw new Error(`OPENING_UNAVAILABLE: ${id}`);
      const path = controller.getCandidatePaths(unit, { x, y })[0];
      if (!path) throw new Error(`OPENING_UNREACHABLE: ${id} ${x},${y}`);
      const accepted = type === "ESCAPE" ? await controller.executeImmediateMove(unit, path)
        : type ? await controller.executeAction(createActionRequest(type, unit, stage.getUnit(targetId)), path)
          : await controller.executeWait(unit, path, "NORTH");
      if (!accepted) throw new Error(`OPENING_REJECTED: ${id}`);
      if (unit.actionState === "TACTIC_COMMITTED" && !await controller.finalizeTacticFacing(unit, "NORTH")) {
        throw new Error(`OPENING_FACING_REJECTED: ${id}`);
      }
      stage.validateRuntime();
    }
    if (turn < OPENING_ESCAPE_ROUTE.length && !await controller.endPlayerTurn()) throw new Error("OPENING_END_REJECTED");
  }
}
