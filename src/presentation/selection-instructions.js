import { ActionType } from "../core/action-request.js";
import { UnitAbility, UnitUse } from "../domain/unit-ability.js";

/** V9-style targeting help; descriptions follow the implemented V10 rules. */
export function targetInstruction(unit, actionType) {
  const uses = id => `残り${unit.remainingUses[id]}/${unit.maxUses[id]}回。`;
  if (actionType === ActionType.BOW_ATTACK) {
    const throwOnly = unit.hasAbility(UnitAbility.THROW_ATTACK) && !unit.hasAbility(UnitAbility.BOW_ATTACK);
    return `${throwOnly ? "投擲" : "弓撃"}の対象を選んでください。威力は正面80％・側面100％・背面100％、射程${throwOnly ? "2" : "2～3"}・隣接不可・壁越し不可。${uses(UnitUse.PROJECTILE)}`;
  }
  if (actionType === ActionType.CHARGE) {
    return `突撃の対象を選んでください。隣接する敵に大ダメージ、対象の統率により最大25％で撹乱。${uses(UnitUse.CHARGE)}`;
  }
  if (actionType === ActionType.FIRE || actionType === ActionType.WATER) {
    return `${actionType === ActionType.FIRE ? "火計" : "水計"}の中心にする敵を選んでください。射程3・壁越し不可、中心＋上下左右へ範囲ダメージ、周辺65％、味方巻き添えあり。撹乱判定は中心だけ・成功時1ターン。消費1回。${uses(UnitUse.TACTIC)}`;
  }
  if (actionType === ActionType.ILLUSION) {
    return `幻術をかける敵を選んでください。射程3・壁越し不可、消費1回。幻術士と、幻術が残り2ターンの敵は選択できません。成功すると次の行動で、届く味方がいれば同士討ちします。${uses(UnitUse.TACTIC)}`;
  }
  const level = [ActionType.CONFUSION_LV1, ActionType.CONFUSION_LV2, ActionType.CONFUSION_LV3].indexOf(actionType) + 1;
  if (level) {
    const area = level === 1 ? "選択した敵1部隊" : `選択した敵から${level - 1}マス以内の敵`;
    const restriction = level === 1 ? "撹乱が残り2ターンの敵は選択できません。"
      : "中心が撹乱の上限でも、範囲内に延長可能な敵がいれば選択できます。";
    return `撹乱Lv${level}の中心にする敵を選んでください。対象：${area}。射程3・壁越し不可、消費${level}回。${restriction}${uses(UnitUse.TACTIC)}`;
  }
  return "赤い印の対象を選んでください。";
}

/** Describe the already queried commands, without querying or changing the battle. */
export function selectionInstruction(unit, availableActions, preview = false) {
  const actions = new Set(availableActions), names = [];
  const uses = id => `${unit.remainingUses[id]}/${unit.maxUses[id]}`;
  if (actions.has(ActionType.BOW_ATTACK)) {
    const label = unit.hasAbility(UnitAbility.THROW_ATTACK) && !unit.hasAbility(UnitAbility.BOW_ATTACK) ? "投擲" : "弓撃";
    names.push(`${label}${uses(UnitUse.PROJECTILE)}`);
  }
  if (actions.has(ActionType.CHARGE)) names.push(`突撃${uses(UnitUse.CHARGE)}`);
  const levels = [ActionType.CONFUSION_LV1, ActionType.CONFUSION_LV2, ActionType.CONFUSION_LV3]
    .flatMap((type, index) => actions.has(type) ? [index + 1] : []);
  if (levels.length) names.push(`撹乱Lv${levels.join("・")} ${uses(UnitUse.TACTIC)}`);
  for (const [type, label] of [[ActionType.ILLUSION, "幻術"], [ActionType.WIDE_ILLUSION, "広域幻術"],
    [ActionType.FIRE, "火計"], [ActionType.WATER, "水計"]]) {
    if (actions.has(type)) names.push(`${label} ${uses(UnitUse.TACTIC)}`);
  }
  const skills = names.length ? ` 使用可能：${names.join("・")}。` : "";
  const attack = actions.has(ActionType.NORMAL_ATTACK) ? "赤丸の敵を直接攻撃できます。" : "";
  if (preview) return `${attack}${skills} 黄色い方向枠を選ぶと、その方向を向いて行動を終了します。敵の方向へ攻撃せず向きたい場合は「待機」を選んでください。`.trim();
  return attack
    ? `${attack}${skills} 移動、または「待機」でその場の方向転換も選べます。`
    : `移動先を選べます。${skills} 移動せず向きだけ変える場合は「待機」を選べます。`;
}
