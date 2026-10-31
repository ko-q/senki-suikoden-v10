import { ActionType } from "../core/action-request.js";
import { Dialogue, Speech } from "../domain/dialogue.js";

const confusionTypes = new Set([
  ActionType.CONFUSION_LV1, ActionType.CONFUSION_LV2, ActionType.CONFUSION_LV3
]);

function casterText(name, illusion, count) {
  if (illusion) {
    if (name === "公孫勝") return count > 1
      ? `${count}隊を幻の中へ封じました。今こそ妖陣を崩す時です。`
      : "術は成りました。しばし幻の中に沈みなさい。";
    if (name === "高廉") return count > 1
      ? `ククク……${count}隊まとめて我が妖術に囚われたな！`
      : "ククク……我が妖術に囚われたな！";
    return count > 1
      ? `${count}隊が幻に落ちた。もはや敵も味方も見分けられまい！`
      : "術は成った。幻の中で己を見失え！";
  }
  if (name === "呉用") return count > 1
    ? `よし、策は成った。${count}隊の指図はもはや通らぬ。`
    : "よし、策は成った。敵陣の指図はもはや通らぬ。";
  return count > 1 ? `${count}隊の動きが乱れた。今が攻め時だ！` : "かかった。敵の動きは乱れたぞ！";
}

/** V9.7.75 success dialogue, derived only from the resolved tactic result. */
export function createTacticSuccessDialogue(result) {
  const illusion = result.type === ActionType.ILLUSION || result.type === ActionType.WIDE_ILLUSION;
  if (!illusion && !confusionTypes.has(result.type)) return null;
  const targets = result.successfulTargets;
  if (!targets?.length) return null;
  // A failed centre must not speak as if affected; wide illusion uses the first success.
  const target = targets.includes(result.target) ? result.target : targets[0];
  const label = illusion ? "幻術" : "撹乱";
  return new Dialogue({ id: "tactic_success", speeches: [
    new Speech({ id: "tactic_success_caster", speaker: result.actor.character,
      actionLabel: `${label}成功`, text: casterText(result.actor.character.name, illusion, targets.length) }),
    new Speech({ id: "tactic_success_target", speaker: target.character,
      actionLabel: `${label}状態`, text: illusion
        ? "敵が幾重にも見える……！　どれが本物だ！？"
        : "何だ……命令が聞き取れん！　隊列が崩れる！" })
  ] });
}
