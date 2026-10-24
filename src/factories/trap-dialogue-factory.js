import { Dialogue, Speech } from "../domain/dialogue.js";
import { HiddenTrapKind } from "../domain/hidden-trap.js";

/** Fixed V9.7.75 trap reactions, built from an already resolved effect. */
export function createTrapReactionDialogue(result) {
  const spell = result.trap.kind === HiddenTrapKind.SPELL;
  const speaker = result.unit.character;
  let actionLabel = spell ? "妖術罠" : "罠";
  let text;
  if (result.neutralized) {
    actionLabel = "妖術罠無効";
    text = speaker.name === "公孫勝"
      ? "妖符の理は見切りました。この程度の幻術罠ならば――破！"
      : "術の流れは見切った。この幻術罠は私には通じぬ――破！";
  } else if (result.defeated) {
    text = spell ? "ぐっ……地面から妖気が……ここにも術が仕込まれていたか……！" : "ぐっ……足元に罠が……！";
  } else {
    text = spell ? "何だ、この妖気は……！　敵と味方の姿が歪んで見える！" : "しまった、罠だ！　隊列が乱れた。ここで立て直すぞ！";
  }
  return new Dialogue({ id: "trap_reaction", speeches: [new Speech({ id: "trap_reaction_line", speaker, actionLabel, text })] });
}
