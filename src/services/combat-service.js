import { ActionType, COMBAT_ACTION_TYPES } from "../core/action-request.js";
import { invariant, requireEnumValue } from "../core/domain-error.js";
import { BattleRandom } from "../domain/battle-random.js";
import { Position } from "../domain/position.js";
import { Stage } from "../domain/stage.js";
import { Facing, Unit, UnitStatus } from "../domain/unit.js";
import { UnitAbility, UnitUse } from "../domain/unit-ability.js";
import {
  directionBetween,
  getLivingUnitsInOrder,
  getQueryOrigin,
  getUnitPosition,
  hasClearLineOfSight,
  manhattanDistance,
  oppositeFacing
} from "./action-targeting-rules.js";

const COMBAT_ACTION_TYPE_SET = new Set(COMBAT_ACTION_TYPES);
const RANDOM_DAMAGE_BONUS_MAXIMUM = 3;
const RANDOM_FACINGS = Object.freeze([
  Facing.NORTH,
  Facing.EAST,
  Facing.SOUTH,
  Facing.WEST
]);

function requireCombatType(actionType) {
  requireEnumValue(actionType, ActionType, "COMBAT_ACTION_TYPE_INVALID");
  invariant(COMBAT_ACTION_TYPE_SET.has(actionType), "COMBAT_ACTION_TYPE_INVALID", { actionType });
  return actionType;
}

function requireRequest(request) {
  invariant(request !== null && typeof request === "object", "COMBAT_REQUEST_REQUIRED");
  requireCombatType(request.type);
  invariant(request.actor instanceof Unit, "COMBAT_ACTOR_REQUIRED");
  invariant(request.target instanceof Unit, "COMBAT_TARGET_REQUIRED");
  return request;
}

function copyStatusEffects(unit) {
  return Object.freeze(unit.statusEffects.map((effect) => Object.freeze({ ...effect })));
}

function freezeCalculation(calculation) {
  return Object.freeze({ ...calculation });
}

function remainingUse(unit, useId) {
  return unit.remainingUses[useId] ?? 0;
}

/**
 * v9.7.75の通常攻撃・弓撃・突撃を、Map等を変更せずUnitへatomic反映する。
 */
export class CombatService {
  inspectTargets(actionType, actionQueryContext, stage) {
    requireCombatType(actionType);
    invariant(stage instanceof Stage, "COMBAT_STAGE_REQUIRED");
    invariant(
      actionQueryContext !== null && typeof actionQueryContext === "object",
      "COMBAT_QUERY_CONTEXT_REQUIRED"
    );
    const actor = actionQueryContext.actor;
    if (!(actor instanceof Unit)) {
      return Object.freeze([]);
    }

    return Object.freeze(getLivingUnitsInOrder(stage).filter((target) => this.canExecute(
      { type: actionType, actor, target },
      stage,
      actionQueryContext
    )));
  }

  canExecute(request, stage, actionQueryContext = null) {
    requireRequest(request);
    invariant(stage instanceof Stage, "COMBAT_STAGE_REQUIRED");
    const { type, actor, target } = request;
    const actorPosition = getQueryOrigin(actor, stage, actionQueryContext);
    const targetPosition = getUnitPosition(stage, target);

    if (
      actorPosition === null
      || targetPosition === null
      || actor === target
      || !stage.armyManager.areEnemies(actor, target)
    ) {
      return false;
    }

    const distance = manhattanDistance(actorPosition, targetPosition);
    if (type === ActionType.NORMAL_ATTACK) {
      return distance === 1;
    }
    if (type === ActionType.BOW_ATTACK) {
      return this.#canUseProjectile(actor)
        && distance >= 2
        && distance <= this.#projectileMaximumRange(actor)
        && hasClearLineOfSight(stage, actorPosition, targetPosition);
    }
    return actor.hasAbility(UnitAbility.CHARGE)
      && remainingUse(actor, UnitUse.CHARGE) >= 1
      && distance === 1;
  }

  estimate(request, stage, actionQueryContext = null) {
    requireRequest(request);
    invariant(stage instanceof Stage, "COMBAT_STAGE_REQUIRED");
    if (!this.canExecute(request, stage, actionQueryContext)) {
      return null;
    }

    const actorPosition = getQueryOrigin(request.actor, stage, actionQueryContext);
    const targetPosition = getUnitPosition(stage, request.target);
    const minimum = this.#calculateDamage(
      request.type,
      request.actor,
      request.target,
      actorPosition,
      targetPosition,
      stage,
      0
    );
    const maximum = this.#calculateDamage(
      request.type,
      request.actor,
      request.target,
      actorPosition,
      targetPosition,
      stage,
      RANDOM_DAMAGE_BONUS_MAXIMUM
    );

    return Object.freeze({
      type: request.type,
      actor: request.actor,
      target: request.target,
      actorPosition: new Position(actorPosition.x, actorPosition.y),
      targetPosition: new Position(targetPosition.x, targetPosition.y),
      minimumDamage: minimum.damage,
      maximumDamage: maximum.damage,
      directionRate: minimum.directionRate,
      chargeConfusionRate: request.type === ActionType.CHARGE
        ? this.#chargeConfusionRate(request.target)
        : 0
    });
  }

  execute(request, stage, battleRandom) {
    requireRequest(request);
    invariant(stage instanceof Stage, "COMBAT_STAGE_REQUIRED");
    invariant(battleRandom instanceof BattleRandom, "COMBAT_RANDOM_REQUIRED");
    invariant(this.canExecute(request, stage), "COMBAT_ACTION_INVALID");

    return this.#executeValidated(request, stage, battleRandom, false);
  }

  /**
   * 幻術の同士討ちだけに使う。通常commandの敵味方判定を緩めない。
   */
  canExecuteForcedNormalAttack(actor, target, stage) {
    invariant(actor instanceof Unit, "COMBAT_ACTOR_REQUIRED");
    invariant(target instanceof Unit, "COMBAT_TARGET_REQUIRED");
    invariant(stage instanceof Stage, "COMBAT_STAGE_REQUIRED");
    const actorPosition = stage.map.getPosition(actor);
    const targetPosition = stage.map.getPosition(target);
    return actor !== target
      && actorPosition !== null
      && targetPosition !== null
      && actor.hasTroops()
      && target.hasTroops()
      && stage.armyManager.areAllies(actor, target)
      && manhattanDistance(actorPosition, targetPosition) === 1;
  }

  executeForcedNormalAttack(actor, target, stage, battleRandom) {
    invariant(battleRandom instanceof BattleRandom, "COMBAT_RANDOM_REQUIRED");
    invariant(
      this.canExecuteForcedNormalAttack(actor, target, stage),
      "COMBAT_FORCED_ACTION_INVALID"
    );
    return this.#executeValidated(
      { type: ActionType.NORMAL_ATTACK, actor, target },
      stage,
      battleRandom,
      true
    );
  }

  #executeValidated(request, stage, battleRandom, forced) {

    const { type, actor, target } = request;
    const actorPosition = stage.map.getPosition(actor);
    const targetPosition = stage.map.getPosition(target);
    const actorFacingBefore = actor.facing;
    const targetFacingBefore = target.facing;
    const targetStatusBefore = copyStatusEffects(target);
    const troopsBefore = target.troops;
    const useId = this.#useIdFor(type);
    const useBefore = useId === null ? null : remainingUse(actor, useId);
    const randomStateBefore = battleRandom.exportState();

    const randomBonus = Math.floor(battleRandom.next() * 4);
    const calculation = this.#calculateDamage(
      type,
      actor,
      target,
      actorPosition,
      targetPosition,
      stage,
      randomBonus
    );
    const troopsAfter = Math.max(0, troopsBefore - calculation.damage);
    let confusion = null;

    if (type === ActionType.CHARGE && troopsAfter > 0) {
      const chance = this.#chargeConfusionRate(target);
      const roll = battleRandom.next();
      const success = roll < chance;
      let facing = null;
      if (success) {
        facing = RANDOM_FACINGS[Math.floor(battleRandom.next() * RANDOM_FACINGS.length)];
      }
      confusion = Object.freeze({ chance, roll, success, facing });
    }

    const actorFacingAfter = directionBetween(actorPosition, targetPosition);
    actor.setFacing(actorFacingAfter);
    if (useId !== null) {
      actor.consumeUse(useId);
    }
    target.applyDamage(calculation.damage);
    if (confusion?.success === true) {
      target.setStatus(
        UnitStatus.CONFUSED,
        Math.max(target.getStatusTurns(UnitStatus.CONFUSED), 1)
      );
      target.setFacing(confusion.facing);
    }

    const useAfter = useId === null ? null : remainingUse(actor, useId);
    return Object.freeze({
      type,
      forced,
      actor,
      target,
      actorPosition: new Position(actorPosition.x, actorPosition.y),
      targetPosition: new Position(targetPosition.x, targetPosition.y),
      actorFacing: Object.freeze({ before: actorFacingBefore, after: actor.facing }),
      targetFacing: Object.freeze({ before: targetFacingBefore, after: target.facing }),
      troops: Object.freeze({ before: troopsBefore, after: target.troops }),
      statusEffects: Object.freeze({ before: targetStatusBefore, after: copyStatusEffects(target) }),
      defeated: !target.hasTroops(),
      damage: calculation.damage,
      calculation: freezeCalculation(calculation),
      confusion,
      use: useId === null
        ? null
        : Object.freeze({ id: useId, before: useBefore, after: useAfter }),
      randomState: Object.freeze({
        before: randomStateBefore,
        after: battleRandom.exportState()
      })
    });
  }

  #canUseProjectile(unit) {
    return (
      unit.hasAbility(UnitAbility.BOW_ATTACK)
      || unit.hasAbility(UnitAbility.THROW_ATTACK)
    ) && remainingUse(unit, UnitUse.PROJECTILE) >= 1;
  }

  #projectileMaximumRange(unit) {
    const throwOnly = unit.hasAbility(UnitAbility.THROW_ATTACK)
      && !unit.hasAbility(UnitAbility.BOW_ATTACK);
    return throwOnly ? 2 : 3;
  }

  #useIdFor(actionType) {
    if (actionType === ActionType.BOW_ATTACK) {
      return UnitUse.PROJECTILE;
    }
    if (actionType === ActionType.CHARGE) {
      return UnitUse.CHARGE;
    }
    return null;
  }

  #chargeConfusionRate(target) {
    return Math.max(0, Math.min(0.25, (100 - target.character.command) * 0.0025));
  }

  #calculateDamage(
    actionType,
    attacker,
    defender,
    attackerPosition,
    defenderPosition,
    stage,
    randomBonus
  ) {
    const directionRate = this.#directionRate(
      actionType,
      attackerPosition,
      defenderPosition,
      defender
    );
    const common = this.#calculateCommonDamage(
      attacker,
      defender,
      attackerPosition,
      defenderPosition,
      stage,
      directionRate,
      randomBonus,
      actionType !== ActionType.CHARGE
    );

    if (actionType !== ActionType.CHARGE) {
      return common;
    }

    const chargeDamage = Math.max(
      common.damage + 8,
      Math.round(common.damage * 1.65)
    );
    const damage = this.#applyChainCavalryModifiers(
      attacker,
      defender,
      attackerPosition,
      defenderPosition,
      stage,
      chargeDamage
    );
    return {
      ...common,
      damage,
      damageBeforeCharge: common.damage,
      damageBeforeChainCavalry: chargeDamage,
      chargeRate: 1.65,
      chargeFixed: 8
    };
  }

  #calculateCommonDamage(
    attacker,
    defender,
    attackerPosition,
    defenderPosition,
    stage,
    directionRate,
    randomBonus,
    applyChainCavalry
  ) {
    const attackerTerrain = stage.map.getCellAt(attackerPosition.x, attackerPosition.y).terrain;
    const defenderTerrain = stage.map.getCellAt(defenderPosition.x, defenderPosition.y).terrain;
    const attackerModifiers = attackerTerrain.combatModifiers;
    const defenderModifiers = defenderTerrain.combatModifiers;
    const commandReduction = Math.round(defender.character.command * 2 / 3);
    const abilityDifference = attacker.character.martial - commandReduction;
    const troopBonus = Math.floor(
      attacker.troops
      * (attacker.character.martial + 100)
      * (attacker.character.command + 100)
      / 100000
    );
    const baseDamage = Math.max(
      1,
      25
      + abilityDifference
      + troopBonus
      + (attackerModifiers.attackBonus ?? 0)
      + randomBonus
    );
    const attackPenalty = attackerTerrain.id === "swamp"
      && !attacker.hasAbility(UnitAbility.WATER_TERRAIN_AFFINITY)
      ? Math.max(
        Math.round(baseDamage * (attackerModifiers.attackPenaltyRate ?? 0)),
        attackerModifiers.attackPenaltyFixed ?? 0
      )
      : 0;
    const rawDamage = Math.max(1, baseDamage - attackPenalty);
    let terrainAdjustment;
    if (
      defenderTerrain.id === "swamp"
      && !defender.hasAbility(UnitAbility.WATER_TERRAIN_AFFINITY)
    ) {
      terrainAdjustment = -Math.max(
        Math.round(rawDamage * (defenderModifiers.defensePenaltyRate ?? 0)),
        defenderModifiers.defensePenaltyFixed ?? 0
      );
    } else {
      terrainAdjustment = Math.max(
        Math.round(rawDamage * (defenderModifiers.damageRate ?? 0)),
        defenderModifiers.damageFixed ?? 0
      );
    }
    const terrainAdjustedDamage = Math.max(1, rawDamage - terrainAdjustment);
    const directionAdjustedDamage = Math.max(
      1,
      Math.round(terrainAdjustedDamage * directionRate)
    );
    const damage = applyChainCavalry
      ? this.#applyChainCavalryModifiers(
        attacker,
        defender,
        attackerPosition,
        defenderPosition,
        stage,
        directionAdjustedDamage
      )
      : directionAdjustedDamage;

    return {
      damage,
      randomBonus,
      commandReduction,
      abilityDifference,
      troopBonus,
      baseDamage,
      attackPenalty,
      rawDamage,
      terrainAdjustment,
      terrainAdjustedDamage,
      directionRate,
      directionAdjustedDamage,
      attackerTerrainId: attackerTerrain.id,
      defenderTerrainId: defenderTerrain.id
    };
  }

  #applyChainCavalryModifiers(
    attacker,
    defender,
    attackerPosition,
    defenderPosition,
    stage,
    damage
  ) {
    let adjustedDamage = Math.max(1, damage);
    const attackerTerrainId = stage.map.getCellAt(attackerPosition.x, attackerPosition.y).terrain.id;
    const defenderTerrainId = stage.map.getCellAt(defenderPosition.x, defenderPosition.y).terrain.id;

    if (
      attacker.hasAbility(UnitAbility.CHAIN_CAVALRY)
      && attackerTerrainId === "swamp"
    ) {
      adjustedDamage = Math.max(1, Math.round(adjustedDamage * 0.7));
    }

    if (defender.hasAbility(UnitAbility.CHAIN_CAVALRY)) {
      if (defenderTerrainId === "plain" || defenderTerrainId === "road") {
        adjustedDamage = Math.max(1, Math.round(adjustedDamage * 0.8));
      } else if (defenderTerrainId === "swamp") {
        adjustedDamage = Math.max(1, Math.round(adjustedDamage * 1.2));
      }
    }
    return adjustedDamage;
  }

  #directionRate(actionType, attackerPosition, defenderPosition, defender) {
    if (actionType === ActionType.BOW_ATTACK && defender.hasAbility(UnitAbility.SHIELD_COMBAT)) {
      return 0.6;
    }

    const from = directionBetween(defenderPosition, attackerPosition);
    if (defender.hasAbility(UnitAbility.SHIELD_COMBAT)) {
      if (from === defender.facing) {
        return 0.65;
      }
      if (from === oppositeFacing(defender.facing)) {
        return 1.15;
      }
      return 0.9;
    }

    if (from === defender.facing) {
      return 0.8;
    }
    if (actionType !== ActionType.BOW_ATTACK && from === oppositeFacing(defender.facing)) {
      return 1.2;
    }
    return 1;
  }
}
