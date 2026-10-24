import { UnitAbility, UnitUse } from "./unit-ability.js";

/** 能力そのものの上限。残り回数には依存せず、表示と実行判定で共有する。 */
export function getConfusionLevel(unit) {
  for (const level of [3, 2, 1]) {
    if (unit?.hasAbility(UnitAbility[`CONFUSION_LEVEL_${level}`])) return level;
  }
  return 0;
}

/** 現在使える上限。AIの選択では能力上限に残り回数を適用する。 */
export function getUsableConfusionLevel(unit) {
  return Math.min(getConfusionLevel(unit), unit?.remainingUses[UnitUse.TACTIC] ?? 0);
}
