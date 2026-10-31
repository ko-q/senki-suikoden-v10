import { UnitAbility as Ability, UnitUse } from "../domain/unit-ability.js";
import { CharacterPortraitView } from "./character-portrait-view.js";
import { ModalFocus } from "./modal-focus.js";
import { getConfusionLevel as confusionLevel } from "../domain/unit-capabilities.js";
export { confusionLevel };

import { TERRAIN_NAMES } from "./terrain-info-view.js";
export { TERRAIN_NAMES } from "./terrain-info-view.js";
export const FACING_NAMES = Object.freeze({ NORTH: "北", EAST: "東", SOUTH: "南", WEST: "西" });
export function tacticName(unit) {
  return unit?.hasAbility(Ability.FIRE_TACTIC) ? "火計" : unit?.hasAbility(Ability.WATER_TACTIC) ? "水計"
    : unit?.hasAbility(Ability.ILLUSION) ? "幻術" : unit?.hasAbility(Ability.WIDE_ILLUSION) ? "広域幻術" : "撹乱";
}
const uses = (unit, key) => `${unit.remainingUses[key] ?? 0}/${unit.maxUses[key] ?? 0}`;
const node = (tag, className, text = "") => {
  const element = document.createElement(tag); element.className = className; element.textContent = text; return element;
};

/** Read-only V9 ability card. Its DOM and portrait listener belong to one battle. */
export class UnitDetailView {
  #root; #portrait = null; #readyAt = Infinity; #bindings = []; #focus;
  constructor(root) {
    this.#root = root; root.hidden = true;
    this.#focus = new ModalFocus({ root, initialFocus: root,
      blockedRoots: [...(root.parentNode?.children ?? [])].filter(element => element !== root),
      onEscape: () => this.hide() });
    const listen = (type, listener) => { root.addEventListener(type, listener); this.#bindings.push([type, listener]); };
    listen("pointerup", () => this.release());
    listen("click", () => { if (Date.now() >= this.#readyAt) this.hide(); });
    listen("keydown", (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (["Enter", " "].includes(event.key)) {
        event.preventDefault(); event.stopPropagation?.();
        if (!event.repeat) this.hide();
      }
    });
    listen("wheel", (event) => event.preventDefault());
    listen("touchmove", (event) => event.preventDefault());
  }
  show(unit, stage, position = stage.map.getPosition(unit), { keyboard = false, facing = unit.facing } = {}) {
    this.#portrait?.dispose();
    const terrain = position ? stage.map.getCellAt(position.x, position.y).terrain : null;
    const card = node("div", "unit-detail-card"), head = node("div", "unit-detail-head");
    const portrait = node("div", "unit-detail-portrait"), info = node("div", "unit-detail-info");
    this.#portrait = new CharacterPortraitView(portrait); this.#portrait.render(unit.character);
    const heading = node("h2", "unit-detail-name");
    if (unit.character.alias && unit.character.alias !== "なし") {
      heading.append(node("span", "unit-detail-alias", unit.character.alias));
    }
    heading.append(node("span", "", unit.character.name));
    info.append(heading,
      node("div", "unit-detail-side", stage.armyManager.getAffiliation(unit) === "PLAYER" ? "味方部隊" : "敵部隊"));
    const projectile = unit.hasAbility(Ability.BOW_ATTACK) ? "弓撃" : unit.hasAbility(Ability.THROW_ATTACK) ? "投擲" : null;
    const tactic = tacticName(unit), level = confusionLevel(unit);
    const lines = [`兵力 ${unit.troops}/${unit.maxTroops}`, `移動 ${unit.move}`,
      `遠距離 ${projectile ? `${projectile} ${uses(unit, UnitUse.PROJECTILE)}` : "使用不可"}`,
      `突撃 ${unit.hasAbility(Ability.CHARGE) ? uses(unit, UnitUse.CHARGE) : "使用不可"}`,
      `計略 ${(unit.maxUses[UnitUse.TACTIC] ?? 0) > 0 ? `${uses(unit, UnitUse.TACTIC)}（${tactic}${tactic === "撹乱" ? `Lv${level}` : ""}）` : "使用不可"}`,
      `向き ${FACING_NAMES[facing]}`, `地形 ${terrain ? TERRAIN_NAMES[terrain.id] ?? terrain.nameKey : "―"}`];
    for (const line of lines) info.append(node("div", "unit-detail-line", line));
    for (const effect of unit.statusEffects) info.append(node("div", "unit-detail-status",
      `${effect.type === "ILLUSION" ? "幻術 ☠" : "撹乱 ？"}：残り${effect.remainingTurns}ターン`));
    head.append(portrait, info); card.append(head);
    const stats = node("div", "unit-detail-stats");
    for (const [key, label] of [["martial", "武力"], ["command", "統率"], ["intelligence", "知略"], ["charisma", "人望"]]) {
      const stat = node("div", "unit-detail-stat"); stat.append(node("span", "", label), node("strong", "", String(unit.character[key]))); stats.append(stat);
    }
    card.append(stats);
    const traits = node("div", "unit-detail-traits");
    for (const [ability, label] of [[Ability.WATER_TERRAIN_AFFINITY, "水軍適正"], [Ability.WILD_TERRAIN_AFFINITY, "山野適正"],
      [Ability.SHIELD_COMBAT, "盾牌"], [Ability.ILLUSION, "幻術士"], [Ability.CHAIN_CAVALRY, "連環馬"]]) {
      if (unit.hasAbility(ability)) traits.append(node("span", "unit-detail-trait", label));
    }
    card.append(traits, node("p", "unit-detail-hint", "画面をもう一度タップすると閉じます"),
      node("p", "unit-detail-hint keyboard-hint", "PC：Esc・Enter・Spaceでも閉じます"));
    this.#root.replaceChildren(card); this.#root.hidden = false; this.#readyAt = keyboard ? 0 : Infinity;
    this.#focus.activate();
  }
  release() { if (this.#readyAt === Infinity && !this.#root.hidden) this.#readyAt = Date.now() + 250; }
  hide({ restoreFocus = true } = {}) {
    this.#root.hidden = true; this.#portrait?.dispose(); this.#portrait = null; this.#root.replaceChildren(); this.#readyAt = Infinity;
    this.#focus.deactivate({ restoreFocus });
  }
  get isOpen() { return !this.#root.hidden; }
  dispose() { this.hide({ restoreFocus: false }); this.#focus.dispose(); for (const [type, listener] of this.#bindings) this.#root.removeEventListener(type, listener); this.#bindings = []; }
}
