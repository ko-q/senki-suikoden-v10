import test from "node:test";
import assert from "node:assert/strict";

import { SAVE_STORAGE_PREFIX } from "../src/config/version.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { MemoryStorage } from "../test-support/memory-storage.js";

function raw(revision) {
  return JSON.stringify({ revision });
}

class LockStealingStorage extends MemoryStorage {
  constructor() {
    super();
    this.stealAfterKey = null;
    this.lockKey = null;
  }

  setItem(key, value) {
    super.setItem(key, value);
    if (key === this.stealAfterKey) {
      super.setItem(this.lockKey, JSON.stringify({
        ownerId: "writer_b",
        operationId: "writer_b:2",
        expiresAt: 999
      }));
    }
  }
}

test("SaveRepository writes temporary then primary and preserves the prior valid generation", () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const empty = repository.readSlot("manual_01");

  const first = repository.writeSlot("manual_01", raw(1), {
    expectedSlot: empty,
    preserveCurrentAsBackup: false,
    lockOwnerId: "writer_a"
  });
  const second = repository.writeSlot("manual_01", raw(2), {
    expectedSlot: first.slot,
    preserveCurrentAsBackup: true,
    lockOwnerId: "writer_a"
  });
  const keys = repository.slotKeys("manual_01");

  assert.equal(second.slot.primary, raw(2));
  assert.equal(second.slot.backup, raw(1));
  assert.equal(second.slot.temporary, null);
  assert.equal(storage.getItem(keys.lock), null);
  assert.equal(repository.revisionFromRaw(second.slot.primary), 2);
  assert.equal(repository.revisionFromRaw("broken"), null);
});

test("SaveRepository rejects a changed slot before writing", () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const expected = repository.readSlot("manual_01");
  storage.setItem(repository.slotKeys("manual_01").primary, raw(9));

  assert.throws(
    () => repository.writeSlot("manual_01", raw(1), {
      expectedSlot: expected,
      lockOwnerId: "writer_a"
    }),
    { code: "SAVE_CONFLICT" }
  );
  assert.equal(repository.readSlot("manual_01").primary, raw(9));
});

test("SaveRepository honors a live foreign lock and replaces an expired one", () => {
  let now = 100;
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, clock: () => now, lockTtlMs: 20 });
  const keys = repository.slotKeys("manual_01");
  const expected = repository.readSlot("manual_01");
  storage.setItem(keys.lock, JSON.stringify({
    ownerId: "writer_b",
    operationId: "writer_b:1",
    expiresAt: 110
  }));

  assert.throws(
    () => repository.writeSlot("manual_01", raw(1), {
      expectedSlot: expected,
      lockOwnerId: "writer_a"
    }),
    { code: "SAVE_LOCKED" }
  );

  now = 111;
  const written = repository.writeSlot("manual_01", raw(1), {
    expectedSlot: expected,
    lockOwnerId: "writer_a"
  });
  assert.equal(written.slot.primary, raw(1));
  assert.equal(storage.getItem(keys.lock), null);
});

test("SaveRepository keeps temporary data when primary verification fails", () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const keys = repository.slotKeys("manual_01");
  storage.ignoredSetKeys.add(keys.primary);

  assert.throws(
    () => repository.writeSlot("manual_01", raw(1), {
      expectedSlot: repository.readSlot("manual_01"),
      lockOwnerId: "writer_a"
    }),
    { code: "SAVE_PRIMARY_VERIFY_FAILED" }
  );
  assert.equal(storage.getItem(keys.temporary), raw(1));
  assert.equal(storage.getItem(keys.primary), null);
  assert.equal(storage.getItem(keys.lock), null);
});

test("SaveRepository stops before primary commit when another writer replaces its lock", () => {
  const storage = new LockStealingStorage();
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const keys = repository.slotKeys("manual_01");
  storage.stealAfterKey = keys.temporary;
  storage.lockKey = keys.lock;

  assert.throws(
    () => repository.writeSlot("manual_01", raw(1), {
      expectedSlot: repository.readSlot("manual_01"),
      lockOwnerId: "writer_a"
    }),
    { code: "SAVE_CONFLICT" }
  );
  assert.equal(storage.getItem(keys.primary), null);
  assert.equal(storage.getItem(keys.temporary), raw(1));
  assert.notEqual(storage.getItem(keys.lock), null);
});

test("SaveRepository promotes a completed temporary copy without changing backup", () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const keys = repository.slotKeys("manual_01");
  storage.setItem(keys.primary, "broken-primary");
  storage.setItem(keys.temporary, raw(3));
  storage.setItem(keys.backup, raw(1));
  const expected = repository.readSlot("manual_01");

  const promoted = repository.promoteTemporary("manual_01", {
    expectedSlot: expected,
    lockOwnerId: "writer_a"
  });

  assert.equal(promoted.source, "temporary");
  assert.equal(promoted.slot.primary, raw(3));
  assert.equal(promoted.slot.temporary, null);
  assert.equal(promoted.slot.backup, raw(1));
  assert.equal(storage.getItem(keys.lock), null);
});

test("SaveRepository stages a backup before promoting it to primary", () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const keys = repository.slotKeys("manual_02");
  storage.setItem(keys.primary, "broken-primary");
  storage.setItem(keys.temporary, "broken-temporary");
  storage.setItem(keys.backup, raw(2));

  const promoted = repository.promoteBackup("manual_02", {
    expectedSlot: repository.readSlot("manual_02"),
    lockOwnerId: "writer_a"
  });

  assert.equal(promoted.source, "backup");
  assert.equal(promoted.slot.primary, raw(2));
  assert.equal(promoted.slot.temporary, null);
  assert.equal(promoted.slot.backup, raw(2));
  assert.equal(storage.getItem(keys.lock), null);
});

test("SaveRepository rejects stale promotion and preserves every generation", () => {
  const storage = new MemoryStorage();
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const keys = repository.slotKeys("manual_03");
  storage.setItem(keys.temporary, raw(1));
  const expected = repository.readSlot("manual_03");
  storage.setItem(keys.primary, raw(9));

  assert.throws(
    () => repository.promoteTemporary("manual_03", {
      expectedSlot: expected,
      lockOwnerId: "writer_a"
    }),
    { code: "SAVE_CONFLICT" }
  );
  assert.deepEqual(repository.readSlot("manual_03"), {
    primary: raw(9),
    temporary: raw(1),
    backup: null
  });
});

test("an interrupted fallback promotion keeps at least one valid recoverable copy", () => {
  const temporaryStorage = new MemoryStorage();
  const temporaryRepository = new SaveRepository({
    storage: temporaryStorage,
    clock: () => 100
  });
  const temporaryKeys = temporaryRepository.slotKeys("manual_01");
  temporaryStorage.setItem(temporaryKeys.temporary, raw(4));
  temporaryStorage.ignoredSetKeys.add(temporaryKeys.primary);
  assert.throws(
    () => temporaryRepository.promoteTemporary("manual_01", {
      expectedSlot: temporaryRepository.readSlot("manual_01"),
      lockOwnerId: "writer_a"
    }),
    { code: "SAVE_PROMOTION_VERIFY_FAILED" }
  );
  assert.equal(temporaryStorage.getItem(temporaryKeys.temporary), raw(4));

  const backupStorage = new MemoryStorage();
  const backupRepository = new SaveRepository({ storage: backupStorage, clock: () => 100 });
  const backupKeys = backupRepository.slotKeys("manual_02");
  backupStorage.setItem(backupKeys.primary, "broken-primary");
  backupStorage.setItem(backupKeys.backup, raw(2));
  backupStorage.ignoredSetKeys.add(backupKeys.primary);
  assert.throws(
    () => backupRepository.promoteBackup("manual_02", {
      expectedSlot: backupRepository.readSlot("manual_02"),
      lockOwnerId: "writer_a"
    }),
    { code: "SAVE_PROMOTION_VERIFY_FAILED" }
  );
  assert.equal(backupStorage.getItem(backupKeys.temporary), raw(2));
  assert.equal(backupStorage.getItem(backupKeys.backup), raw(2));
});

test("SaveRepository never reads, overwrites, or deletes v9 keys", () => {
  const legacyPrimary = "senki_suikoden_save_v2";
  const legacyRecovery = "senki_suikoden_recovery";
  const storage = new MemoryStorage({
    [legacyPrimary]: "v9-primary",
    [legacyRecovery]: "v9-recovery"
  });
  const repository = new SaveRepository({ storage, clock: () => 100 });
  const empty = repository.readSlot("recovery");
  const written = repository.writeSlot("recovery", raw(1), {
    expectedSlot: empty,
    lockOwnerId: "writer_a"
  });

  repository.removeSlot("recovery", {
    expectedSlot: written.slot,
    lockOwnerId: "writer_a"
  });

  assert.equal(storage.getItem(legacyPrimary), "v9-primary");
  assert.equal(storage.getItem(legacyRecovery), "v9-recovery");
  assert.equal(repository.prefix, SAVE_STORAGE_PREFIX);
  assert.equal(
    [...storage.values.keys()].every((key) => (
      key === legacyPrimary || key === legacyRecovery || key.startsWith(SAVE_STORAGE_PREFIX)
    )),
    true
  );
});
