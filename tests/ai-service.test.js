import test from "node:test";
import assert from "node:assert/strict";

import { ActionType } from "../src/core/action-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import {
  AIService,
  EnemyTurnPlanKind,
  ForcedActionType
} from "../src/services/ai-service.js";
import { CombatService } from "../src/services/combat-service.js";
import { MovementService } from "../src/services/movement-service.js";
import { TacticService } from "../src/services/tactic-service.js";
import { createStageDigest } from "../test-support/fixtures.js";
import { createServiceStage } from "../test-support/service-fixtures.js";

function createService(stage, seed = 1) {
  const battleRandom = new BattleRandom(seed);
  return {
    battleRandom,
    service: new AIService({
      movementService: new MovementService(),
      combatService: new CombatService(),
      tacticService: new TacticService(),
      battleRandom
    })
  };
}

function pathCoordinates(path) {
  return path.map((position) => [position.x, position.y]);
}

test("AIService plans movement and charge without changing Domain or RNG", () => {
  const stage = createServiceStage({
    id: "ai_charge",
    map: [["plain", "plain", "plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 0 },
        move: 2,
        abilities: [UnitAbility.CHARGE],
        maxUses: { [UnitUse.CHARGE]: 1 }
      },
      { id: "target", army: "PLAYER", position: { x: 3, y: 0 } }
    ]
  });
  const { service, battleRandom } = createService(stage);
  const before = createStageDigest(stage);
  const randomBefore = battleRandom.exportState();

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.kind, EnemyTurnPlanKind.ACTION);
  assert.equal(plan.request.type, ActionType.CHARGE);
  assert.equal(plan.request.target, stage.getUnit("target"));
  assert.deepEqual(pathCoordinates(plan.selectedPath), [[1, 0], [2, 0]]);
  assert.equal(Object.isFrozen(plan), true);
  assert.equal(createStageDigest(stage), before);
  assert.deepEqual(battleRandom.exportState(), randomBefore);
});

test("AIService gives a valid projectile priority over movement", () => {
  const stage = createServiceStage({
    id: "ai_bow",
    map: [["plain", "plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 0 },
        abilities: [UnitAbility.BOW_ATTACK],
        maxUses: { [UnitUse.PROJECTILE]: 1 }
      },
      { id: "target", army: "PLAYER", position: { x: 2, y: 0 } }
    ]
  });
  const { service } = createService(stage);

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.request.type, ActionType.BOW_ATTACK);
  assert.equal(plan.request.target, stage.getUnit("target"));
  assert.deepEqual(plan.selectedPath, []);
});

test("AI strategy selection consumes exactly one decision roll", () => {
  const stage = createServiceStage({
    id: "ai_strategy",
    map: [["plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 0 },
        abilities: [UnitAbility.CONFUSION_LEVEL_1],
        maxUses: { [UnitUse.TACTIC]: 1 },
        character: { name: "Field Staff", martial: 30, intelligence: 90 }
      },
      { id: "target", army: "PLAYER", position: { x: 1, y: 0 } }
    ],
    aiConfig: { adviserUnitIds: ["actor"] }
  });
  const { service, battleRandom } = createService(stage, 1);
  const expectedRandom = new BattleRandom(1);
  expectedRandom.next();
  const before = createStageDigest(stage);

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.request.type, ActionType.CONFUSION_LV1);
  assert.equal(createStageDigest(stage), before);
  assert.deepEqual(battleRandom.exportState(), expectedRandom.exportState());
});

test("A failed strategy use roll falls through to normal attack", () => {
  const stage = createServiceStage({
    id: "ai_strategy_fallback",
    map: [["plain", "plain"]],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 0 },
        abilities: [UnitAbility.CONFUSION_LEVEL_1],
        maxUses: { [UnitUse.TACTIC]: 1 },
        character: { martial: 90, intelligence: 40 }
      },
      { id: "target", army: "PLAYER", position: { x: 1, y: 0 } }
    ]
  });
  const { service, battleRandom } = createService(stage, 15872);
  const expectedRandom = new BattleRandom(15872);
  expectedRandom.next();

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.request.type, ActionType.NORMAL_ATTACK);
  assert.deepEqual(battleRandom.exportState(), expectedRandom.exportState());
});

test("Wide illusion is enabled only while its suppressor is absent or distant", () => {
  const createStage = (suppressorX) => createServiceStage({
    id: `ai_wide_${suppressorX}`,
    map: [["plain", "plain", "plain", "plain", "plain"]],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 0 },
        move: 0,
        abilities: [UnitAbility.ILLUSION, UnitAbility.WIDE_ILLUSION],
        maxUses: { [UnitUse.TACTIC]: 1 }
      },
      { id: "target", army: "PLAYER", position: { x: 2, y: 0 } },
      { id: "suppressor", army: "ENEMY", position: { x: suppressorX, y: 0 } }
    ],
    aiConfig: {
      wideIllusionRules: [{
        actorUnitId: "actor",
        suppressorUnitId: "suppressor",
        suppressionRange: 3
      }]
    }
  });
  const distantStage = createStage(4);
  const nearbyStage = createStage(1);

  const distantPlan = createService(distantStage).service.planEnemyTurn(
    distantStage.getUnit("actor"),
    distantStage
  );
  const nearbyPlan = createService(nearbyStage).service.planEnemyTurn(
    nearbyStage.getUnit("actor"),
    nearbyStage
  );

  assert.equal(distantPlan.request.type, ActionType.WIDE_ILLUSION);
  assert.equal(nearbyPlan.request.type, ActionType.ILLUSION);
});

test("Cautious elemental AI rejects a dangerous allied hit", () => {
  const stage = createServiceStage({
    id: "ai_cautious_fire",
    map: [
      ["plain", "plain", "plain", "plain", "plain"],
      ["plain", "plain", "plain", "plain", "plain"],
      ["plain", "plain", "plain", "plain", "plain"]
    ],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 1 },
        move: 0,
        abilities: [
          UnitAbility.FIRE_TACTIC,
          UnitAbility.ELEMENTAL_TACTIC_DAMAGE_75_PERCENT
        ],
        maxUses: { [UnitUse.TACTIC]: 1 }
      },
      { id: "unsafe_center", army: "PLAYER", position: { x: 2, y: 1 } },
      { id: "safe_center", army: "PLAYER", position: { x: 3, y: 1 } },
      {
        id: "fragile_ally",
        army: "ENEMY",
        position: { x: 2, y: 2 },
        troops: 10
      }
    ],
    aiConfig: { cautiousElementalUnitIds: ["actor"] }
  });
  const { service } = createService(stage);

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.request.type, ActionType.FIRE);
  assert.equal(plan.request.target, stage.getUnit("safe_center"));
});

test("Illusion forced action uses cost, troops and Unit order without RNG", () => {
  const stage = createServiceStage({
    id: "ai_forced_illusion",
    map: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"]
    ],
    units: [
      { id: "actor", army: "ENEMY", position: { x: 0, y: 1 }, move: 3 },
      {
        id: "higher_troops",
        army: "ENEMY",
        position: { x: 2, y: 1 },
        troops: 100
      },
      {
        id: "lower_troops",
        army: "ENEMY",
        position: { x: 0, y: 3 },
        troops: 40
      }
    ]
  });
  const { service, battleRandom } = createService(stage);
  const randomBefore = battleRandom.exportState();
  const actor = stage.getUnit("actor");
  const facingBefore = actor.facing;

  const plan = service.planIllusionAction(actor, stage);

  assert.equal(plan.request.type, ForcedActionType.ILLUSION_ATTACK);
  assert.equal(plan.request.target, stage.getUnit("lower_troops"));
  assert.deepEqual(pathCoordinates(plan.selectedPath), [[0, 2]]);
  assert.equal(actor.facing, facingBefore);
  assert.deepEqual(battleRandom.exportState(), randomBefore);
});

test("Illusion wait changes neither facing nor RNG", () => {
  const stage = createServiceStage({
    id: "ai_forced_wait",
    map: [["plain", "plain", "plain"]],
    units: [
      { id: "actor", army: "ENEMY", position: { x: 0, y: 0 }, move: 0 },
      { id: "ally", army: "ENEMY", position: { x: 2, y: 0 } }
    ]
  });
  const { service, battleRandom } = createService(stage);
  const randomBefore = battleRandom.exportState();
  const actor = stage.getUnit("actor");
  const facingBefore = actor.facing;

  const plan = service.planIllusionAction(actor, stage);

  assert.equal(plan.request.type, ForcedActionType.ILLUSION_WAIT);
  assert.deepEqual(plan.selectedPath, []);
  assert.equal(actor.facing, facingBefore);
  assert.deepEqual(battleRandom.exportState(), randomBefore);
});

test("Target priority rule redirects movement and can disable strategy", () => {
  const stage = createServiceStage({
    id: "ai_target_priority",
    map: [
      ["plain", "plain", "plain", "plain", "plain"],
      ["plain", "plain", "plain", "plain", "plain"],
      ["plain", "plain", "plain", "plain", "plain"]
    ],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 1 },
        move: 3,
        abilities: [UnitAbility.CONFUSION_LEVEL_1],
        maxUses: { [UnitUse.TACTIC]: 1 }
      },
      { id: "near_target", army: "PLAYER", position: { x: 0, y: 2 } },
      { id: "priority_target", army: "PLAYER", position: { x: 4, y: 1 } }
    ],
    aiConfig: {
      targetPriorityRules: [{
        actorUnitIds: ["actor"],
        targetUnitIds: ["priority_target"],
        disableStrategy: true
      }]
    }
  });
  const { service, battleRandom } = createService(stage);
  const randomBefore = battleRandom.exportState();

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.request.type, ActionType.NORMAL_ATTACK);
  assert.equal(plan.request.target, stage.getUnit("priority_target"));
  assert.deepEqual(pathCoordinates(plan.selectedPath), [[1, 1], [2, 1], [3, 1]]);
  assert.deepEqual(battleRandom.exportState(), randomBefore);
});

test("Pursuit units act before normal enemies in the v9 Stage order", () => {
  const stage = createServiceStage({
    id: "ai_pursuit_order",
    map: Array.from({ length: 5 }, () => (
      ["plain", "plain", "plain", "plain", "plain"]
    )),
    units: [
      { id: "normal", army: "ENEMY", position: { x: 0, y: 0 } },
      { id: "pursuit_inner", army: "ENEMY", position: { x: 3, y: 1 } },
      { id: "pursuit_outer", army: "ENEMY", position: { x: 0, y: 3 } },
      { id: "target", army: "PLAYER", position: { x: 4, y: 4 } }
    ],
    aiConfig: {
      pursuitRules: [{
        unitIds: ["pursuit_inner", "pursuit_outer"],
        gateColumns: [2, 3],
        insideMaximumRow: 3,
        outsideRow: 4,
        candidateMinimumRow: 1
      }]
    }
  });
  const { service } = createService(stage);

  assert.equal(service.selectNextEnemyUnit(stage), stage.getUnit("pursuit_outer"));
});

test("A pursuit unit uses only normal attack after moving", () => {
  const stage = createServiceStage({
    id: "ai_pursuit_move",
    map: Array.from({ length: 5 }, () => (
      ["plain", "plain", "plain", "plain", "plain"]
    )),
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 4 },
        move: 3,
        abilities: [UnitAbility.CHARGE],
        maxUses: { [UnitUse.CHARGE]: 1 }
      },
      { id: "target", army: "PLAYER", position: { x: 4, y: 4 } }
    ],
    aiConfig: {
      pursuitRules: [{
        unitIds: ["actor"],
        gateColumns: [1, 2],
        insideMaximumRow: 3,
        outsideRow: 4,
        candidateMinimumRow: 1
      }]
    }
  });
  const { service } = createService(stage);

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.request.type, ActionType.NORMAL_ATTACK);
  assert.deepEqual(pathCoordinates(plan.selectedPath), [[1, 4], [2, 4], [3, 4]]);
});

test("A blocked pursuit unit uses an available strategy without a use-rate roll", () => {
  const stage = createServiceStage({
    id: "ai_pursuit_fallback",
    map: [
      ["plain", "plain", "plain"],
      ["plain", "plain", "plain"]
    ],
    units: [
      {
        id: "actor",
        army: "ENEMY",
        position: { x: 0, y: 1 },
        move: 0,
        abilities: [UnitAbility.CONFUSION_LEVEL_1],
        maxUses: { [UnitUse.TACTIC]: 1 }
      },
      { id: "target", army: "PLAYER", position: { x: 2, y: 1 } }
    ],
    aiConfig: {
      pursuitRules: [{
        unitIds: ["actor"],
        gateColumns: [0, 1],
        insideMaximumRow: 0,
        outsideRow: 1,
        candidateMinimumRow: 0
      }]
    }
  });
  const { service, battleRandom } = createService(stage, 15872);
  const randomBefore = battleRandom.exportState();

  const plan = service.planEnemyTurn(stage.getUnit("actor"), stage);

  assert.equal(plan.request.type, ActionType.CONFUSION_LV1);
  assert.deepEqual(battleRandom.exportState(), randomBefore);
});
