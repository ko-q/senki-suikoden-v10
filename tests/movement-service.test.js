import test from "node:test";
import assert from "node:assert/strict";

import { Position } from "../src/domain/position.js";
import { UnitAbility } from "../src/domain/terrain.js";
import { MovementService } from "../src/services/movement-service.js";
import { createStage, createStageDigest } from "../test-support/fixtures.js";

function pathKeys(path) {
  return path.map((position) => position.toKey());
}

test("Movement query is deterministic, returns at most three paths and changes no Domain state", () => {
  const stage = createStage({
    id: "path_test",
    enemyPosition: { x: 2, y: 0 },
    playerMove: 6
  });
  const unit = stage.getUnit("path_test_player");
  const service = new MovementService();
  const before = createStageDigest(stage);

  const first = service.getCandidatePaths(unit, new Position(2, 1), stage);
  const second = service.getCandidatePaths(unit, new Position(2, 1), stage);

  assert.equal(first.length, 3);
  assert.deepEqual(first.map(pathKeys), second.map(pathKeys));
  assert.deepEqual(pathKeys(first[0]), ["1,1", "2,1"]);
  assert.equal(createStageDigest(stage), before);
  assert.deepEqual(stage.map.getPosition(unit), new Position(0, 1));
});

test("An adjacent destination exposes only its direct one-step path", () => {
  const stage = createStage({ id: "adjacent_test", enemyPosition: { x: 2, y: 2 } });
  const unit = stage.getUnit("adjacent_test_player");
  const service = new MovementService();

  const paths = service.getCandidatePaths(unit, new Position(1, 1), stage);

  assert.equal(paths.length, 1);
  assert.deepEqual(pathKeys(paths[0]), ["1,1"]);
});

test("Path validation rejects occupied cells, revisits and allowance overflow", () => {
  const stage = createStage({ id: "validation_test", playerMove: 2 });
  const unit = stage.getUnit("validation_test_player");
  const service = new MovementService();

  assert.deepEqual(
    service.validatePath(unit, [new Position(1, 1), new Position(2, 1)], stage),
    { valid: false, cost: 1, reason: "PATH_CELL_BLOCKED" }
  );
  assert.deepEqual(
    service.validatePath(
      unit,
      [new Position(1, 1), new Position(1, 0), new Position(0, 0), new Position(0, 1)],
      stage
    ),
    { valid: false, cost: 3, reason: "PATH_ALLOWANCE_EXCEEDED" }
  );

  const revisitStage = createStage({
    id: "revisit_test",
    enemyPosition: { x: 2, y: 2 },
    playerMove: 6
  });
  const revisitUnit = revisitStage.getUnit("revisit_test_player");
  assert.deepEqual(
    service.validatePath(
      revisitUnit,
      [new Position(1, 1), new Position(1, 0), new Position(0, 0), new Position(0, 1)],
      revisitStage
    ),
    { valid: false, cost: 3, reason: "PATH_REVISITS_CELL" }
  );
});

test("Reachability uses v9-compatible terrain costs and ability overrides", () => {
  const map = [
    ["plain", "water", "plain"],
    ["plain", "swamp", "plain"],
    ["plain", "plain", "plain"]
  ];
  const ordinaryStage = createStage({
    id: "ordinary_terrain",
    map,
    playerPosition: { x: 0, y: 0 },
    enemyPosition: { x: 2, y: 2 },
    playerMove: 3
  });
  const waterStage = createStage({
    id: "water_terrain",
    map,
    playerPosition: { x: 0, y: 0 },
    enemyPosition: { x: 2, y: 2 },
    playerMove: 3,
    playerAbilities: [UnitAbility.WATER_TERRAIN_AFFINITY]
  });
  const service = new MovementService();

  const ordinaryReachable = new Map(
    service.getReachableCells(ordinaryStage.getUnit("ordinary_terrain_player"), ordinaryStage)
      .map((entry) => [entry.position.toKey(), entry.cost])
  );
  const waterReachable = new Map(
    service.getReachableCells(waterStage.getUnit("water_terrain_player"), waterStage)
      .map((entry) => [entry.position.toKey(), entry.cost])
  );

  assert.equal(ordinaryReachable.has("1,0"), false);
  assert.equal(ordinaryReachable.get("1,1"), undefined);
  assert.equal(waterReachable.get("1,0"), 1);
  assert.equal(waterReachable.get("1,1"), 2);
});

test("Destination equal to origin is represented by one empty path", () => {
  const stage = createStage({ id: "origin_test" });
  const unit = stage.getUnit("origin_test_player");
  const service = new MovementService();

  const paths = service.getCandidatePaths(unit, stage.map.getPosition(unit), stage);

  assert.equal(paths.length, 1);
  assert.deepEqual(paths[0], []);
});
