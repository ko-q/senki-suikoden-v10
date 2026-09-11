/**
 * Unitが保持する能力ID。人物data上の日本語技能からの変換はStage data移植時に行う。
 */
export const UnitAbility = Object.freeze({
  WATER_TERRAIN_AFFINITY: "water_terrain_affinity",
  WILD_TERRAIN_AFFINITY: "wild_terrain_affinity",
  BOW_ATTACK: "bow_attack",
  THROW_ATTACK: "throw_attack",
  SHIELD_COMBAT: "shield_combat",
  CHARGE: "charge",
  CHAIN_CAVALRY: "chain_cavalry",
  CONFUSION_LEVEL_1: "confusion_level_1",
  CONFUSION_LEVEL_2: "confusion_level_2",
  CONFUSION_LEVEL_3: "confusion_level_3",
  ILLUSION: "illusion",
  WIDE_ILLUSION: "wide_illusion",
  FIRE_TACTIC: "fire_tactic",
  WATER_TACTIC: "water_tactic",
  ELEMENTAL_TACTIC_DAMAGE_75_PERCENT: "elemental_tactic_damage_75_percent",
  HIDDEN_TRAP_AWARENESS: "hidden_trap_awareness"
});

/**
 * v9の使用回数fieldと1対1で対応する安定ID。
 */
export const UnitUse = Object.freeze({
  PROJECTILE: "bow",
  CHARGE: "charge",
  TACTIC: "strategy"
});
