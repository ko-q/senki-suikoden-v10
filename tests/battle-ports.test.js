import test from "node:test";
import assert from "node:assert/strict";

import {
  NullBattleCheckpointPort,
  NullBattlePresentationPort,
  requireBattleCommandPort,
  requireBattleCheckpointPort,
  requireBattlePresentationPort
} from "../src/boundary/battle-ports.js";
import {
  createSemanticPresentationRequest,
  PresentationRequestType
} from "../src/core/presentation-request.js";

test("Battle Port contracts accept structural adapters and reject missing methods", () => {
  const presentationPort = { present() {} };
  const checkpointPort = { requestRecoverySave() {} };

  assert.equal(requireBattlePresentationPort(presentationPort), presentationPort);
  assert.equal(requireBattleCheckpointPort(checkpointPort), checkpointPort);
  assert.throws(
    () => requireBattlePresentationPort({}),
    { code: "BATTLE_PRESENTATION_METHOD_REQUIRED" }
  );
  assert.throws(
    () => requireBattleCheckpointPort({}),
    { code: "BATTLE_CHECKPOINT_METHOD_REQUIRED" }
  );
});

test("BattleCommandPort verifies the complete Screen-facing command surface", () => {
  const commandPort = {
    flowState: "IDLE",
    createSaveSnapshot() {},
    dispose() {},
    endPlayerTurn() {},
    executeAction() {},
    executeWait() {},
    finalizeTacticFacing() {},
    getActionTargets() {},
    getAvailableActions() {},
    getBattleResult() {},
    getCandidatePaths() {},
    getReachableCells() {},
    getStage() {},
    isStableForSave() {}
  };

  assert.equal(requireBattleCommandPort(commandPort), commandPort);
  assert.throws(
    () => requireBattleCommandPort({ flowState: "IDLE" }),
    { code: "BATTLE_COMMAND_METHOD_REQUIRED" }
  );
});

test("NullBattlePresentationPort respects cancellation at the boundary", async () => {
  const port = new NullBattlePresentationPort();
  const abortController = new AbortController();
  const request = createSemanticPresentationRequest(
    PresentationRequestType.PHASE,
    { turn: 1, phase: "PLAYER" }
  );

  assert.equal(await port.present(request, abortController.signal), null);
  abortController.abort();
  await assert.rejects(
    port.present(request, abortController.signal),
    { name: "AbortError" }
  );
});

test("NullBattleCheckpointPort accepts an immutable data snapshot", () => {
  const port = new NullBattleCheckpointPort();
  const snapshot = Object.freeze({ stageId: "stage_a" });

  assert.equal(port.requestRecoverySave(snapshot), undefined);
  assert.throws(
    () => port.requestRecoverySave(null),
    { code: "BATTLE_SNAPSHOT_REQUIRED" }
  );
});
