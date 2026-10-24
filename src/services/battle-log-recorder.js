import { ActionType, COMBAT_ACTION_TYPES } from "../core/action-request.js";
import { UnitAbility } from "../domain/unit-ability.js";
import { directionBetween, oppositeFacing } from "./action-targeting-rules.js";

const ACTION_NAMES = Object.freeze({ NORMAL_ATTACK: "攻撃", BOW_ATTACK: "弓撃", CHARGE: "突撃",
  CONFUSION_LV1: "撹乱Lv1", CONFUSION_LV2: "撹乱Lv2", CONFUSION_LV3: "撹乱Lv3",
  ILLUSION: "幻術", WIDE_ILLUSION: "広域幻術", FIRE: "火計", WATER: "水計", ILLUSION_ATTACK: "同士討ち" });
const statusText = (effects) => effects.map((effect) => `${effect.type === "ILLUSION" ? "幻術" : "撹乱"}${effect.remainingTurns}T`).join("・");

/** Records committed rule outcomes once. Rendering and loading never append entries. */
export class BattleLogRecorder {
  #stage;
  constructor(stage) { this.#stage = stage; }
  #append(type, text, units = []) {
    this.#stage.battleLog.append({ turn: this.#stage.turn, phase: this.#stage.phase, type, text,
      unitIds: [...new Set(units.map((unit) => unit.id))] });
  }
  phase() {
    const stage = this.#stage;
    const limit = stage.objectiveManager.getAll().find((objective) => typeof objective.maxTurn === "number")?.maxTurn;
    this.#append("PHASE", `―― ${stage.phase === "PLAYER" ? "味方" : "敵"}ターン ${stage.turn}${limit ? ` / ${limit}` : ""} ――`);
  }
  action(actor, type, result) {
    const entries = result.targetResults ?? [result];
    const units = entries.map((entry) => entry.unit ?? entry.target);
    const name = type === ActionType.BOW_ATTACK && !actor.hasAbility(UnitAbility.BOW_ATTACK) ? "投擲" : ACTION_NAMES[type] ?? "攻撃";
    const useId = result.use?.id ?? null;
    const remaining = useId === null ? "" : ` 残り${actor.remainingUses[useId] ?? 0}/${actor.maxUses[useId] ?? 0}回。`;
    const damaging = COMBAT_ACTION_TYPES.includes(type) || [ActionType.FIRE, ActionType.WATER, "ILLUSION_ATTACK"].includes(type);
    if (damaging) {
      const text = entries.map((entry, index) => `${units[index].character.name}に${entry.damage ?? 0}ダメージ`).join("、");
      this.#append("ACTION", `${actor.character.name}の${name}！ ${text}${this.#combatNotes(actor, type, result)}。${remaining}`, [actor, ...units]);
    } else {
      this.#append("ACTION", `${actor.character.name}の${name}！ ${entries.length}部隊中${entries.filter((entry) => entry.success).length}部隊に成功。${remaining}`, [actor, ...units]);
    }
    for (const [index, entry] of entries.entries()) {
      const unit = units[index];
      if (entry.defeated) this.#append("DEFEATED", `${unit.character.name}は敗走した。`, [unit]);
      else if (JSON.stringify(entry.statusEffects.before) !== JSON.stringify(entry.statusEffects.after)) {
        this.#append("STATUS", `　影響：${unit.character.name}［${statusText(entry.statusEffects.after) || "通常"}］`, [unit]);
      }
    }
  }
  #combatNotes(actor, type, result) {
    if (!result.calculation) return "";
    const target = result.target;
    if (type === ActionType.BOW_ATTACK) {
      if (target.hasAbility(UnitAbility.SHIELD_COMBAT)) return "（盾牌防御）";
      const from = directionBetween(result.targetPosition, result.actorPosition);
      const facing = result.targetFacing.before;
      return `（${from === facing ? "正面" : from === oppositeFacing(facing) ? "背面" : "側面"}）`;
    }
    if (![ActionType.NORMAL_ATTACK, "ILLUSION_ATTACK"].includes(type)) return "";
    const { directionRate, attackPenalty, terrainAdjustment } = result.calculation;
    const shield = target.hasAbility(UnitAbility.SHIELD_COMBAT);
    const notes = [shield
      ? `盾牌・${directionRate === 0.65 ? "正面" : directionRate === 1.15 ? "背面" : "側面"}`
      : directionRate === 0.8 ? "正面" : directionRate === 1.2 ? "背面" : "側面"];
    const attackerTerrain = this.#stage.map.getCellAt(result.actorPosition.x, result.actorPosition.y).terrain;
    const defenderTerrain = this.#stage.map.getCellAt(result.targetPosition.x, result.targetPosition.y).terrain;
    const swampNote = (unit) => unit.hasAbility(UnitAbility.CHAIN_CAVALRY) ? "湿地・連環馬不利" : "湿地不利";
    if (attackPenalty > 0) notes.push(swampNote(actor));
    if (terrainAdjustment < 0) notes.push(swampNote(target));
    else if (target.hasAbility(UnitAbility.CHAIN_CAVALRY) && ["plain", "road"].includes(defenderTerrain.id)) notes.push("連環馬防御");
    else if (defenderTerrain.combatModifiers.damageRate > 0) {
      notes.push(`${{ forest: "森", hill: "丘", mountain: "山岳" }[defenderTerrain.id] ?? defenderTerrain.nameKey}防御`);
    }
    if (attackerTerrain.combatModifiers.attackBonus > 0) notes.push("高所攻撃");
    return `［${notes.join("／")}］`;
  }
  phaseStatus(unit, result) {
    if (result === "NONE") return;
    this.#append("STATUS", `${unit.character.name}は${result === "ILLUSION" ? "幻術に惑わされた。" : "撹乱されており、この行動は休み。"}`, [unit]);
  }
  trap(result) {
    const { unit } = result;
    const name = result.trap.kind === "spell" ? "妖術罠" : "罠";
    this.#append("TRAP", result.neutralized ? `${unit.character.name}は${name}を見破って無効化した。罠はこの地点で消滅した。`
      : `${name}が発動！ ${unit.character.name}は${result.damage}ダメージを受けた。${statusText(unit.statusEffects) ? `［${statusText(unit.statusEffects)}］` : ""}`, [unit]);
    if (result.defeated) this.#append("DEFEATED", `${unit.character.name}は敗走した。`, [unit]);
  }
  event(event) {
    const deployed = (unit) => unit.hasTroops() && this.#stage.map.getPosition(unit) !== null;
    for (const message of event.logMessages ?? []) this.#append("EVENT", message);
    if (event.type === "REINFORCEMENT") {
      const units = event.deployments.map((deployment) => deployment.unit).filter(deployed);
      if (units.length) this.#append("EVENT", `${units.map((unit) => unit.character.name).join("、")}が援軍として戦場へ加わった。`, units);
    } else if (event.type === "BETRAYAL") {
      if (event.skipPresentationWhenAllDefeated && event.units.every(unit => !unit.hasTroops())) {
        this.#append("EVENT", `${event.units.map(unit => unit.character.name).join("、")}はすでに戦線を離れており、寝返りは起こらなかった。`, event.units);
        return;
      }
      const units = event.units.filter(deployed);
      if (units.length) this.#append("EVENT", `${units.map((unit) => unit.character.name).join("、")}が寝返った！`, units);
      // The betrayal has already applied its status effect. Record the affected
      // army after transfers, excluding defectors, defeated and reserve units.
      if (event.confusionTargetArmy !== null && event.confusionTurns > 0) {
        const affected = event.confusionTargetArmy.getUnits().filter(deployed);
        if (affected.length) {
          const mobs = affected.filter(unit => this.#stage.mobCharacters.includes(unit.character)).length;
          const army = event.confusionTargetArmy.affiliation === "ENEMY" ? "敵軍" : "味方軍";
          this.#append("EVENT", `${army}は内応に動揺。固有人物${affected.length - mobs}隊・モブ${mobs}隊が撹乱状態となった。`, affected);
        }
      }
    } else if (event.type === "MISSION_TRANSITION" && !event.logMessages?.length) this.#append("EVENT", "任務が更新された。");
  }
  result(result) { this.#append("BATTLE_RESULT", result.outcome === "VICTORY" ? "勝利条件を達成した。" : "敗北条件に該当した。戦闘終了。"); }
}
