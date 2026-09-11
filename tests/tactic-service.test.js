import test from "node:test";
import assert from "node:assert/strict";

import { createActionQueryContext } from "../src/core/action-query-context.js";
import { ActionType, createActionRequest } from "../src/core/action-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { UnitStatus } from "../src/domain/unit.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import { TacticService } from "../src/services/tactic-service.js";
import { createStageDigest } from "../test-support/fixtures.js";
import {
  Affiliation,
  Facing,
  createServiceStage
} from "../test-support/service-fixtures.js";

test("TacticService preserves the v9.7.75 intelligence difference LUT", () => {
  const service = new TacticService();

  assert.equal(service.strategySuccessChance(50, 50), 20);
  assert.equal(service.strategySuccessChance(100, 50), 98);
  assert.equal(service.strategySuccessChance(50, 100), 3);
  assert.equal(service.strategySuccessChance(100, 0), 98);
  assert.equal(service.strategySuccessChance(0, 100), 3);
});

test("Confusion Lv2 resolves targets in Unit order and keeps ILLUSION independently", () => {
  const stage = createServiceStage({
    id: "confusion_area",
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        facing: Facing.NORTH,
        abilities: [UnitAbility.CONFUSION_LEVEL_2],
        maxUses: { [UnitUse.TACTIC]: 3 }
      },
      {
        id: "center",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 1 },
        facing: Facing.WEST,
        statusEffects: [{ type: UnitStatus.ILLUSION, remainingTurns: 2 }]
      },
      {
        id: "adjacent",
        army: Affiliation.ENEMY,
        position: { x: 3, y: 1 },
        facing: Facing.EAST
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const center = stage.getUnit("center");
  const adjacent = stage.getUnit("adjacent");
  const service = new TacticService();
  const request = createActionRequest(ActionType.CONFUSION_LV2, actor, center);
  const queryContext = createActionQueryContext(actor, stage.map.getPosition(actor));
  const digestBeforeQuery = createStageDigest(stage);

  assert.deepEqual(
    service.inspectTargets(ActionType.CONFUSION_LV2, queryContext, stage).map((unit) => unit.id),
    ["center", "adjacent"]
  );
  assert.deepEqual(
    service.estimate(request, stage).targets.map((estimate) => estimate.successChance),
    [20, 20]
  );
  assert.equal(createStageDigest(stage), digestBeforeQuery);

  const result = service.execute(request, stage, new BattleRandom(1));

  assert.deepEqual(result.targetResults.map((item) => item.unit.id), ["center", "adjacent"]);
  assert.equal(result.targetResults[0].effectTurns, 2);
  assert.equal(result.targetResults[1].effectTurns, 1);
  assert.deepEqual(result.successfulTargets, [center, adjacent]);
  assert.deepEqual(result.use, {
    id: UnitUse.TACTIC,
    cost: 2,
    before: 3,
    after: 1
  });
  assert.equal(center.getStatusTurns(UnitStatus.CONFUSED), 2);
  assert.equal(center.getStatusTurns(UnitStatus.ILLUSION), 2);
  assert.equal(center.facing, Facing.SOUTH);
  assert.equal(adjacent.getStatusTurns(UnitStatus.CONFUSED), 1);
  assert.equal(adjacent.facing, Facing.NORTH);
  assert.equal(actor.facing, Facing.EAST);
});

test("Illusion adds its status without deleting existing CONFUSED", () => {
  const stage = createServiceStage({
    id: "independent_illusion",
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        abilities: [UnitAbility.ILLUSION],
        maxUses: { [UnitUse.TACTIC]: 2 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 1 },
        facing: Facing.WEST,
        statusEffects: [{ type: UnitStatus.CONFUSED, remainingTurns: 2 }]
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const result = new TacticService().execute(
    createActionRequest(ActionType.ILLUSION, actor, target),
    stage,
    new BattleRandom(1)
  );

  assert.equal(result.targetResults[0].success, true);
  assert.equal(result.targetResults[0].effectTurns, 2);
  assert.equal(target.getStatusTurns(UnitStatus.CONFUSED), 2);
  assert.equal(target.getStatusTurns(UnitStatus.ILLUSION), 2);
  assert.equal(target.facing, Facing.WEST);
  assert.equal(actor.remainingUses[UnitUse.TACTIC], 1);
});

test("TacticService rejects insufficient uses without changing Domain or RNG", () => {
  const stage = createServiceStage({
    id: "invalid_tactic_use",
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        abilities: [UnitAbility.CONFUSION_LEVEL_3],
        maxUses: { [UnitUse.TACTIC]: 2 }
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
  const service = new TacticService();
  const request = createActionRequest(ActionType.CONFUSION_LV3, actor, target);
  const random = new BattleRandom(12);
  const domainBefore = createStageDigest(stage);
  const randomBefore = random.exportState();

  assert.equal(service.canExecute(request, stage), false);
  assert.equal(service.estimate(request, stage), null);
  assert.throws(
    () => service.execute(request, stage, random),
    { code: "TACTIC_ACTION_INVALID" }
  );
  assert.equal(createStageDigest(stage), domainBefore);
  assert.deepEqual(random.exportState(), randomBefore);
});

test("Fire tactic applies area damage and status in one synchronous result", () => {
  const stage = createServiceStage({
    id: "fire_area",
    map: [
      ["plain", "plain", "plain", "plain"],
      ["plain", "road", "forest", "plain"],
      ["plain", "plain", "plain", "plain"]
    ],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 1 },
        facing: Facing.NORTH,
        abilities: [
          UnitAbility.FIRE_TACTIC,
          UnitAbility.ELEMENTAL_TACTIC_DAMAGE_75_PERCENT
        ],
        maxUses: { [UnitUse.TACTIC]: 2 }
      },
      {
        id: "ally",
        army: Affiliation.PLAYER,
        position: { x: 1, y: 1 },
        troops: 40
      },
      {
        id: "center",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 1 },
        maxTroops: 200,
        troops: 200,
        facing: Facing.WEST,
        statusEffects: [{ type: UnitStatus.ILLUSION, remainingTurns: 1 }]
      },
      {
        id: "adjacent",
        army: Affiliation.ENEMY,
        position: { x: 2, y: 0 }
      },
      {
        id: "far",
        army: Affiliation.ENEMY,
        position: { x: 3, y: 2 }
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const ally = stage.getUnit("ally");
  const center = stage.getUnit("center");
  const adjacent = stage.getUnit("adjacent");
  const far = stage.getUnit("far");
  const service = new TacticService();
  const request = createActionRequest(ActionType.FIRE, actor, center);
  const domainBeforeEstimate = createStageDigest(stage);
  const estimate = service.estimate(request, stage);

  assert.deepEqual(
    estimate.targets.map((item) => [item.unit.id, item.damage]),
    [["ally", 47], ["center", 95], ["adjacent", 52]]
  );
  assert.equal(estimate.confusionChance, 10);
  assert.equal(createStageDigest(stage), domainBeforeEstimate);

  const result = service.execute(request, stage, new BattleRandom(1));

  assert.deepEqual(
    result.targetResults.map((item) => [item.unit.id, item.damage]),
    [["ally", 47], ["center", 95], ["adjacent", 52]]
  );
  assert.equal(ally.troops, 0);
  assert.equal(center.troops, 105);
  assert.equal(adjacent.troops, 73);
  assert.equal(far.troops, 125);
  assert.deepEqual(result.defeatedUnits, [ally]);
  assert.equal(result.confusion.success, true);
  assert.equal(center.getStatusTurns(UnitStatus.CONFUSED), 1);
  assert.equal(center.getStatusTurns(UnitStatus.ILLUSION), 1);
  assert.equal(center.facing, Facing.NORTH);
  assert.equal(actor.facing, Facing.EAST);
  assert.equal(actor.remainingUses[UnitUse.TACTIC], 1);

  // ServiceはMapを変更しないため、敗走同期はControllerが最初のawait前に行う。
  assert.notEqual(stage.map.getPosition(ally), null);
  stage.map.removeUnit(ally);
  assert.equal(stage.validateRuntime(), true);
});

test("Water tactic stacks road and adjacent-water terrain modifiers", () => {
  const stage = createServiceStage({
    id: "water_terrain",
    map: [
      ["plain", "water", "plain"],
      ["plain", "road", "plain"],
      ["plain", "plain", "plain"]
    ],
    units: [
      {
        id: "actor",
        army: Affiliation.PLAYER,
        position: { x: 0, y: 2 },
        abilities: [UnitAbility.WATER_TACTIC],
        maxUses: { [UnitUse.TACTIC]: 1 }
      },
      {
        id: "target",
        army: Affiliation.ENEMY,
        position: { x: 1, y: 1 },
        maxTroops: 200
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const estimate = new TacticService().estimate(
    createActionRequest(ActionType.WATER, actor, target),
    stage
  );

  assert.equal(estimate.targets[0].centerDamage, 95);
  assert.equal(estimate.targets[0].terrainRate, 1.1);
  assert.equal(estimate.targets[0].damage, 105);
});

test("Wide illusion uses no tactic count and keeps the actor facing", () => {
  const stage = createServiceStage({
    id: "wide_illusion",
    units: [
      {
        id: "actor",
        army: Affiliation.ENEMY,
        position: { x: 0, y: 1 },
        facing: Facing.SOUTH,
        abilities: [UnitAbility.ILLUSION, UnitAbility.WIDE_ILLUSION]
      },
      {
        id: "target",
        army: Affiliation.PLAYER,
        position: { x: 2, y: 1 }
      },
      {
        id: "far",
        army: Affiliation.PLAYER,
        position: { x: 4, y: 1 }
      }
    ]
  });
  const actor = stage.getUnit("actor");
  const target = stage.getUnit("target");
  const far = stage.getUnit("far");
  const request = createActionRequest(ActionType.WIDE_ILLUSION, actor, actor);
  const result = new TacticService().execute(request, stage, new BattleRandom(1));

  assert.equal(result.use, null);
  assert.deepEqual(result.targetResults.map((item) => item.unit), [target]);
  assert.equal(target.getStatusTurns(UnitStatus.ILLUSION), 2);
  assert.equal(far.getStatusTurns(UnitStatus.ILLUSION), 0);
  assert.equal(actor.facing, Facing.SOUTH);
});
