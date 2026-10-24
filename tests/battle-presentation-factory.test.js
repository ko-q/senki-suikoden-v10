import test from "node:test";
import assert from "node:assert/strict";
import { BattlePresentationFactory } from "../src/factories/battle-presentation-factory.js";
import { CombatService } from "../src/services/combat-service.js";
import { createActionRequest } from "../src/core/action-request.js";
import { validatePresentationRequest } from "../src/core/presentation-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { createServiceStage } from "../test-support/service-fixtures.js";

function runtime() {
  const stage = createServiceStage({ units: [
    { id: "actor", army: "PLAYER", position: { x: 0, y: 0 } },
    { id: "target", position: { x: 1, y: 0 }, troops: 1 }
  ] });
  return { stage, factory: new BattlePresentationFactory(stage), random: new BattleRandom(1),
    actor: stage.getUnit("actor"), target: stage.getUnit("target") };
}

test("presentation factory preserves defeated target positions and owns no battle mutation", () => {
  const { stage, factory, random, actor, target } = runtime();
  const action = factory.action("NORMAL_ATTACK", actor, target, false);
  const result = new CombatService().execute(createActionRequest("NORMAL_ATTACK", actor, target), stage, random);
  assert.equal(result.defeated, true);
  stage.map.removeUnit(target);
  const before = createBattleSaveData(stage, random);
  const requests = factory.actionResult(actor, "NORMAL_ATTACK", result);
  assert.deepEqual(createBattleSaveData(stage, random), before);
  assert.deepEqual(requests.map(request => request.type), ["DAMAGE"]);
  assert.equal(requests[0].payload.entries[0].unitId, "target");
  assert.deepEqual(requests[0].payload.entries[0].position, { x: 1, y: 0 });
  assert.equal(requests[0].payload.entries[0].afterTroops, 0);
  assert.equal(requests[0].payload.entries[0].defeated, true);
  assert.equal(action.payload.targetId, "target");
  stage.map.moveUnit(actor, { x: 0, y: 1 });
  assert.deepEqual(action.payload.actorPosition, { x: 0, y: 0 });
  assert.equal(Object.isFrozen(requests), true);
  assert.equal(Object.isFrozen(requests[0].payload.entries[0]), true);
  requests.forEach(validatePresentationRequest);
});

test("trap presentation retains trap, damage, status order and snapshots nested effects", () => {
  const { stage, factory, random, actor } = runtime();
  const before = createBattleSaveData(stage, random);
  const result = { unit: actor, trap: { id: "trap_a", kind: "normal", position: { x: 0, y: 0 } },
    neutralized: false, damage: 20, beforeTroops: 125, afterTroops: 105, defeated: false,
    statusChange: { type: "CONFUSED", beforeTurns: 0, afterTurns: 1 } };
  const requests = factory.trapResult(result);
  assert.deepEqual(requests.map(request => request.type), ["TRAP", "DAMAGE", "STATUS"]);
  assert.deepEqual(createBattleSaveData(stage, random), before);
  result.trap.position.x = 4;
  result.statusChange.afterTurns = 3;
  assert.deepEqual(requests[1].payload.entries[0].position, { x: 0, y: 0 });
  assert.equal(requests[2].payload.statusChange.afterTurns, 1);
  const immune = factory.trapResult({ ...result, neutralized: true, damage: 0, afterTroops: 125, statusChange: null });
  assert.deepEqual(immune.map(request => request.type), ["TRAP"]);
  const defeated = factory.trapResult({ ...result, defeated: true, afterTroops: 0, statusChange: null });
  assert.deepEqual(defeated.map(request => request.type), ["TRAP", "DAMAGE"]);
  [...requests, ...immune, ...defeated].forEach(validatePresentationRequest);
});
