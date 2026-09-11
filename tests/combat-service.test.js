import test from "node:test";
import assert from "node:assert/strict";

import { createActionQueryContext } from "../src/core/action-query-context.js";
import { ActionType, createActionRequest } from "../src/core/action-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { Position } from "../src/domain/position.js";
import { UnitStatus } from "../src/domain/unit.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import { CombatService } from "../src/services/combat-service.js";
import { createStageDigest } from "../test-support/fixtures.js";
import {
  Affiliation,
  Facing,
  createServiceStage
} from "../test-support/service-fixtures.js";

function createAdjacentCombatStage(overrides = {}) {
  return createServiceStage({
    id: overrides.id ?? "adjacent_combat",
    map: overrides.map,
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        facing: Facing.NORTH,
        abilities: overrides.actorAbilities,
        maxUses: overrides.actorMaxUses,
        character: overrides.actorCharacter
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 1, y: 1 },
        facing: Facing.WEST,
        maxTroops: overrides.targetMaxTroops,
        troops: overrides.targetTroops,
        abilities: overrides.targetAbilities,
        statusEffects: overrides.targetStatusEffects,
        character: overrides.targetCharacter
      }
    ]
  });
}

test("CombatService executes the v9.7.75 normal damage formula", () => {
  const stage = createAdjacentCombatStage();
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const service = new CombatService();
  const request = createActionRequest(ActionType.NORMAL_ATTACK, actor, target);
  const random = new BattleRandom(1);
  const digestBeforeEstimate = createStageDigest(stage);
  const randomBeforeEstimate = random.exportState();

  assert.deepEqual(service.estimate(request, stage), {
    type: ActionType.NORMAL_ATTACK,
    actor,
    target,
    actorPosition: new Position(0, 1),
    targetPosition: new Position(1, 1),
    minimumDamage: 56,
    maximumDamage: 58,
    directionRate: 0.8,
    chargeConfusionRate: 0
  });
  assert.equal(createStageDigest(stage), digestBeforeEstimate);
  assert.deepEqual(random.exportState(), randomBeforeEstimate);

  const result = service.execute(request, stage, random);

  assert.equal(result.damage, 56);
  assert.deepEqual(result.troops, { before: 125, after: 69 });
  assert.equal(result.calculation.randomBonus, 0);
  assert.equal(result.calculation.commandReduction, 33);
  assert.equal(result.calculation.troopBonus, 28);
  assert.equal(result.calculation.baseDamage, 70);
  assert.equal(result.defeated, false);
  assert.equal(actor.facing, Facing.EAST);
  assert.equal(target.troops, 69);
  assert.deepEqual(random.exportState(), { algorithm: "xorshift32", state: 270369 });
});

test("CombatService keeps failed validation free of Unit and RNG changes", () => {
  const stage = createServiceStage({
    id: "invalid_bow",
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        maxUses: { [UnitUse.PROJECTILE]: 2 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 1 }
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const service = new CombatService();
  const request = createActionRequest(ActionType.BOW_ATTACK, actor, target);
  const random = new BattleRandom(9);
  const domainBefore = createStageDigest(stage);
  const randomBefore = random.exportState();

  assert.equal(service.canExecute(request, stage), false);
  assert.equal(service.estimate(request, stage), null);
  assert.deepEqual(
    service.inspectTargets(
      ActionType.BOW_ATTACK,
      createActionQueryContext(actor, stage.map.getPosition(actor)),
      stage
    ),
    []
  );
  assert.throws(
    () => service.execute(request, stage, random),
    { code: "COMBAT_ACTION_INVALID" }
  );
  assert.equal(createStageDigest(stage), domainBefore);
  assert.deepEqual(random.exportState(), randomBefore);
});

test("Projectile targeting preserves bow, throw and wall line-of-sight rules", () => {
  const bowStage = createServiceStage({
    id: "bow_range",
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        abilities: [UnitAbility.BOW_ATTACK],
        maxUses: { [UnitUse.PROJECTILE]: 2 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 3, y: 1 }
      }
    ]
  });
  const throwStage = createServiceStage({
    id: "throw_range",
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        abilities: [UnitAbility.THROW_ATTACK],
        maxUses: { [UnitUse.PROJECTILE]: 2 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 3, y: 1 }
      }
    ]
  });
  const blockedStage = createServiceStage({
    id: "blocked_bow",
    map: [
      ["plain", "plain", "plain"],
      ["plain", "wall", "plain"],
      ["plain", "plain", "plain"]
    ],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        abilities: [UnitAbility.BOW_ATTACK],
        maxUses: { [UnitUse.PROJECTILE]: 2 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 1 }
      }
    ]
  });
  const service = new CombatService();

  assert.equal(service.canExecute(createActionRequest(
    ActionType.BOW_ATTACK,
    bowStage.getUnit("actor"),
    bowStage.getUnit("target")
  ), bowStage), true);
  assert.equal(service.canExecute(createActionRequest(
    ActionType.BOW_ATTACK,
    throwStage.getUnit("actor"),
    throwStage.getUnit("target")
  ), throwStage), false);
  assert.equal(service.canExecute(createActionRequest(
    ActionType.BOW_ATTACK,
    blockedStage.getUnit("actor"),
    blockedStage.getUnit("target")
  ), blockedStage), false);
});

test("Bow damage applies the shield rate and consumes one projectile use", () => {
  const stage = createServiceStage({
    id: "shield_bow",
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        facing: Facing.NORTH,
        abilities: [UnitAbility.BOW_ATTACK],
        maxUses: { [UnitUse.PROJECTILE]: 2 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 1 },
        facing: Facing.EAST,
        abilities: [UnitAbility.SHIELD_COMBAT]
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const result = new CombatService().execute(
    createActionRequest(ActionType.BOW_ATTACK, actor, target),
    stage,
    new BattleRandom(1)
  );

  assert.equal(result.damage, 42);
  assert.equal(result.calculation.directionRate, 0.6);
  assert.deepEqual(result.use, { id: UnitUse.PROJECTILE, before: 2, after: 1 });
  assert.equal(actor.remainingUses[UnitUse.PROJECTILE], 1);
  assert.equal(actor.facing, Facing.EAST);
});

test("Charge retains CONFUSED beside ILLUSION under the approved v10 rule", () => {
  const stage = createAdjacentCombatStage({
    id: "charge_status",
    actorAbilities: [UnitAbility.CHARGE],
    actorMaxUses: { [UnitUse.CHARGE]: 2 },
    targetMaxTroops: 300,
    targetTroops: 300,
    targetCharacter: { command: 0 },
    targetStatusEffects: [{ type: UnitStatus.ILLUSION, remainingTurns: 2 }]
  });
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const result = new CombatService().execute(
    createActionRequest(ActionType.CHARGE, actor, target),
    stage,
    new BattleRandom(1)
  );

  assert.equal(result.damage, 135);
  assert.deepEqual(result.troops, { before: 300, after: 165 });
  assert.equal(result.confusion.success, true);
  assert.equal(result.confusion.facing, Facing.SOUTH);
  assert.equal(target.getStatusTurns(UnitStatus.CONFUSED), 1);
  assert.equal(target.getStatusTurns(UnitStatus.ILLUSION), 2);
  assert.equal(target.facing, Facing.SOUTH);
  assert.equal(actor.remainingUses[UnitUse.CHARGE], 1);
});

test("CombatService preserves swamp and chain-cavalry modifier order", () => {
  const stage = createServiceStage({
    id: "chain_swamp",
    map: [["swamp", "plain"]],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        abilities: [UnitAbility.CHAIN_CAVALRY]
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 1, y: 0 },
        facing: Facing.WEST,
        abilities: [UnitAbility.CHAIN_CAVALRY]
      }
    ]
  });
  const service = new CombatService();
  const estimate = service.estimate(createActionRequest(
    ActionType.NORMAL_ATTACK,
    stage.getUnit("actor"),
    stage.getUnit("target")
  ), stage);

  assert.equal(estimate.minimumDamage, 22);
  assert.equal(estimate.maximumDamage, 23);
});

test("forced normal attack permits only the dedicated adjacent allied path", () => {
  const stage = createServiceStage({
    id: "forced_allied_combat",
    map: [["plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 0 },
        character: { martial: 80, command: 70 }
      },
      {
        id: "ally",
        army: Affiliation.PLAYER,
        position: { x: 1, y: 0 },
        maxTroops: 300,
        troops: 300
      },
      {
        id: "enemy",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 0 }
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const ally = stage.getUnit("ally");
  const service = new CombatService();
  const standardRequest = createActionRequest(ActionType.NORMAL_ATTACK, actor, ally);
  const random = new BattleRandom(1);

  assert.equal(service.canExecute(standardRequest, stage), false);
  assert.equal(service.canExecuteForcedNormalAttack(actor, ally, stage), true);

  const result = service.executeForcedNormalAttack(actor, ally, stage, random);

  assert.equal(result.type, ActionType.NORMAL_ATTACK);
  assert.equal(result.forced, true);
  assert.equal(result.target, ally);
  assert.equal(ally.troops < 300, true);
  assert.throws(
    () => service.execute(standardRequest, stage, new BattleRandom(1)),
    { code: "COMBAT_ACTION_INVALID" }
  );
});
