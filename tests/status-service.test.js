import test from "node:test";
import assert from "node:assert/strict";

import { UnitStatus } from "../src/domain/unit.js";
import {
  PhaseStartStatusResult,
  StatusService
} from "../src/services/status-service.js";
import { createServiceStage } from "../test-support/service-fixtures.js";

function createTestUnit() {
  const stage = createServiceStage({
    id: "status_service_test",
    units: [
      { id: "actor", army: "PLAYER", position: { x: 0, y: 0 } },
      { id: "target", army: "ENEMY", position: { x: 4, y: 2 } }
    ]
  });
  return stage.getUnit("actor");
}

test("StatusService returns NONE without changing an unaffected Unit", () => {
  const unit = createTestUnit();
  const service = new StatusService();

  assert.equal(service.processPhaseStart(unit), PhaseStartStatusResult.NONE);
  assert.deepEqual(unit.statusEffects, []);
});

test("StatusService consumes the final confusion turn after it skips the phase", () => {
  const unit = createTestUnit();
  const service = new StatusService();
  unit.setStatus(UnitStatus.CONFUSED, 1);

  assert.equal(
    service.processPhaseStart(unit),
    PhaseStartStatusResult.CONFUSION_SKIP
  );
  assert.equal(unit.getStatusTurns(UnitStatus.CONFUSED), 0);
});

test("StatusService decrements both statuses and gives ILLUSION priority", () => {
  const unit = createTestUnit();
  const service = new StatusService();
  unit.setStatus(UnitStatus.CONFUSED, 2);
  unit.setStatus(UnitStatus.ILLUSION, 1);

  assert.equal(service.processPhaseStart(unit), PhaseStartStatusResult.ILLUSION);
  assert.equal(unit.getStatusTurns(UnitStatus.CONFUSED), 1);
  assert.equal(unit.getStatusTurns(UnitStatus.ILLUSION), 0);
  assert.equal(
    service.processPhaseStart(unit),
    PhaseStartStatusResult.CONFUSION_SKIP
  );
  assert.equal(unit.getStatusTurns(UnitStatus.CONFUSED), 0);
});
