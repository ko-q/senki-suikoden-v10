import { ActionType, TACTIC_ACTION_TYPES } from "../core/action-request.js";
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
  manhattanDistance
} from "./action-targeting-rules.js";

const TACTIC_ACTION_TYPE_SET = new Set(TACTIC_ACTION_TYPES);
const RANDOM_FACINGS = Object.freeze([
  Facing.NORTH,
  Facing.EAST,
  Facing.SOUTH,
  Facing.WEST
]);

// v9.7.75の知略差補正値。計算式の近似へ置き換えず、同じ整数値を保持する。
const STRATEGY_INTELLIGENCE_DIFF_ADJUSTMENT_LUT = Object.freeze([
  0, 0, 1, 1, 2, 2, 3, 4, 5, 6,
  7, 8, 9, 10, 12, 13, 14, 15, 17, 18,
  20, 21, 23, 24, 26, 28, 29, 31, 33, 34,
  36, 38, 40, 42, 44, 46, 48, 50, 52, 54,
  56, 58, 60, 62, 64, 67, 69, 71, 73, 76,
  78, 80, 83, 85, 88, 90, 92, 95, 97, 100,
  103, 105, 108, 110, 113, 116, 118, 121, 124, 126,
  129, 132, 135, 138, 140, 143, 146, 149, 152, 155,
  158, 161, 164, 167, 170, 173, 176, 179, 182, 185,
  188, 192, 195, 198, 201, 204, 208, 211, 214, 217,
  221
]);

function requireTacticType(actionType) {
  requireEnumValue(actionType, ActionType, "TACTIC_ACTION_TYPE_INVALID");
  invariant(TACTIC_ACTION_TYPE_SET.has(actionType), "TACTIC_ACTION_TYPE_INVALID", { actionType });
  return actionType;
}

function requireRequest(request) {
  invariant(request !== null && typeof request === "object", "TACTIC_REQUEST_REQUIRED");
  requireTacticType(request.type);
  invariant(request.actor instanceof Unit, "TACTIC_ACTOR_REQUIRED");
  invariant(request.target instanceof Unit, "TACTIC_TARGET_REQUIRED");
  return request;
}

function remainingUse(unit) {
  return unit.remainingUses[UnitUse.TACTIC] ?? 0;
}

function copyStatusEffects(unit) {
  return Object.freeze(unit.statusEffects.map((effect) => Object.freeze({ ...effect })));
}

function copyPosition(position) {
  return new Position(position.x, position.y);
}

function freezeTargetResult(result) {
  return Object.freeze({
    ...result,
    position: copyPosition(result.position),
    troops: Object.freeze({ ...result.troops }),
    facing: Object.freeze({ ...result.facing }),
    statusEffects: Object.freeze({
      before: result.statusEffects.before,
      after: result.statusEffects.after
    })
  });
}

/**
 * v9.7.75の撹乱・幻術・火計・水計をUnitへatomic反映する。
 * CONFUSEDとILLUSIONの独立保持だけは承認済みv10仕様を適用する。
 */
export class TacticService {
  inspectTargets(actionType, actionQueryContext, stage) {
    requireTacticType(actionType);
    invariant(stage instanceof Stage, "TACTIC_STAGE_REQUIRED");
    invariant(
      actionQueryContext !== null && typeof actionQueryContext === "object",
      "TACTIC_QUERY_CONTEXT_REQUIRED"
    );
    const actor = actionQueryContext.actor;
    if (!(actor instanceof Unit)) {
      return Object.freeze([]);
    }

    if (actionType === ActionType.WIDE_ILLUSION) {
      return this.canExecute(
        { type: actionType, actor, target: actor },
        stage,
        actionQueryContext
      )
        ? Object.freeze([actor])
        : Object.freeze([]);
    }

    return Object.freeze(getLivingUnitsInOrder(stage).filter((target) => this.canExecute(
      { type: actionType, actor, target },
      stage,
      actionQueryContext
    )));
  }

  canExecute(request, stage, actionQueryContext = null) {
    requireRequest(request);
    invariant(stage instanceof Stage, "TACTIC_STAGE_REQUIRED");
    const { type, actor, target } = request;
    const actorPosition = getQueryOrigin(actor, stage, actionQueryContext);
    if (actorPosition === null || !this.#canActorUse(type, actor)) {
      return false;
    }

    if (type === ActionType.WIDE_ILLUSION) {
      return target === actor
        && this.#wideIllusionTargets(actor, actorPosition, stage).length > 0;
    }

    const targetPosition = getUnitPosition(stage, target);
    if (
      targetPosition === null
      || actor === target
      || !stage.armyManager.areEnemies(actor, target)
      || manhattanDistance(actorPosition, targetPosition) > 3
      || !hasClearLineOfSight(stage, actorPosition, targetPosition)
    ) {
      return false;
    }

    if (type === ActionType.ILLUSION) {
      return this.#canImproveIllusion(target);
    }
    if (type === ActionType.FIRE || type === ActionType.WATER) {
      return true;
    }

    const level = this.#levelFor(type);
    if (level === 1) {
      return this.#canImproveConfusion(target);
    }
    return this.#confusionTargets(actor, target, level, actorPosition, stage).length > 0;
  }

  estimate(request, stage, actionQueryContext = null) {
    requireRequest(request);
    invariant(stage instanceof Stage, "TACTIC_STAGE_REQUIRED");
    if (!this.canExecute(request, stage, actionQueryContext)) {
      return null;
    }

    const actorPosition = getQueryOrigin(request.actor, stage, actionQueryContext);
    const targetPosition = request.type === ActionType.WIDE_ILLUSION
      ? actorPosition
      : getUnitPosition(stage, request.target);
    const targetEstimates = this.#isElemental(request.type)
      ? this.#elementalTargets(request.actor, request.target, actorPosition, stage).map((unit) => {
        const position = stage.map.getPosition(unit);
        const damage = this.#elementalDamage(
          request.type,
          request.actor,
          unit,
          unit === request.target,
          position,
          stage
        );
        return Object.freeze({ unit, position: copyPosition(position), ...damage });
      })
      : this.#statusTargets(request, actorPosition, stage).map((unit) => Object.freeze({
        unit,
        position: copyPosition(stage.map.getPosition(unit)),
        successChance: this.strategySuccessChance(
          this.#isIllusion(request.type) ? 100 : request.actor.character.intelligence,
          unit.character.intelligence
        )
      }));

    return Object.freeze({
      type: request.type,
      actor: request.actor,
      target: request.target,
      actorPosition: copyPosition(actorPosition),
      targetPosition: copyPosition(targetPosition),
      useCost: this.#useCost(request.type),
      confusionChance: this.#isElemental(request.type)
        ? this.#elementalConfusionChance(request.type, request.target)
        : 0,
      targets: Object.freeze(targetEstimates)
    });
  }

  execute(request, stage, battleRandom) {
    requireRequest(request);
    invariant(stage instanceof Stage, "TACTIC_STAGE_REQUIRED");
    invariant(battleRandom instanceof BattleRandom, "TACTIC_RANDOM_REQUIRED");
    invariant(this.canExecute(request, stage), "TACTIC_ACTION_INVALID");

    const randomStateBefore = battleRandom.exportState();
    if (this.#isElemental(request.type)) {
      return this.#executeElemental(request, stage, battleRandom, randomStateBefore);
    }
    return this.#executeStatus(request, stage, battleRandom, randomStateBefore);
  }

  strategySuccessChance(userIntelligence, targetIntelligence) {
    invariant(Number.isFinite(userIntelligence), "TACTIC_USER_INTELLIGENCE_INVALID");
    invariant(Number.isFinite(targetIntelligence), "TACTIC_TARGET_INTELLIGENCE_INVALID");
    const rawDifference = Math.round(userIntelligence - targetIntelligence);
    const difference = Math.max(-100, Math.min(100, rawDifference));
    const adjustment = STRATEGY_INTELLIGENCE_DIFF_ADJUSTMENT_LUT[Math.abs(difference)];
    const signedAdjustment = difference < 0 ? -adjustment : adjustment;
    return Math.max(3, Math.min(98, 20 + signedAdjustment));
  }

  #executeStatus(request, stage, battleRandom, randomStateBefore) {
    const { type, actor, target } = request;
    const actorPosition = stage.map.getPosition(actor);
    const targetPosition = type === ActionType.WIDE_ILLUSION
      ? actorPosition
      : stage.map.getPosition(target);
    const actorFacingBefore = actor.facing;
    const useCost = this.#useCost(type);
    const useBefore = useCost === 0 ? null : remainingUse(actor);
    const statusType = this.#isIllusion(type) ? UnitStatus.ILLUSION : UnitStatus.CONFUSED;
    const effectiveIntelligence = this.#isIllusion(type) ? 100 : actor.character.intelligence;
    const targets = this.#statusTargets(request, actorPosition, stage);
    const plans = [];

    for (const affected of targets) {
      const position = stage.map.getPosition(affected);
      const chance = this.strategySuccessChance(
        effectiveIntelligence,
        affected.character.intelligence
      );
      const successRoll = battleRandom.next() * 100;
      const success = successRoll < chance;
      let effectTurns = 0;
      let effectTurnsRoll = null;
      let nextFacing = affected.facing;
      let facingRoll = null;

      if (success) {
        effectTurnsRoll = battleRandom.next() * 100;
        effectTurns = effectTurnsRoll < chance / 2 ? 2 : 1;
        if (statusType === UnitStatus.CONFUSED) {
          facingRoll = battleRandom.next();
          nextFacing = RANDOM_FACINGS[Math.floor(facingRoll * RANDOM_FACINGS.length)];
        }
      }

      plans.push({
        unit: affected,
        position,
        chance,
        successRoll,
        success,
        effectTurns,
        effectTurnsRoll,
        facingRoll,
        nextFacing,
        troopsBefore: affected.troops,
        facingBefore: affected.facing,
        statusBefore: copyStatusEffects(affected),
        statusTurnsBefore: affected.getStatusTurns(statusType),
        statusTurnsAfter: success
          ? Math.max(affected.getStatusTurns(statusType), effectTurns)
          : affected.getStatusTurns(statusType)
      });
    }

    if (type !== ActionType.WIDE_ILLUSION) {
      actor.setFacing(directionBetween(actorPosition, targetPosition));
    }
    if (useCost > 0) {
      actor.consumeUse(UnitUse.TACTIC, useCost);
    }
    for (const plan of plans) {
      if (!plan.success) {
        continue;
      }
      plan.unit.setStatus(statusType, plan.statusTurnsAfter);
      if (statusType === UnitStatus.CONFUSED) {
        plan.unit.setFacing(plan.nextFacing);
      }
    }

    const targetResults = Object.freeze(plans.map((plan) => freezeTargetResult({
      unit: plan.unit,
      position: plan.position,
      successChance: plan.chance,
      successRoll: plan.successRoll,
      success: plan.success,
      effectTurns: plan.effectTurns,
      effectTurnsRoll: plan.effectTurnsRoll,
      facingRoll: plan.facingRoll,
      statusType,
      statusTurns: Object.freeze({
        before: plan.statusTurnsBefore,
        after: plan.unit.getStatusTurns(statusType)
      }),
      troops: Object.freeze({ before: plan.troopsBefore, after: plan.unit.troops }),
      facing: Object.freeze({ before: plan.facingBefore, after: plan.unit.facing }),
      statusEffects: Object.freeze({
        before: plan.statusBefore,
        after: copyStatusEffects(plan.unit)
      }),
      defeated: false,
      damage: 0
    })));

    return Object.freeze({
      type,
      actor,
      target,
      level: this.#levelFor(type),
      actorPosition: copyPosition(actorPosition),
      targetPosition: copyPosition(targetPosition),
      actorFacing: Object.freeze({ before: actorFacingBefore, after: actor.facing }),
      use: useCost === 0
        ? null
        : Object.freeze({
          id: UnitUse.TACTIC,
          cost: useCost,
          before: useBefore,
          after: remainingUse(actor)
        }),
      targetResults,
      successfulTargets: Object.freeze(
        targetResults.filter((result) => result.success).map((result) => result.unit)
      ),
      defeatedUnits: Object.freeze([]),
      randomState: Object.freeze({
        before: randomStateBefore,
        after: battleRandom.exportState()
      })
    });
  }

  #executeElemental(request, stage, battleRandom, randomStateBefore) {
    const { type, actor, target } = request;
    const actorPosition = stage.map.getPosition(actor);
    const targetPosition = stage.map.getPosition(target);
    const actorFacingBefore = actor.facing;
    const useBefore = remainingUse(actor);
    const targets = this.#elementalTargets(actor, target, actorPosition, stage);
    const plans = targets.map((affected) => {
      const position = stage.map.getPosition(affected);
      return {
        unit: affected,
        position,
        damage: this.#elementalDamage(
          type,
          actor,
          affected,
          affected === target,
          position,
          stage
        ),
        troopsBefore: affected.troops,
        troopsAfter: 0,
        facingBefore: affected.facing,
        statusBefore: copyStatusEffects(affected)
      };
    });
    for (const plan of plans) {
      plan.troopsAfter = Math.max(0, plan.troopsBefore - plan.damage.damage);
    }

    const centerPlan = plans.find((plan) => plan.unit === target);
    invariant(centerPlan !== undefined, "TACTIC_ELEMENTAL_CENTER_MISSING");
    const confusionChance = this.#elementalConfusionChance(type, target);
    const confusionRoll = battleRandom.next() * 100;
    const rollSucceeded = confusionRoll < confusionChance;
    const confusionSucceeded = centerPlan.troopsAfter > 0 && rollSucceeded;
    let confusionFacing = null;
    let confusionFacingRoll = null;
    if (confusionSucceeded) {
      confusionFacingRoll = battleRandom.next();
      confusionFacing = RANDOM_FACINGS[
        Math.floor(confusionFacingRoll * RANDOM_FACINGS.length)
      ];
    }

    actor.setFacing(directionBetween(actorPosition, targetPosition));
    actor.consumeUse(UnitUse.TACTIC);
    for (const plan of plans) {
      plan.unit.applyDamage(plan.damage.damage);
    }
    if (confusionSucceeded) {
      target.setStatus(
        UnitStatus.CONFUSED,
        Math.max(target.getStatusTurns(UnitStatus.CONFUSED), 1)
      );
      target.setFacing(confusionFacing);
    }

    const targetResults = Object.freeze(plans.map((plan) => freezeTargetResult({
      unit: plan.unit,
      position: plan.position,
      successChance: plan.unit === target ? confusionChance : 0,
      successRoll: plan.unit === target ? confusionRoll : null,
      success: plan.unit === target && confusionSucceeded,
      rollSucceeded: plan.unit === target && rollSucceeded,
      effectTurns: plan.unit === target && confusionSucceeded ? 1 : 0,
      effectTurnsRoll: null,
      facingRoll: plan.unit === target ? confusionFacingRoll : null,
      statusType: plan.unit === target ? UnitStatus.CONFUSED : null,
      statusTurns: Object.freeze({
        before: plan.unit === target
          ? plan.statusBefore.find((effect) => effect.type === UnitStatus.CONFUSED)?.remainingTurns ?? 0
          : 0,
        after: plan.unit === target ? plan.unit.getStatusTurns(UnitStatus.CONFUSED) : 0
      }),
      troops: Object.freeze({ before: plan.troopsBefore, after: plan.unit.troops }),
      facing: Object.freeze({ before: plan.facingBefore, after: plan.unit.facing }),
      statusEffects: Object.freeze({
        before: plan.statusBefore,
        after: copyStatusEffects(plan.unit)
      }),
      defeated: !plan.unit.hasTroops(),
      damage: plan.damage.damage,
      damageDetails: Object.freeze({ ...plan.damage })
    })));

    return Object.freeze({
      type,
      actor,
      target,
      level: 1,
      actorPosition: copyPosition(actorPosition),
      targetPosition: copyPosition(targetPosition),
      actorFacing: Object.freeze({ before: actorFacingBefore, after: actor.facing }),
      use: Object.freeze({
        id: UnitUse.TACTIC,
        cost: 1,
        before: useBefore,
        after: remainingUse(actor)
      }),
      confusion: Object.freeze({
        chance: confusionChance,
        roll: confusionRoll,
        rollSucceeded,
        success: confusionSucceeded,
        facingRoll: confusionFacingRoll,
        facing: confusionFacing
      }),
      targetResults,
      successfulTargets: confusionSucceeded ? Object.freeze([target]) : Object.freeze([]),
      defeatedUnits: Object.freeze(
        targetResults.filter((result) => result.defeated).map((result) => result.unit)
      ),
      randomState: Object.freeze({
        before: randomStateBefore,
        after: battleRandom.exportState()
      })
    });
  }

  #canActorUse(actionType, actor) {
    if (actionType === ActionType.WIDE_ILLUSION) {
      return actor.hasAbility(UnitAbility.ILLUSION)
        && actor.hasAbility(UnitAbility.WIDE_ILLUSION);
    }
    if (remainingUse(actor) < this.#useCost(actionType)) {
      return false;
    }
    if (actionType === ActionType.ILLUSION) {
      return actor.hasAbility(UnitAbility.ILLUSION);
    }
    if (actionType === ActionType.FIRE) {
      return actor.hasAbility(UnitAbility.FIRE_TACTIC);
    }
    if (actionType === ActionType.WATER) {
      return actor.hasAbility(UnitAbility.WATER_TACTIC);
    }
    return this.#maximumConfusionLevel(actor) >= this.#levelFor(actionType);
  }

  #maximumConfusionLevel(actor) {
    if (actor.hasAbility(UnitAbility.CONFUSION_LEVEL_3)) {
      return 3;
    }
    if (actor.hasAbility(UnitAbility.CONFUSION_LEVEL_2)) {
      return 2;
    }
    if (actor.hasAbility(UnitAbility.CONFUSION_LEVEL_1)) {
      return 1;
    }
    return 0;
  }

  #levelFor(actionType) {
    if (actionType === ActionType.CONFUSION_LV2) {
      return 2;
    }
    if (actionType === ActionType.CONFUSION_LV3) {
      return 3;
    }
    return 1;
  }

  #useCost(actionType) {
    if (actionType === ActionType.WIDE_ILLUSION) {
      return 0;
    }
    if (actionType === ActionType.CONFUSION_LV2) {
      return 2;
    }
    if (actionType === ActionType.CONFUSION_LV3) {
      return 3;
    }
    return 1;
  }

  #isIllusion(actionType) {
    return actionType === ActionType.ILLUSION
      || actionType === ActionType.WIDE_ILLUSION;
  }

  #isElemental(actionType) {
    return actionType === ActionType.FIRE || actionType === ActionType.WATER;
  }

  #canImproveConfusion(target) {
    return target.hasTroops() && target.getStatusTurns(UnitStatus.CONFUSED) < 2;
  }

  #canImproveIllusion(target) {
    return target.hasTroops()
      && !target.hasAbility(UnitAbility.ILLUSION)
      && target.getStatusTurns(UnitStatus.ILLUSION) < 2;
  }

  #statusTargets(request, actorPosition, stage) {
    if (request.type === ActionType.WIDE_ILLUSION) {
      return this.#wideIllusionTargets(request.actor, actorPosition, stage);
    }
    if (request.type === ActionType.ILLUSION) {
      return [request.target];
    }
    return this.#confusionTargets(
      request.actor,
      request.target,
      this.#levelFor(request.type),
      actorPosition,
      stage
    );
  }

  #confusionTargets(actor, center, level, actorPosition, stage) {
    const centerPosition = stage.map.getPosition(center);
    const radius = Math.max(0, level - 1);
    return getLivingUnitsInOrder(stage).filter((target) => {
      const targetPosition = stage.map.getPosition(target);
      return stage.armyManager.areEnemies(actor, target)
        && manhattanDistance(centerPosition, targetPosition) <= radius
        && this.#canImproveConfusion(target)
        && hasClearLineOfSight(stage, actorPosition, targetPosition);
    });
  }

  #wideIllusionTargets(actor, actorPosition, stage) {
    return getLivingUnitsInOrder(stage).filter((target) => {
      const targetPosition = stage.map.getPosition(target);
      return stage.armyManager.areEnemies(actor, target)
        && manhattanDistance(actorPosition, targetPosition) <= 3
        && this.#canImproveIllusion(target)
        && hasClearLineOfSight(stage, actorPosition, targetPosition);
    });
  }

  #elementalTargets(actor, center, actorPosition, stage) {
    const centerPosition = stage.map.getPosition(center);
    return getLivingUnitsInOrder(stage).filter((target) => {
      const targetPosition = stage.map.getPosition(target);
      return manhattanDistance(centerPosition, targetPosition) <= 1
        && hasClearLineOfSight(stage, actorPosition, targetPosition);
    });
  }

  #elementalDamage(actionType, actor, target, isCenter, targetPosition, stage) {
    const damageResistance = (
      target.character.command * 2 + target.character.intelligence
    ) / 3;
    let centerDamage;
    if (actionType === ActionType.FIRE) {
      centerDamage = Math.max(1, Math.round(133 - damageResistance * 0.55));
    } else {
      centerDamage = Math.max(1, Math.round(117 - damageResistance * 0.45));
    }
    const baseDamage = isCenter ? centerDamage : Math.round(centerDamage * 0.65);
    const terrain = stage.map.getCellAt(targetPosition.x, targetPosition.y).terrain;
    let terrainRate = 1;
    if (terrain.id === "road") {
      terrainRate -= 0.1;
    }
    if (actionType === ActionType.FIRE && terrain.id === "forest") {
      terrainRate += 0.2;
    }
    if (
      actionType === ActionType.WATER
      && (
        terrain.id === "swamp"
        || terrain.id === "water"
        || this.#isAdjacentToWater(targetPosition, stage)
      )
    ) {
      terrainRate += 0.2;
    }
    terrainRate = Math.max(0.1, terrainRate);
    const unitDamageRate = actor.hasAbility(UnitAbility.ELEMENTAL_TACTIC_DAMAGE_75_PERCENT)
      ? 0.75
      : 1;
    return {
      damage: Math.max(1, Math.round(baseDamage * terrainRate * unitDamageRate)),
      baseDamage,
      centerDamage,
      terrainRate,
      unitDamageRate,
      terrainId: terrain.id
    };
  }

  #elementalConfusionChance(actionType, target) {
    const resistance = (
      target.character.command + target.character.intelligence * 2
    ) / 3;
    if (actionType === ActionType.FIRE) {
      return Math.max(1, Math.min(18, Math.round((100 - resistance) * 0.2)));
    }
    return Math.max(2, Math.min(24, Math.round((100 - resistance) * 0.28)));
  }

  #isAdjacentToWater(position, stage) {
    const neighbors = [
      { x: position.x, y: position.y - 1 },
      { x: position.x + 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x - 1, y: position.y }
    ];
    return neighbors.some((neighbor) => {
      const cell = stage.map.getCellAt(neighbor.x, neighbor.y);
      return cell !== null && cell.terrain.id === "water";
    });
  }
}
