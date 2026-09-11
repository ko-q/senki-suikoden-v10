import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_MANUAL_SLOT_IDS,
  MANUAL_SAVE_SLOT_COUNT,
  PersistencePanel
} from "../src/presentation/persistence-panel.js";
import {
  createFakePersistenceElements,
  installFakeDocument
} from "../test-support/fake-battle-dom.js";

function inspection(
  slotId,
  status,
  summary = null,
  repairable = status === "temporary" || status === "backup"
) {
  return Object.freeze({
    slotId,
    status,
    source: status === "occupied" ? "primary" : null,
    repairable,
    summary,
    guard: Object.freeze({ slotId, marker: status })
  });
}

function summary(slotId) {
  return Object.freeze({
    slotId,
    stageId: "foundation_preview",
    turn: 3,
    phase: "PLAYER",
    savedAt: 1000
  });
}

test("PersistencePanel renders slot capabilities and confirms destructive actions", () => {
  const restoreDocument = installFakeDocument();
  try {
    const elements = createFakePersistenceElements();
    const confirmations = [];
    const events = [];
    const panel = new PersistencePanel({
      elements,
      confirmAction(message) {
        confirmations.push(message);
        return true;
      }
    });
    panel.bindHandlers({
      onDelete(slotId, guard) {
        events.push(["delete", slotId, guard.marker]);
      },
      onLoad(slotId, guard) {
        events.push(["load", slotId, guard.marker]);
      },
      onNewBattle() {
        events.push(["new"]);
      },
      onRepair(slotId, guard) {
        events.push(["repair", slotId, guard.marker]);
      },
      onRefresh() {
        events.push(["refresh"]);
      },
      onResumeRecovery(guard) {
        events.push(["resume", guard.marker]);
      },
      onSave(slotId) {
        events.push(["save", slotId]);
      },
      onStartNewFromRecovery() {
        events.push(["recovery-new"]);
      }
    });
    panel.setSessionState({ hasSession: true, canSave: true });
    panel.renderManualSlots([
      inspection("manual_01", "occupied", summary("manual_01")),
      inspection("manual_02", "empty"),
      inspection("manual_03", "incompatible"),
      inspection("manual_04", "temporary", summary("manual_04")),
      inspection("manual_05", "backup", summary("manual_05")),
      inspection("manual_06", "backup", summary("manual_06"), false)
    ]);

    const occupiedActions = elements.manualSlotList.children[0].children[2];
    const emptyActions = elements.manualSlotList.children[1].children[2];
    const incompatibleActions = elements.manualSlotList.children[2].children[2];
    const temporaryActions = elements.manualSlotList.children[3].children[2];
    const backupActions = elements.manualSlotList.children[4].children[2];
    const protectedBackupActions = elements.manualSlotList.children[5].children[2];
    assert.equal(occupiedActions.children[0].disabled, false);
    assert.equal(occupiedActions.children[1].disabled, false);
    assert.equal(occupiedActions.children[2].disabled, false);
    assert.equal(emptyActions.children[0].disabled, false);
    assert.equal(emptyActions.children[1].disabled, true);
    assert.equal(emptyActions.children[2].disabled, true);
    assert.equal(incompatibleActions.children[0].disabled, true);
    assert.equal(incompatibleActions.children[1].disabled, true);
    assert.equal(incompatibleActions.children[2].disabled, false);
    assert.equal(temporaryActions.children.length, 4);
    assert.equal(temporaryActions.children[3].textContent, "Repair");
    assert.equal(backupActions.children.length, 4);
    assert.equal(backupActions.children[3].textContent, "Repair");
    assert.equal(protectedBackupActions.children.length, 3);

    occupiedActions.children[0].dispatch("click");
    occupiedActions.children[1].dispatch("click");
    occupiedActions.children[2].dispatch("click");
    temporaryActions.children[3].dispatch("click");
    backupActions.children[3].dispatch("click");
    elements.refreshSlotsButton.dispatch("click");
    elements.newBattleButton.dispatch("click");
    assert.deepEqual(events, [
      ["save", "manual_01"],
      ["load", "manual_01", "occupied"],
      ["delete", "manual_01", "occupied"],
      ["repair", "manual_04", "temporary"],
      ["repair", "manual_05", "backup"],
      ["refresh"],
      ["new"]
    ]);
    assert.equal(confirmations.length, 6);

    const recovery = inspection("recovery", "occupied", summary("recovery"));
    panel.showRecoveryPrompt(recovery);
    assert.equal(elements.recoveryOverlay.hidden, false);
    assert.match(elements.recoverySummary.textContent, /Turn 3/);
    elements.resumeRecoveryButton.dispatch("click");
    assert.deepEqual(events.at(-1), ["resume", "occupied"]);
    panel.hideRecoveryPrompt();
    assert.equal(elements.recoveryOverlay.hidden, true);

    panel.dispose();
    elements.refreshSlotsButton.dispatch("click");
    assert.deepEqual(events.at(-1), ["resume", "occupied"]);
  } finally {
    restoreDocument();
  }
});

test("PersistencePanel disables every persistence action when storage is unavailable", () => {
  const restoreDocument = installFakeDocument();
  try {
    const elements = createFakePersistenceElements();
    const panel = new PersistencePanel({ elements, confirmAction: () => true });
    panel.bindHandlers({
      onDelete() {},
      onLoad() {},
      onNewBattle() {},
      onRepair() {},
      onRefresh() {},
      onResumeRecovery() {},
      onSave() {},
      onStartNewFromRecovery() {}
    });
    panel.setSessionState({ hasSession: true, canSave: true });
    panel.renderManualSlots([
      inspection("manual_01", "occupied", summary("manual_01"))
    ]);
    panel.setPersistenceAvailable(false);

    const actions = elements.manualSlotList.children[0].children[2];
    assert.equal(elements.persistenceUnavailable.hidden, false);
    assert.equal(elements.refreshSlotsButton.disabled, true);
    assert.equal(actions.children.every((button) => button.disabled), true);
  } finally {
    restoreDocument();
  }
});

test("the formal manual save catalog contains exactly twenty ordered slots", () => {
  assert.equal(MANUAL_SAVE_SLOT_COUNT, 20);
  assert.equal(DEFAULT_MANUAL_SLOT_IDS.length, 20);
  assert.equal(DEFAULT_MANUAL_SLOT_IDS[0], "manual_01");
  assert.equal(DEFAULT_MANUAL_SLOT_IDS[19], "manual_20");
  assert.equal(new Set(DEFAULT_MANUAL_SLOT_IDS).size, 20);
  assert.equal(Object.isFrozen(DEFAULT_MANUAL_SLOT_IDS), true);
});
