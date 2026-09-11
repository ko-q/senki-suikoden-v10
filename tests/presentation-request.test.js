import test from "node:test";
import assert from "node:assert/strict";

import {
  createNoticePresentationRequest,
  createSemanticPresentationRequest,
  PresentationRequestType
} from "../src/core/presentation-request.js";

test("NOTICE PresentationRequest keeps only an immutable data snapshot", () => {
  const source = { count: 2, units: ["unit_a", "unit_b"] };
  const request = createNoticePresentationRequest("notice.reinforcement", source);

  source.units.push("unit_c");

  assert.deepEqual(request.parameters, { count: 2, units: ["unit_a", "unit_b"] });
  assert.equal(Object.isFrozen(request.parameters), true);
  assert.equal(Object.isFrozen(request.parameters.units), true);
});

test("NOTICE PresentationRequest rejects functions and runtime objects", () => {
  assert.throws(
    () => createNoticePresentationRequest("notice.invalid", { callback: () => true }),
    { code: "PRESENTATION_NOTICE_PARAMETER_INVALID" }
  );
  assert.throws(
    () => createNoticePresentationRequest("notice.invalid", { runtime: new Date() }),
    { code: "PRESENTATION_NOTICE_PARAMETER_INVALID" }
  );
});

test("semantic PresentationRequest keeps a deeply immutable data snapshot", () => {
  const source = {
    unitId: "unit_a",
    entries: [{ damage: 20, position: { x: 1, y: 2 } }]
  };
  const request = createSemanticPresentationRequest(
    PresentationRequestType.DAMAGE,
    source
  );

  source.entries[0].damage = 99;
  source.entries.push({ damage: 10, position: { x: 2, y: 2 } });

  assert.deepEqual(request, {
    type: PresentationRequestType.DAMAGE,
    payload: {
      unitId: "unit_a",
      entries: [{ damage: 20, position: { x: 1, y: 2 } }]
    }
  });
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.payload), true);
  assert.equal(Object.isFrozen(request.payload.entries), true);
  assert.equal(Object.isFrozen(request.payload.entries[0]), true);
  assert.equal(Object.isFrozen(request.payload.entries[0].position), true);
});

test("semantic PresentationRequest rejects UI callbacks and runtime objects", () => {
  assert.throws(
    () => createSemanticPresentationRequest(
      PresentationRequestType.ACTION,
      { callback: () => true }
    ),
    { code: "PRESENTATION_NOTICE_PARAMETER_INVALID" }
  );
  assert.throws(
    () => createSemanticPresentationRequest(
      PresentationRequestType.MOVE,
      { runtime: new AbortController() }
    ),
    { code: "PRESENTATION_NOTICE_PARAMETER_INVALID" }
  );
  assert.throws(
    () => createSemanticPresentationRequest(PresentationRequestType.NOTICE, {}),
    { code: "PRESENTATION_SEMANTIC_TYPE_INVALID" }
  );
});
