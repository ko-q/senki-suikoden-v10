import { UnitAbility } from "../domain/unit-ability.js";

export const TERRAIN_NAMES = Object.freeze({ plain: "平地", road: "道", forest: "森", hill: "丘", swamp: "湿地", water: "川", wall: "城壁", mountain: "山岳" });

const percent = (value = 0) => Math.round(value * 100);
const largerReduction = (rate, fixed) => `${percent(rate)}%または${fixed ?? 0}の大きい方`;

/** Presents the actual terrain rules without calculating or changing combat outcomes. */
export class TerrainInfoView {
  #element;
  constructor(element) { this.#element = element; }

  render(terrain, unit = null) {
    if (!this.#element) return;
    this.#element.textContent = terrain
      ? `地形情報： ${TERRAIN_NAMES[terrain.id] ?? terrain.nameKey}\n${this.describe(terrain, unit)}`
      : "";
  }

  describe(terrain, unit = null) {
    const waterAffinity = unit?.hasAbility(UnitAbility.WATER_TERRAIN_AFFINITY) ?? false;
    const chainCavalry = unit?.hasAbility(UnitAbility.CHAIN_CAVALRY) ?? false;
    if (terrain.id === "water" && !waterAffinity) {
      return "進入不可（水系適性を持つ部隊は移動1で進入できます）";
    }
    if (!(unit ? terrain.canEnter(unit) : terrain.passable)) return "進入不可";
    const cost = unit ? terrain.getMoveCost(unit) : terrain.moveCost;
    const modifiers = terrain.combatModifiers;
    if (["water", "swamp"].includes(terrain.id) && waterAffinity) {
      return `移動${cost}／攻防効果なし（水系適性）`;
    }
    if (terrain.id === "swamp") {
      const attack = `攻撃${largerReduction(modifiers.attackPenaltyRate, modifiers.attackPenaltyFixed)}を低下`;
      const defense = `被ダメージ${largerReduction(modifiers.defensePenaltyRate, modifiers.defensePenaltyFixed)}を増加`;
      return `移動${cost}／${attack}${chainCavalry ? "＋連環馬さらに与ダメージ30%低下" : ""}／${defense}${chainCavalry ? "＋連環馬さらに20%増加" : ""}${unit ? "" : "。水系適性部隊：移動1／攻防効果なし。"}`;
    }
    const defense = chainCavalry && ["plain", "road"].includes(terrain.id)
      ? "連環馬：被ダメージ20%軽減"
      : modifiers.damageRate > 0
        ? `被ダメージ${largerReduction(modifiers.damageRate, modifiers.damageFixed)}を軽減`
        : "被ダメージ軽減なし";
    const attack = modifiers.attackBonus > 0 ? `／攻撃+${modifiers.attackBonus}` : "";
    return `移動${cost}／${defense}${attack}`;
  }
}
