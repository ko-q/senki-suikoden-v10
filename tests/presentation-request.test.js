import test from "node:test";
import assert from "node:assert/strict";

import {
  createNoticePresentationRequest,
  createSemanticPresentationRequest,
  PresentationRequestType,
  validatePresentationRequest,
  normalizePresentationRequests
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
    operationType: "NORMAL_ATTACK", actorId: "actor",
    entries: [{ unitId: "unit_a", damage: 20, position: { x: 1, y: 2 },
      beforeTroops: 100, afterTroops: 80, defeated: false }]
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
      operationType: "NORMAL_ATTACK", actorId: "actor",
      entries: [{ unitId: "unit_a", damage: 20, position: { x: 1, y: 2 },
        beforeTroops: 100, afterTroops: 80, defeated: false }]
    }
  });
  assert.equal(Object.isFrozen(request), true);
  assert.equal(Object.isFrozen(request.payload), true);
  assert.equal(Object.isFrozen(request.payload.entries), true);
  assert.equal(Object.isFrozen(request.payload.entries[0]), true);
  assert.equal(Object.isFrozen(request.payload.entries[0].position), true);
});

const semanticPayloads = {
  UNIT_FOCUS: { unitId: "actor" },
  MOVE: { unitId: "actor", from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
  ACTION: { actionType: "NORMAL_ATTACK", actorId: "actor", targetId: "target",
    actorPosition: { x: 0, y: 1 }, targetPosition: { x: 1, y: 1 },
    actorAffiliation: "PLAYER", actorIsMob: false, forced: false },
  DAMAGE: { operationType: "NORMAL_ATTACK", actorId: "actor", entries: [
    { unitId: "target", position: { x: 1, y: 1 }, damage: 20,
      beforeTroops: 100, afterTroops: 80, defeated: false }
  ] },
  STATUS: { reason: "CONFUSION_LV1", actorId: "actor", entries: [
    { unitId: "target", position: { x: 1, y: 1 }, before: [],
      after: [{ type: "CONFUSED", remainingTurns: 1 }], effectTurns: 1 }
  ] },
  TRAP: { trapId: "trap_a", trapKind: "normal", unitId: "actor", neutralized: false,
    damage: 20, beforeTroops: 100, afterTroops: 80, defeated: false,
    statusChange: { type: "CONFUSED", beforeTurns: 0, afterTurns: 1 } },
  PHASE: { turn: 1, phase: "PLAYER" },
  BATTLE_RESULT: { stageId: "stage_a", objectiveId: "escape", outcome: "VICTORY", turn: 6, phase: "PLAYER" },
  MISSION_BRIEFING: { victory: "史進が脱出", defeat: "史進が敗走" },
  CONFIRM: { messageKey: "turn.end" }
};

for (const [type, payload] of Object.entries(semanticPayloads)) {
  test(`${type} checks required fields at creation, reception and definition normalization`, () => {
    const request = createSemanticPresentationRequest(type, payload);
    assert.equal(validatePresentationRequest(request), request);
    assert.deepEqual(normalizePresentationRequests([request]), [request]);
    for (const key of Object.keys(payload)) {
      const missing = structuredClone(payload);
      delete missing[key];
      const invalid = { type, payload: missing };
      const expected = { code: "PRESENTATION_PAYLOAD_INVALID" };
      assert.throws(() => createSemanticPresentationRequest(type, missing), expected, key);
      assert.throws(() => validatePresentationRequest(invalid), expected, key);
      assert.throws(() => normalizePresentationRequests([invalid]), expected, key);
    }
  });
}

test("presentation contracts reject malformed nested values and invalid enum values", () => {
  const invalid = [
    ["MOVE", { ...semanticPayloads.MOVE, to: { x: 1.5, y: 1 } }],
    ["MOVE", { ...semanticPayloads.MOVE, from: { x: -1, y: 1 } }],
    ["UNIT_FOCUS", { unitId: "" }],
    ["ACTION", { ...semanticPayloads.ACTION, actionType: "TYPO" }],
    ["ACTION", { ...semanticPayloads.ACTION, forced: "false" }],
    ["ACTION", { ...semanticPayloads.ACTION, targetId: null, targetPosition: null }],
    ["DAMAGE", { ...semanticPayloads.DAMAGE, entries: [{ damage: 20 }] }],
    ["STATUS", { ...semanticPayloads.STATUS, entries: [{ ...semanticPayloads.STATUS.entries[0], after: [{ type: "TYPO", remainingTurns: 1 }] }] }],
    ["PHASE", { turn: 0, phase: "PLAYER" }],
    ["PHASE", { turn: 1, phase: "TYPO" }],
    ["TRAP", { ...semanticPayloads.TRAP, statusChange: { type: "CONFUSED", beforeTurns: 0, afterTurns: -1 } }],
    ["BATTLE_RESULT", { ...semanticPayloads.BATTLE_RESULT, outcome: "TYPO" }]
  ];
  for (const [type, payload] of invalid) {
    assert.throws(() => createSemanticPresentationRequest(type, payload), { code: "PRESENTATION_PAYLOAD_INVALID" }, type);
  }
});

test("phase status, trap status and targetless wait retain distinct valid contracts", () => {
  const variants = [
    ["STATUS", { reason: "PHASE_START", unitId: "actor", position: { x: 0, y: 1 }, statusResult: "CONFUSION_SKIP", statusEffects: [] }],
    ["STATUS", { reason: "TRAP", unitId: "actor", position: { x: 0, y: 1 }, statusChange: semanticPayloads.TRAP.statusChange }],
    ["ACTION", { ...semanticPayloads.ACTION, actionType: "WAIT", targetId: null, targetPosition: null }],
    ["ACTION", { ...semanticPayloads.ACTION, actionType: "ILLUSION_WAIT", targetId: null, targetPosition: null, forced: true }],
    ["TRAP", { ...semanticPayloads.TRAP, trapKind: "spell", neutralized: true, damage: 0, afterTroops: 100, statusChange: null }],
    ["DAMAGE", { ...semanticPayloads.DAMAGE, operationType: "TRAP", actorId: null }]
  ];
  for (const [type, payload] of variants) {
    const request = createSemanticPresentationRequest(type, payload);
    assert.deepEqual(request.payload, payload);
    assert.equal(validatePresentationRequest(request), request);
  }
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
