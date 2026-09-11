import test from "node:test";
import assert from "node:assert/strict";

import { CONTENT_REVISION } from "../src/config/version.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { BattleResumeKind } from "../src/core/prepared-battle-load.js";
import { SaveCodec, SaveKind } from "../src/persistence/save-codec.js";
import { SaveMigrator } from "../src/persistence/save-migrator.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { SaveCheckpointAdapter, SaveService } from "../src/services/save-service.js";
import { createStageDigest } from "../test-support/fixtures.js";
import { MemoryStorage } from "../test-support/memory-storage.js";
import {
  createPopulatedSaveBattle,
  createSaveStageFactory
} from "../test-support/save-fixtures.js";

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createSaveRuntime({
  storage = new MemoryStorage(),
  stageFactory = createSaveStageFactory(),
  writerId = "test_writer",
  now = 1000
} = {}) {
  const repository = new SaveRepository({ storage, clock: () => now });
  const codec = new SaveCodec();
  const service = new SaveService({
    repository,
    codec,
    migrator: new SaveMigrator(),
    stageFactory,
    writerId,
    clock: () => now
  });
  return { storage, repository, codec, service };
}

function trapDigest(stage) {
  return stage.getHiddenTraps().map((trap) => ({
    id: trap.id,
    kind: trap.kind,
    position: { x: trap.position.x, y: trap.position.y },
    active: trap.active,
    triggerAffiliations: [...trap.triggerAffiliations]
  }));
}

test("SaveService restores all dynamic state into a new Stage", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  const saved = runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const inspection = runtime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  const prepared = runtime.service.prepareLoad({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    guard: inspection.guard
  });

  assert.equal(saved.ok, true);
  assert.equal(saved.document.revision, 1);
  assert.equal(inspection.status, "occupied");
  assert.equal(inspection.summary.playerUnitCount, 2);
  assert.notEqual(prepared.stage, fixture.stage);
  assert.equal(createStageDigest(prepared.stage), createStageDigest(fixture.stage));
  assert.deepEqual(trapDigest(prepared.stage), trapDigest(fixture.stage));
  assert.deepEqual(
    prepared.stage.eventManager.getCompletedEventIds(),
    fixture.stage.eventManager.getCompletedEventIds()
  );
  assert.deepEqual(
    prepared.stage.battleLog.getEntries(),
    fixture.stage.battleLog.getEntries()
  );
  assert.equal(prepared.stage.turn, 4);
  assert.equal(prepared.stage.phase, "PLAYER");
  assert.deepEqual(prepared.randomState, fixture.battleRandom.exportState());
  assert.equal(prepared.resumeContext.kind, BattleResumeKind.TACTIC_FACING_SELECT);
  assert.equal(prepared.resumeContext.committedUnitId, "save_player");
  assert.equal(prepared.sourceRevision, 1);
  assert.equal(Object.isFrozen(prepared), true);
  assert.equal(Object.isFrozen(prepared.document), true);
});

test("SaveService uses a valid temporary or backup candidate without mutating it", () => {
  const fixture = createPopulatedSaveBattle();
  const temporaryRuntime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  temporaryRuntime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const temporaryKeys = temporaryRuntime.repository.slotKeys("manual_01");
  const rawPrimary = temporaryRuntime.storage.getItem(temporaryKeys.primary);
  temporaryRuntime.storage.setItem(temporaryKeys.temporary, rawPrimary);
  temporaryRuntime.storage.removeItem(temporaryKeys.primary);

  const temporaryInspection = temporaryRuntime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  assert.equal(temporaryInspection.status, "temporary");
  assert.equal(temporaryInspection.repairable, true);
  assert.equal(
    temporaryRuntime.service.prepareLoad({
      slotId: "manual_01",
      saveKind: SaveKind.MANUAL,
      guard: temporaryInspection.guard
    }).sourceRevision,
    1
  );
  assert.equal(temporaryRuntime.storage.getItem(temporaryKeys.primary), null);

  const backupRuntime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  backupRuntime.service.saveBattle({
    slotId: "manual_02",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  backupRuntime.service.saveBattle({
    slotId: "manual_02",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const backupKeys = backupRuntime.repository.slotKeys("manual_02");
  const invalidPrimary = JSON.parse(backupRuntime.storage.getItem(backupKeys.primary));
  invalidPrimary.battle.units[0].position = { x: 4, y: 0 };
  backupRuntime.storage.setItem(backupKeys.primary, JSON.stringify(invalidPrimary));

  const backupInspection = backupRuntime.service.inspectSlot("manual_02", SaveKind.MANUAL);
  assert.equal(backupInspection.status, "backup");
  assert.equal(backupInspection.repairable, true);
  assert.equal(backupInspection.summary.revision, 1);
  assert.equal(
    backupRuntime.service.prepareLoad({
      slotId: "manual_02",
      saveKind: SaveKind.MANUAL,
      guard: backupInspection.guard
    }).sourceRevision,
    1
  );
});

test("SaveService explicitly repairs temporary and backup fallbacks into primary", () => {
  const fixture = createPopulatedSaveBattle();
  const temporaryRuntime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  temporaryRuntime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const temporaryKeys = temporaryRuntime.repository.slotKeys("manual_01");
  const temporaryRaw = temporaryRuntime.storage.getItem(temporaryKeys.primary);
  temporaryRuntime.storage.setItem(temporaryKeys.temporary, temporaryRaw);
  temporaryRuntime.storage.removeItem(temporaryKeys.primary);
  const temporaryInspection = temporaryRuntime.service.inspectSlot(
    "manual_01",
    SaveKind.MANUAL
  );

  const temporaryRepair = temporaryRuntime.service.repairSlot({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    guard: temporaryInspection.guard
  });
  assert.equal(temporaryRepair.ok, true);
  assert.equal(temporaryRepair.source, "temporary");
  assert.equal(temporaryRepair.inspection.status, "occupied");
  assert.equal(temporaryRuntime.storage.getItem(temporaryKeys.primary), temporaryRaw);
  assert.equal(temporaryRuntime.storage.getItem(temporaryKeys.temporary), null);

  const backupRuntime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  backupRuntime.service.saveBattle({
    slotId: "manual_02",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  backupRuntime.service.saveBattle({
    slotId: "manual_02",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const backupKeys = backupRuntime.repository.slotKeys("manual_02");
  const backupRaw = backupRuntime.storage.getItem(backupKeys.backup);
  backupRuntime.storage.setItem(backupKeys.primary, "broken-primary");
  const backupInspection = backupRuntime.service.inspectSlot("manual_02", SaveKind.MANUAL);

  const backupRepair = backupRuntime.service.repairSlot({
    slotId: "manual_02",
    saveKind: SaveKind.MANUAL,
    guard: backupInspection.guard
  });
  assert.equal(backupRepair.ok, true);
  assert.equal(backupRepair.source, "backup");
  assert.equal(backupRepair.inspection.status, "occupied");
  assert.equal(backupRuntime.storage.getItem(backupKeys.primary), backupRaw);
  assert.equal(backupRuntime.storage.getItem(backupKeys.backup), backupRaw);
  assert.equal(backupRuntime.storage.getItem(backupKeys.temporary), null);
});

test("SaveService repair requires the selected fallback guard and never mutates stale data", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const keys = runtime.repository.slotKeys("manual_01");
  const validRaw = runtime.storage.getItem(keys.primary);
  runtime.storage.setItem(keys.temporary, validRaw);
  runtime.storage.removeItem(keys.primary);
  const selected = runtime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  runtime.storage.setItem(keys.primary, "externally-changed");

  assert.deepEqual(runtime.service.repairSlot({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    guard: selected.guard
  }), {
    ok: false,
    status: "conflict",
    code: "SAVE_CONFLICT",
    slotId: "manual_01"
  });
  assert.equal(runtime.storage.getItem(keys.primary), "externally-changed");
  assert.equal(runtime.storage.getItem(keys.temporary), validRaw);
});

test("SaveService rejects repair when primary is valid or no fallback is valid", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const occupied = runtime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  assert.equal(runtime.service.repairSlot({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    guard: occupied.guard
  }).status, "not_required");

  const keys = runtime.repository.slotKeys("manual_02");
  runtime.storage.setItem(keys.primary, "broken-primary");
  const corrupt = runtime.service.inspectSlot("manual_02", SaveKind.MANUAL);
  assert.equal(runtime.service.repairSlot({
    slotId: "manual_02",
    saveKind: SaveKind.MANUAL,
    guard: corrupt.guard
  }).status, "unavailable");
  assert.equal(runtime.storage.getItem(keys.primary), "broken-primary");
});

test("SaveService loads but never repairs over a newer incompatible generation", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const keys = runtime.repository.slotKeys("manual_01");
  const incompatible = JSON.parse(runtime.storage.getItem(keys.primary));
  incompatible.contentRevision = "future-content";
  const incompatibleRaw = JSON.stringify(incompatible);
  runtime.storage.setItem(keys.primary, incompatibleRaw);

  const inspection = runtime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  assert.equal(inspection.status, "backup");
  assert.equal(inspection.repairable, false);
  assert.equal(runtime.service.prepareLoad({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    guard: inspection.guard
  }).sourceRevision, 1);
  assert.deepEqual(runtime.service.repairSlot({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    guard: inspection.guard
  }), {
    ok: false,
    status: "protected",
    code: "SAVE_REPAIR_INCOMPATIBLE_GENERATION",
    slotId: "manual_01"
  });
  assert.equal(runtime.storage.getItem(keys.primary), incompatibleRaw);
});

test("recovery checkpoints are serialized in enqueue order and revisions cannot overtake", async () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  const firstBattle = fixture.battle;
  fixture.stage.setTurnAndPhase(5, "PLAYER");
  const secondBattle = createBattleSaveData(fixture.stage, fixture.battleRandom);
  const adapter = new SaveCheckpointAdapter(runtime.service);

  const firstPromise = adapter.requestRecoverySave(firstBattle);
  const secondPromise = adapter.requestRecoverySave(secondBattle);
  const [first, second] = await Promise.all([firstPromise, secondPromise]);
  const slot = runtime.repository.readSlot("recovery");
  const primary = runtime.codec.decode(slot.primary);
  const backup = runtime.codec.decode(slot.backup);

  assert.equal(first.document.revision, 1);
  assert.equal(second.document.revision, 2);
  assert.equal(primary.revision, 2);
  assert.equal(primary.battle.turn, 5);
  assert.equal(backup.revision, 1);
  assert.equal(backup.battle.turn, 4);
});

test("two writers detect a changed slot and require an explicit refresh", () => {
  const fixture = createPopulatedSaveBattle();
  const storage = new MemoryStorage();
  const firstRuntime = createSaveRuntime({
    storage,
    stageFactory: fixture.stageFactory,
    writerId: "writer_a"
  });
  const secondRuntime = createSaveRuntime({
    storage,
    stageFactory: fixture.stageFactory,
    writerId: "writer_b"
  });
  firstRuntime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  secondRuntime.service.inspectSlot("manual_01", SaveKind.MANUAL);

  assert.equal(firstRuntime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  }).ok, true);
  assert.deepEqual(secondRuntime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  }), {
    ok: false,
    status: "conflict",
    code: "SAVE_CONFLICT",
    slotId: "manual_01"
  });
  assert.equal(secondRuntime.service.isSlotConflicted("manual_01"), true);

  assert.equal(secondRuntime.service.inspectSlot("manual_01", SaveKind.MANUAL).status, "occupied");
  const retried = secondRuntime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  assert.equal(retried.ok, true);
  assert.equal(retried.document.revision, 2);
});

test("prepareLoad rejects an incompatible content revision and leaves the old battle untouched", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const before = createStageDigest(fixture.stage);
  const keys = runtime.repository.slotKeys("manual_01");
  const document = JSON.parse(runtime.storage.getItem(keys.primary));
  document.contentRevision = "different-content";
  runtime.storage.setItem(keys.primary, JSON.stringify(document));

  assert.throws(
    () => runtime.service.prepareLoad({
      slotId: "manual_01",
      saveKind: SaveKind.MANUAL
    }),
    { code: "SAVE_LOAD_INCOMPATIBLE" }
  );
  assert.equal(createStageDigest(fixture.stage), before);
  assert.equal(document.contentRevision === CONTENT_REVISION, false);
});

test("prepareLoad rejects invalid runtime placement without touching the old Stage", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const oldDigest = createStageDigest(fixture.stage);
  const keys = runtime.repository.slotKeys("manual_01");
  const document = JSON.parse(runtime.storage.getItem(keys.primary));
  document.battle.units[0].position = { x: 4, y: 0 };
  runtime.storage.setItem(keys.primary, JSON.stringify(document));

  assert.throws(
    () => runtime.service.prepareLoad({
      slotId: "manual_01",
      saveKind: SaveKind.MANUAL
    }),
    { code: "SAVE_LOAD_CORRUPT" }
  );
  assert.equal(createStageDigest(fixture.stage), oldDigest);

  assert.equal(runtime.service.inspectSlot("manual_01", SaveKind.MANUAL).status, "corrupt");
  assert.equal(runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  }).ok, true);
  assert.equal(runtime.repository.readSlot("manual_01").backup, null);
});

test("prepareLoad derives player, tactic-facing, and enemy continuation contexts from Domain", () => {
  const fixture = createPopulatedSaveBattle();
  const tacticRuntime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  tacticRuntime.service.saveBattle({
    slotId: "tactic",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  assert.equal(tacticRuntime.service.prepareLoad({
    slotId: "tactic",
    saveKind: SaveKind.MANUAL
  }).resumeContext.kind, BattleResumeKind.TACTIC_FACING_SELECT);

  const playerBattle = clone(fixture.battle);
  playerBattle.units[0].actionState = "FINISHED";
  const playerRuntime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  playerRuntime.service.saveBattle({
    slotId: "player",
    saveKind: SaveKind.MANUAL,
    battle: playerBattle
  });
  assert.equal(playerRuntime.service.prepareLoad({
    slotId: "player",
    saveKind: SaveKind.MANUAL
  }).resumeContext.kind, BattleResumeKind.UNIT_SELECT);

  const enemyBattle = clone(playerBattle);
  enemyBattle.phase = "ENEMY";
  const formerEnemy = enemyBattle.units.find((unit) => unit.id === "save_enemy");
  formerEnemy.army = "ENEMY";
  formerEnemy.actionState = "READY";
  const enemyRuntime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  enemyRuntime.service.saveBattle({
    slotId: "enemy",
    saveKind: SaveKind.MANUAL,
    battle: enemyBattle
  });
  assert.equal(enemyRuntime.service.prepareLoad({
    slotId: "enemy",
    saveKind: SaveKind.MANUAL
  }).resumeContext.kind, BattleResumeKind.ENEMY_CONTINUE);
});

test("SaveService rejects MOVED at write and again when loading tampered data", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  const movedBattle = clone(fixture.battle);
  movedBattle.units[0].actionState = "MOVED";
  assert.throws(
    () => runtime.service.saveBattle({
      slotId: "manual_01",
      saveKind: SaveKind.MANUAL,
      battle: movedBattle
    }),
    { code: "SAVE_DATA_MOVED_UNIT_FORBIDDEN" }
  );

  assert.equal(runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  }).ok, true);
  const keys = runtime.repository.slotKeys("manual_01");
  const document = JSON.parse(runtime.storage.getItem(keys.primary));
  document.battle.units[0].actionState = "MOVED";
  runtime.storage.setItem(keys.primary, JSON.stringify(document));

  assert.throws(
    () => runtime.service.prepareLoad({
      slotId: "manual_01",
      saveKind: SaveKind.MANUAL
    }),
    { code: "SAVE_LOAD_CORRUPT" }
  );
});

test("SaveService validates the new snapshot against Stage definitions before writing", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  const unknownStageBattle = clone(fixture.battle);
  unknownStageBattle.stageId = "unknown_stage";

  assert.throws(
    () => runtime.service.saveBattle({
      slotId: "manual_01",
      saveKind: SaveKind.MANUAL,
      battle: unknownStageBattle
    }),
    { code: "STAGE_DEFINITION_NOT_FOUND" }
  );
  assert.deepEqual(runtime.repository.readSlot("manual_01"), {
    primary: null,
    temporary: null,
    backup: null
  });
});

test("selection guards, storage events, and deleteSlot prevent stale destructive writes", () => {
  const fixture = createPopulatedSaveBattle();
  const runtime = createSaveRuntime({ stageFactory: fixture.stageFactory });
  runtime.service.saveBattle({
    slotId: "manual_01",
    saveKind: SaveKind.MANUAL,
    battle: fixture.battle
  });
  const inspection = runtime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  const keys = runtime.repository.slotKeys("manual_01");

  assert.equal(runtime.service.handleStorageEvent({ key: "senki_suikoden_save_v2" }), false);
  assert.equal(runtime.service.handleStorageEvent({ key: keys.primary }), true);
  assert.equal(runtime.service.isSlotConflicted("manual_01"), true);
  runtime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  runtime.storage.setItem(keys.primary, "externally-changed");

  assert.deepEqual(runtime.service.deleteSlot({
    slotId: "manual_01",
    guard: inspection.guard
  }), {
    ok: false,
    status: "conflict",
    code: "SAVE_CONFLICT",
    slotId: "manual_01"
  });
  assert.equal(runtime.storage.getItem(keys.primary), "externally-changed");

  const refreshed = runtime.service.inspectSlot("manual_01", SaveKind.MANUAL);
  assert.equal(refreshed.status, "corrupt");
  assert.equal(runtime.service.deleteSlot({
    slotId: "manual_01",
    guard: refreshed.guard
  }).ok, true);
  assert.equal(runtime.storage.getItem(keys.primary), null);
});
