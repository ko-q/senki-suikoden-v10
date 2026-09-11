import { createActionQueryContext } from "../core/action-query-context.js";
import { ActionType, createActionRequest } from "../core/action-request.js";
import { invariant, requireEnumValue } from "../core/domain-error.js";
import { BattleRandom } from "../domain/battle-random.js";
import { Position } from "../domain/position.js";
import { Stage } from "../domain/stage.js";
import { Facing, Unit, UnitActionState } from "../domain/unit.js";
import { UnitAbility, UnitUse } from "../domain/unit-ability.js";
import {
  directionBetween,
  manhattanDistance
} from "./action-targeting-rules.js";
import { CombatService } from "./combat-service.js";
import { MovementService } from "./movement-service.js";
import { TacticService } from "./tactic-service.js";

export const EnemyTurnPlanKind = Object.freeze({
  ACTION: "ACTION",
  WAIT: "WAIT"
});

export const ForcedActionType = Object.freeze({
  ILLUSION_ATTACK: "ILLUSION_ATTACK",
  ILLUSION_WAIT: "ILLUSION_WAIT"
});

const CONFUSION_ACTION_TYPES = Object.freeze([
  ActionType.CONFUSION_LV1,
  ActionType.CONFUSION_LV2,
  ActionType.CONFUSION_LV3
]);

function freezePath(path) {
  return Object.freeze(path.map((position) => new Position(position.x, position.y)));
}

function createEnemyTurnPlan({ kind, request = null, selectedPath = [], finalFacing = null }) {
  requireEnumValue(kind, EnemyTurnPlanKind, "ENEMY_PLAN_KIND_INVALID");
  invariant(Array.isArray(selectedPath), "ENEMY_PLAN_PATH_INVALID");
  invariant(
    (kind === EnemyTurnPlanKind.ACTION && request !== null)
      || (kind === EnemyTurnPlanKind.WAIT && request === null),
    "ENEMY_PLAN_REQUEST_INVALID"
  );
  invariant(
    finalFacing === null || Object.values(Facing).includes(finalFacing),
    "ENEMY_PLAN_FACING_INVALID"
  );
  return Object.freeze({
    kind,
    request,
    selectedPath: freezePath(selectedPath),
    finalFacing
  });
}

export function createForcedActionRequest(type, actor, target = null) {
  requireEnumValue(type, ForcedActionType, "FORCED_ACTION_TYPE_INVALID");
  invariant(actor instanceof Unit, "FORCED_ACTION_ACTOR_REQUIRED");
  invariant(
    (type === ForcedActionType.ILLUSION_ATTACK && target instanceof Unit && target !== actor)
      || (type === ForcedActionType.ILLUSION_WAIT && target === null),
    "FORCED_ACTION_TARGET_INVALID"
  );
  return Object.freeze({ type, actor, target });
}

function createForcedActionPlan(request, selectedPath) {
  invariant(Array.isArray(selectedPath), "FORCED_ACTION_PATH_INVALID");
  return Object.freeze({ request, selectedPath: freezePath(selectedPath) });
}

/**
 * v9.7.75の通常敵AIを、Domain変更を行わない確定Planへ変換する。
 */
export class AIService {
  #movementService;
  #combatService;
  #tacticService;
  #battleRandom;

  constructor({ movementService, combatService, tacticService, battleRandom }) {
    invariant(movementService instanceof MovementService, "AI_MOVEMENT_SERVICE_REQUIRED");
    invariant(combatService instanceof CombatService, "AI_COMBAT_SERVICE_REQUIRED");
    invariant(tacticService instanceof TacticService, "AI_TACTIC_SERVICE_REQUIRED");
    invariant(battleRandom instanceof BattleRandom, "AI_RANDOM_REQUIRED");
    this.#movementService = movementService;
    this.#combatService = combatService;
    this.#tacticService = tacticService;
    this.#battleRandom = battleRandom;
  }

  selectNextEnemyUnit(stage) {
    this.#requireStage(stage);
    const candidates = stage.unitOrder.filter((unit) => (
      stage.armyManager.enemyArmy.has(unit)
      && unit.hasTroops()
      && stage.map.getPosition(unit) !== null
      && unit.actionState === UnitActionState.READY
    ));
    candidates.sort((left, right) => this.#compareEnemyTurnOrder(left, right, stage));
    return candidates[0] ?? null;
  }

  planEnemyTurn(unit, stage) {
    this.#requireActiveUnit(unit, stage);
    invariant(stage.armyManager.enemyArmy.has(unit), "AI_ENEMY_UNIT_REQUIRED");
    const actorPosition = stage.map.getPosition(unit);
    const targets = this.#sortByDistance(this.#enemyTargets(unit, stage), actorPosition, stage);
    if (targets.length === 0) {
      return createEnemyTurnPlan({ kind: EnemyTurnPlanKind.WAIT });
    }

    const pursuitRule = stage.aiConfig.getPursuitRule(unit);
    if (pursuitRule !== null) {
      return this.#planPursuitTurn(unit, targets, pursuitRule, stage);
    }

    const canAttackThisTurn = this.#canAttackThisTurn(unit, targets, stage);
    const targetPriorityRule = stage.aiConfig.getTargetPriorityRule(unit);
    const strategyRequest = targetPriorityRule?.disableStrategy === true
      ? null
      : this.#chooseStrategyRequest(unit, stage);
    if (strategyRequest !== null) {
      const useRate = this.#strategyUseRate(unit, canAttackThisTurn, stage);
      if (this.#battleRandom.next() < useRate) {
        return createEnemyTurnPlan({
          kind: EnemyTurnPlanKind.ACTION,
          request: strategyRequest
        });
      }
    }

    const bowRequest = targets
      .map((target) => createActionRequest(ActionType.BOW_ATTACK, unit, target))
      .find((request) => this.#combatService.canExecute(request, stage));
    if (bowRequest !== undefined) {
      return createEnemyTurnPlan({
        kind: EnemyTurnPlanKind.ACTION,
        request: bowRequest
      });
    }

    const target = this.#movementTarget(unit, targets, stage);
    const fullPath = manhattanDistance(actorPosition, stage.map.getPosition(target)) > 1
      ? this.#movementService.findPathToAdjacent(unit, target, stage)
      : Object.freeze([]);
    const selectedPath = this.#movementPrefix(unit, fullPath, stage);
    const actionPosition = selectedPath.at(-1) ?? actorPosition;
    const queryContext = createActionQueryContext(unit, actionPosition);
    const chargeRequest = createActionRequest(ActionType.CHARGE, unit, target);
    if (this.#combatService.canExecute(chargeRequest, stage, queryContext)) {
      return createEnemyTurnPlan({
        kind: EnemyTurnPlanKind.ACTION,
        request: chargeRequest,
        selectedPath
      });
    }
    const normalRequest = createActionRequest(ActionType.NORMAL_ATTACK, unit, target);
    if (this.#combatService.canExecute(normalRequest, stage, queryContext)) {
      return createEnemyTurnPlan({
        kind: EnemyTurnPlanKind.ACTION,
        request: normalRequest,
        selectedPath
      });
    }

    const nearestAfterMove = this.#sortByDistance(targets, actionPosition, stage)[0] ?? null;
    return createEnemyTurnPlan({
      kind: EnemyTurnPlanKind.WAIT,
      selectedPath,
      finalFacing: nearestAfterMove === null
        ? null
        : directionBetween(actionPosition, stage.map.getPosition(nearestAfterMove))
    });
  }

  planIllusionAction(unit, stage) {
    this.#requireActiveUnit(unit, stage, false);
    const actorArmy = stage.armyManager.getArmy(unit);
    invariant(actorArmy !== null, "AI_ILLUSION_ARMY_REQUIRED");
    const actorPosition = stage.map.getPosition(unit);
    let best = null;

    for (const target of stage.unitOrder) {
      if (
        target === unit
        || !actorArmy.has(target)
        || !target.hasTroops()
        || stage.map.getPosition(target) === null
      ) {
        continue;
      }
      const targetPosition = stage.map.getPosition(target);
      const path = manhattanDistance(actorPosition, targetPosition) > 1
        ? this.#movementService.findPathToAdjacent(unit, target, stage)
        : Object.freeze([]);
      const endPosition = path.at(-1) ?? actorPosition;
      const cost = this.#pathCost(unit, path, stage);
      if (
        manhattanDistance(endPosition, targetPosition) !== 1
        || cost > unit.move
      ) {
        continue;
      }
      if (
        best === null
        || cost < best.cost
        || (cost === best.cost && target.troops < best.target.troops)
      ) {
        best = { target, path, cost };
      }
    }

    if (best === null) {
      return createForcedActionPlan(
        createForcedActionRequest(ForcedActionType.ILLUSION_WAIT, unit),
        []
      );
    }
    return createForcedActionPlan(
      createForcedActionRequest(
        ForcedActionType.ILLUSION_ATTACK,
        unit,
        best.target
      ),
      best.path
    );
  }

  #planPursuitTurn(unit, targets, rule, stage) {
    const actorPosition = stage.map.getPosition(unit);
    const adjacentAtStart = targets.find((target) => (
      manhattanDistance(actorPosition, stage.map.getPosition(target)) === 1
    )) ?? null;

    if (adjacentAtStart !== null) {
      return this.#planMeleeAction(unit, adjacentAtStart, [], stage, true)
        ?? createEnemyTurnPlan({ kind: EnemyTurnPlanKind.WAIT });
    }

    const fullPath = this.#pursuitMovePath(unit, targets, rule, stage);
    const selectedPath = this.#movementPrefix(unit, fullPath, stage);
    if (selectedPath.length > 0) {
      const actionPosition = selectedPath.at(-1);
      const adjacentAfterMove = targets.find((target) => (
        manhattanDistance(actionPosition, stage.map.getPosition(target)) === 1
      )) ?? null;
      if (adjacentAfterMove !== null) {
        const plan = this.#planMeleeAction(
          unit,
          adjacentAfterMove,
          selectedPath,
          stage,
          false
        );
        if (plan !== null) {
          return plan;
        }
      }
      return createEnemyTurnPlan({
        kind: EnemyTurnPlanKind.WAIT,
        selectedPath
      });
    }

    // 前進不能時だけ、v9と同じく使用率抽選なしで計略へ切り替える。
    const strategyRequest = this.#chooseStrategyRequest(unit, stage);
    if (strategyRequest !== null) {
      return createEnemyTurnPlan({
        kind: EnemyTurnPlanKind.ACTION,
        request: strategyRequest
      });
    }
    const bowRequest = targets
      .map((target) => createActionRequest(ActionType.BOW_ATTACK, unit, target))
      .find((request) => this.#combatService.canExecute(request, stage));
    if (bowRequest !== undefined) {
      return createEnemyTurnPlan({
        kind: EnemyTurnPlanKind.ACTION,
        request: bowRequest
      });
    }
    const nearest = targets[0] ?? null;
    return createEnemyTurnPlan({
      kind: EnemyTurnPlanKind.WAIT,
      finalFacing: nearest === null
        ? null
        : directionBetween(actorPosition, stage.map.getPosition(nearest))
    });
  }

  #planMeleeAction(unit, target, selectedPath, stage, allowCharge) {
    const actorPosition = selectedPath.at(-1) ?? stage.map.getPosition(unit);
    const queryContext = createActionQueryContext(unit, actorPosition);
    if (allowCharge) {
      const chargeRequest = createActionRequest(ActionType.CHARGE, unit, target);
      if (this.#combatService.canExecute(chargeRequest, stage, queryContext)) {
        return createEnemyTurnPlan({
          kind: EnemyTurnPlanKind.ACTION,
          request: chargeRequest,
          selectedPath
        });
      }
    }
    const normalRequest = createActionRequest(ActionType.NORMAL_ATTACK, unit, target);
    if (this.#combatService.canExecute(normalRequest, stage, queryContext)) {
      return createEnemyTurnPlan({
        kind: EnemyTurnPlanKind.ACTION,
        request: normalRequest,
        selectedPath
      });
    }
    return null;
  }

  #pursuitMovePath(unit, targets, rule, stage) {
    const actorPosition = stage.map.getPosition(unit);
    if (actorPosition.y <= rule.insideMaximumRow) {
      const gatePath = this.#pathToRushOutside(unit, rule, stage);
      if (gatePath.length > 0) {
        return gatePath;
      }
    }

    const reachable = this.#movementService.getReachableCellsInV9SearchOrder(unit, stage);
    if (reachable.length === 0) {
      return Object.freeze([]);
    }
    const pursuitDistance = (position) => {
      let best = Number.POSITIVE_INFINITY;
      for (const target of targets) {
        const distance = this.#movementService.getMinimumCostToAdjacentIgnoringUnits(
          unit,
          position,
          target,
          stage
        );
        if (distance < best) {
          best = distance;
        }
      }
      return best;
    };

    const currentDistance = pursuitDistance(actorPosition);
    let best = null;
    for (const entry of reachable) {
      const navigationDistance = pursuitDistance(entry.position);
      if (!Number.isFinite(navigationDistance)) {
        continue;
      }
      const directDistance = targets.reduce((minimum, target) => Math.min(
        minimum,
        manhattanDistance(entry.position, stage.map.getPosition(target))
      ), Number.POSITIVE_INFINITY);
      const candidate = {
        position: entry.position,
        moveCost: entry.cost,
        navigationDistance,
        directDistance
      };
      if (
        best === null
        || candidate.navigationDistance < best.navigationDistance
        || (
          candidate.navigationDistance === best.navigationDistance
          && candidate.directDistance < best.directDistance
        )
        || (
          candidate.navigationDistance === best.navigationDistance
          && candidate.directDistance === best.directDistance
          && candidate.moveCost > best.moveCost
        )
      ) {
        best = candidate;
      }
    }
    if (best === null || !(best.navigationDistance < currentDistance)) {
      return Object.freeze([]);
    }
    return this.#movementService.findPathToCell(unit, best.position, stage);
  }

  #pathToRushOutside(unit, rule, stage) {
    const actorPosition = stage.map.getPosition(unit);
    const [leftColumn, rightColumn] = rule.gateColumns;
    const preferredColumn = actorPosition.x <= leftColumn ? leftColumn : rightColumn;
    const otherColumn = preferredColumn === leftColumn ? rightColumn : leftColumn;
    const candidates = [];
    for (let y = rule.outsideRow; y >= rule.candidateMinimumRow; y -= 1) {
      candidates.push(new Position(preferredColumn, y));
      candidates.push(new Position(otherColumn, y));
    }

    for (const candidate of candidates) {
      if (candidate.equals(actorPosition)) {
        continue;
      }
      const cell = stage.map.getCellAt(candidate.x, candidate.y);
      if (cell.isOccupied()) {
        continue;
      }
      const path = this.#movementService.findPathToCell(unit, candidate, stage);
      if (path.length > 0) {
        return path;
      }
    }

    const gateDistance = (position) => Math.min(
      Math.abs(position.x - leftColumn) + Math.abs(position.y - rule.outsideRow),
      Math.abs(position.x - rightColumn) + Math.abs(position.y - rule.outsideRow)
    );
    const laneDistance = (position) => Math.min(
      Math.abs(position.x - leftColumn),
      Math.abs(position.x - rightColumn)
    );
    const currentDistance = gateDistance(actorPosition);
    const currentLaneDistance = laneDistance(actorPosition);
    let best = null;

    for (let y = 0; y <= rule.insideMaximumRow; y += 1) {
      for (let x = 0; x < stage.map.width; x += 1) {
        const position = new Position(x, y);
        if (position.equals(actorPosition)) {
          continue;
        }
        const cell = stage.map.getCellAt(x, y);
        if (cell.isOccupied() || !cell.terrain.canEnter(unit)) {
          continue;
        }
        const path = this.#movementService.findPathToCell(unit, position, stage);
        if (path.length === 0) {
          continue;
        }
        const distance = gateDistance(position);
        const distanceFromLane = laneDistance(position);
        const advances = distance < currentDistance
          || (distance === currentDistance && distanceFromLane < currentLaneDistance);
        if (!advances) {
          continue;
        }
        const candidate = {
          path,
          distance,
          laneDistance: distanceFromLane,
          y,
          totalCost: this.#pathCost(unit, path, stage)
        };
        if (
          best === null
          || candidate.distance < best.distance
          || (candidate.distance === best.distance && candidate.y > best.y)
          || (
            candidate.distance === best.distance
            && candidate.y === best.y
            && candidate.laneDistance < best.laneDistance
          )
          || (
            candidate.distance === best.distance
            && candidate.y === best.y
            && candidate.laneDistance === best.laneDistance
            && candidate.totalCost < best.totalCost
          )
        ) {
          best = candidate;
        }
      }
    }
    return best === null ? Object.freeze([]) : best.path;
  }

  #chooseStrategyRequest(unit, stage) {
    const actorPosition = stage.map.getPosition(unit);
    const queryContext = createActionQueryContext(unit, actorPosition);

    const wideIllusionRequest = createActionRequest(
      ActionType.WIDE_ILLUSION,
      unit,
      unit
    );
    if (
      this.#isWideIllusionMode(unit, stage)
      && this.#tacticService.canExecute(wideIllusionRequest, stage, queryContext)
    ) {
      return wideIllusionRequest;
    }

    if (unit.hasAbility(UnitAbility.FIRE_TACTIC)) {
      if (stage.aiConfig.cautiousElementalUnits.includes(unit)) {
        return this.#chooseCautiousElementalRequest(
          ActionType.FIRE,
          unit,
          stage,
          queryContext
        );
      }
      return this.#chooseElementalRequest(ActionType.FIRE, unit, stage, queryContext);
    }
    if (unit.hasAbility(UnitAbility.WATER_TACTIC)) {
      if (stage.aiConfig.cautiousElementalUnits.includes(unit)) {
        return this.#chooseCautiousElementalRequest(
          ActionType.WATER,
          unit,
          stage,
          queryContext
        );
      }
      return this.#chooseElementalRequest(ActionType.WATER, unit, stage, queryContext);
    }
    if (unit.hasAbility(UnitAbility.ILLUSION)) {
      let best = null;
      for (const target of this.#tacticService.inspectTargets(
        ActionType.ILLUSION,
        queryContext,
        stage
      )) {
        const score = target.character.martial * 0.55
          + target.character.command * 0.25
          + (100 - target.character.intelligence) * 0.35;
        if (best === null || score > best.score) {
          best = { target, score };
        }
      }
      return best === null
        ? null
        : createActionRequest(ActionType.ILLUSION, unit, best.target);
    }

    const maximumLevel = this.#maximumConfusionLevel(unit);
    let best = null;
    for (const center of this.#enemyTargets(unit, stage)) {
      for (let level = 1; level <= maximumLevel; level += 1) {
        const type = CONFUSION_ACTION_TYPES[level - 1];
        const request = createActionRequest(type, unit, center);
        const estimate = this.#tacticService.estimate(request, stage, queryContext);
        if (estimate === null) {
          continue;
        }
        let score = 0;
        for (const targetEstimate of estimate.targets) {
          score += targetEstimate.successChance / 100 * (
            1
            + targetEstimate.unit.character.martial / 180
            + targetEstimate.unit.character.command / 260
          );
        }
        score -= level * 0.16;
        if (best === null || score > best.score) {
          best = { request, score };
        }
      }
    }
    return best?.request ?? null;
  }

  #chooseElementalRequest(type, unit, stage, queryContext) {
    let best = null;
    for (const target of this.#tacticService.inspectTargets(type, queryContext, stage)) {
      const request = createActionRequest(type, unit, target);
      const estimate = this.#tacticService.estimate(request, stage, queryContext);
      let score = 0;
      for (const targetEstimate of estimate.targets) {
        score += stage.armyManager.areEnemies(unit, targetEstimate.unit)
          ? targetEstimate.damage
          : -targetEstimate.damage * 1.25;
      }
      score += estimate.confusionChance * 0.8;
      if (best === null || score > best.score) {
        best = { request, score };
      }
    }
    return best?.request ?? null;
  }

  #chooseCautiousElementalRequest(type, unit, stage, queryContext) {
    const canAttackThisTurn = this.#canAttackThisTurn(
      unit,
      this.#enemyTargets(unit, stage),
      stage
    );
    let best = null;

    for (const target of this.#tacticService.inspectTargets(type, queryContext, stage)) {
      const request = createActionRequest(type, unit, target);
      const estimate = this.#tacticService.estimate(request, stage, queryContext);
      const enemyTargets = estimate.targets.filter((item) => (
        stage.armyManager.areEnemies(unit, item.unit)
      ));
      const alliedTargets = estimate.targets.filter((item) => (
        stage.armyManager.areAllies(unit, item.unit)
      ));
      if (enemyTargets.length === 0) {
        continue;
      }
      if (enemyTargets.length === 1 && canAttackThisTurn) {
        continue;
      }

      const enemyDamage = enemyTargets.reduce((sum, item) => sum + item.damage, 0);
      const alliedDamage = alliedTargets.reduce((sum, item) => sum + item.damage, 0);
      const enemyDefeats = enemyTargets.filter((item) => item.damage >= item.unit.troops).length;
      const alliedUnsafe = alliedTargets.some((item) => (
        item.damage >= item.unit.troops
        || item.damage >= item.unit.troops * 0.4
      ));
      if (alliedUnsafe || (alliedDamage > 0 && alliedDamage >= enemyDamage * 0.5)) {
        continue;
      }

      const score = enemyTargets.length * 1000
        + enemyDamage
        + enemyDefeats * 450
        + estimate.confusionChance * 2
        - alliedTargets.length * 350
        - alliedDamage * 3;
      if (score <= 0) {
        continue;
      }
      if (best === null || score > best.score) {
        best = { request, score };
      }
    }
    return best?.request ?? null;
  }

  #canAttackThisTurn(unit, targets, stage) {
    const actorPosition = stage.map.getPosition(unit);
    for (const target of targets) {
      const normalRequest = createActionRequest(ActionType.NORMAL_ATTACK, unit, target);
      if (this.#combatService.canExecute(normalRequest, stage)) {
        return true;
      }
    }
    for (const target of targets) {
      const bowRequest = createActionRequest(ActionType.BOW_ATTACK, unit, target);
      if (this.#combatService.canExecute(bowRequest, stage)) {
        return true;
      }
    }
    for (const target of targets) {
      const path = this.#movementService.findPathToAdjacent(unit, target, stage);
      const endPosition = path.at(-1) ?? actorPosition;
      if (
        path.length > 0
        && this.#pathCost(unit, path, stage) <= unit.move
        && manhattanDistance(endPosition, stage.map.getPosition(target)) === 1
      ) {
        return true;
      }
    }
    return false;
  }

  #strategyUseRate(unit, canAttackThisTurn, stage) {
    if (stage.aiConfig.cautiousElementalUnits.includes(unit)) {
      return 1;
    }
    if (stage.aiConfig.adviserUnits.includes(unit)) {
      return 0.98;
    }
    if (unit.hasAbility(UnitAbility.ILLUSION)) {
      return canAttackThisTurn ? 0.85 : 1;
    }
    if (
      unit.hasAbility(UnitAbility.FIRE_TACTIC)
      || unit.hasAbility(UnitAbility.WATER_TACTIC)
    ) {
      return canAttackThisTurn ? 0.7 : 1;
    }
    if (!canAttackThisTurn) {
      return 1;
    }

    const martialLead = unit.character.martial - unit.character.intelligence;
    if (martialLead >= 30) {
      return 0.03;
    }
    if (martialLead >= 20) {
      return 0.08;
    }
    if (martialLead >= 10) {
      return 0.15;
    }
    if (martialLead > 0) {
      return 0.25;
    }
    if (martialLead === 0) {
      return 0.45;
    }
    if (martialLead >= -10) {
      return 0.6;
    }
    if (martialLead >= -20) {
      return 0.75;
    }
    return 0.85;
  }

  #maximumConfusionLevel(unit) {
    const uses = unit.remainingUses[UnitUse.TACTIC] ?? 0;
    if (unit.hasAbility(UnitAbility.CONFUSION_LEVEL_3)) {
      return Math.min(3, uses);
    }
    if (unit.hasAbility(UnitAbility.CONFUSION_LEVEL_2)) {
      return Math.min(2, uses);
    }
    if (unit.hasAbility(UnitAbility.CONFUSION_LEVEL_1)) {
      return Math.min(1, uses);
    }
    return 0;
  }

  #movementPrefix(unit, path, stage) {
    const selected = [];
    let spent = 0;
    for (const position of path) {
      const cell = stage.map.getCellAt(position.x, position.y);
      const moveCost = cell.terrain.getMoveCost(unit);
      if (
        spent + moveCost > unit.move
        || (cell.occupant !== null && cell.occupant !== unit)
      ) {
        break;
      }
      selected.push(position);
      spent += moveCost;
    }
    return selected;
  }

  #pathCost(unit, path, stage) {
    let cost = 0;
    for (const position of path) {
      cost += stage.map.getCellAt(position.x, position.y).terrain.getMoveCost(unit);
    }
    return cost;
  }

  #enemyTargets(unit, stage) {
    return stage.unitOrder.filter((target) => (
      target !== unit
      && target.hasTroops()
      && stage.map.getPosition(target) !== null
      && stage.armyManager.areEnemies(unit, target)
    ));
  }

  #isWideIllusionMode(unit, stage) {
    const rule = stage.aiConfig.getWideIllusionRule(unit);
    if (rule === null) {
      return false;
    }
    const actorPosition = stage.map.getPosition(unit);
    const suppressorPosition = stage.map.getPosition(rule.suppressor);
    if (!rule.suppressor.hasTroops() || suppressorPosition === null) {
      return true;
    }
    return manhattanDistance(actorPosition, suppressorPosition) > rule.suppressionRange;
  }

  #movementTarget(unit, targets, stage) {
    const priorityRule = stage.aiConfig.getTargetPriorityRule(unit);
    if (priorityRule === null) {
      return targets[0];
    }
    const targetSet = new Set(priorityRule.targets);
    const preferredTargets = targets.filter((target) => targetSet.has(target));
    return preferredTargets[0] ?? targets[0];
  }

  #compareEnemyTurnOrder(left, right, stage) {
    const leftRuleIndex = stage.aiConfig.pursuitRules.findIndex((rule) => rule.has(left));
    const rightRuleIndex = stage.aiConfig.pursuitRules.findIndex((rule) => rule.has(right));
    const leftIsPursuit = leftRuleIndex >= 0;
    const rightIsPursuit = rightRuleIndex >= 0;
    if (leftIsPursuit !== rightIsPursuit) {
      return leftIsPursuit ? -1 : 1;
    }
    if (leftIsPursuit && leftRuleIndex !== rightRuleIndex) {
      return leftRuleIndex - rightRuleIndex;
    }
    if (leftIsPursuit) {
      const leftPosition = stage.map.getPosition(left);
      const rightPosition = stage.map.getPosition(right);
      if (leftPosition.y !== rightPosition.y) {
        return rightPosition.y - leftPosition.y;
      }
      const columns = stage.aiConfig.pursuitRules[leftRuleIndex].gateColumns;
      const leftLaneDistance = Math.min(...columns.map((column) => (
        Math.abs(leftPosition.x - column)
      )));
      const rightLaneDistance = Math.min(...columns.map((column) => (
        Math.abs(rightPosition.x - column)
      )));
      if (leftLaneDistance !== rightLaneDistance) {
        return leftLaneDistance - rightLaneDistance;
      }
    }
    return stage.unitOrder.indexOf(left) - stage.unitOrder.indexOf(right);
  }

  #sortByDistance(units, origin, stage) {
    const order = new Map(stage.unitOrder.map((unit, index) => [unit, index]));
    return [...units].sort((left, right) => {
      const distanceDifference = manhattanDistance(origin, stage.map.getPosition(left))
        - manhattanDistance(origin, stage.map.getPosition(right));
      if (distanceDifference !== 0) {
        return distanceDifference;
      }
      return order.get(left) - order.get(right);
    });
  }

  #requireStage(stage) {
    invariant(stage instanceof Stage, "AI_STAGE_REQUIRED");
  }

  #requireActiveUnit(unit, stage, requireReady = true) {
    this.#requireStage(stage);
    invariant(unit instanceof Unit, "AI_UNIT_REQUIRED");
    invariant(stage.getUnits().includes(unit), "AI_UNIT_NOT_IN_STAGE");
    invariant(unit.hasTroops(), "AI_UNIT_DEFEATED");
    invariant(stage.map.getPosition(unit) !== null, "AI_UNIT_NOT_PLACED");
    invariant(stage.armyManager.getArmy(unit) !== null, "AI_UNIT_WITHOUT_ARMY");
    if (requireReady) {
      invariant(unit.actionState === UnitActionState.READY, "AI_UNIT_NOT_READY");
    }
  }
}
