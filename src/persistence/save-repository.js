import {
  DomainError,
  invariant,
  requireIdentifier,
  requireIntegerInRange
} from "../core/domain-error.js";
import { SAVE_STORAGE_PREFIX } from "../config/version.js";

function requireStorage(storage) {
  invariant(
    storage !== null
      && typeof storage === "object"
      && typeof storage.getItem === "function"
      && typeof storage.setItem === "function"
      && typeof storage.removeItem === "function",
    "SAVE_STORAGE_REQUIRED"
  );
  return storage;
}

function freezeSlot(slot) {
  return Object.freeze({
    primary: slot.primary,
    temporary: slot.temporary,
    backup: slot.backup
  });
}

/**
 * v10専用namespace内で三世代保存、fallback昇格、競合検出、書込み後検証を担当する。
 */
export class SaveRepository {
  #storage;
  #clock;
  #lockTtlMs;
  #operationCounter;

  constructor({ storage, clock = () => Date.now(), lockTtlMs = 2000 }) {
    this.#storage = requireStorage(storage);
    invariant(typeof clock === "function", "SAVE_REPOSITORY_CLOCK_REQUIRED");
    this.#clock = clock;
    this.#lockTtlMs = requireIntegerInRange(
      lockTtlMs,
      1,
      Number.MAX_SAFE_INTEGER,
      "SAVE_LOCK_TTL_INVALID"
    );
    this.#operationCounter = 0;
  }

  get prefix() {
    return SAVE_STORAGE_PREFIX;
  }

  slotKeys(slotId) {
    const normalizedSlotId = requireIdentifier(slotId, "SAVE_SLOT_ID_INVALID");
    const root = `${SAVE_STORAGE_PREFIX}slot:${normalizedSlotId}:`;
    return Object.freeze({
      primary: `${root}primary`,
      temporary: `${root}temporary`,
      backup: `${root}backup`,
      lock: `${root}lock`
    });
  }

  readSlot(slotId) {
    const keys = this.slotKeys(slotId);
    return freezeSlot({
      primary: this.#storage.getItem(keys.primary),
      temporary: this.#storage.getItem(keys.temporary),
      backup: this.#storage.getItem(keys.backup)
    });
  }

  captureSlotState(slot) {
    invariant(slot !== null && typeof slot === "object", "SAVE_SLOT_STATE_INVALID");
    for (const key of ["primary", "temporary", "backup"]) {
      invariant(
        slot[key] === null || typeof slot[key] === "string",
        "SAVE_SLOT_STATE_VALUE_INVALID",
        { key }
      );
    }
    return freezeSlot(slot);
  }

  slotMatchesExpected(slot, expectedSlot) {
    const current = this.captureSlotState(slot);
    const expected = this.captureSlotState(expectedSlot);
    return current.primary === expected.primary
      && current.temporary === expected.temporary
      && current.backup === expected.backup;
  }

  createOperationId(writerId) {
    const normalizedWriterId = requireIdentifier(writerId, "SAVE_WRITER_ID_INVALID");
    this.#operationCounter += 1;
    return `${normalizedWriterId}:${this.#clock()}:${this.#operationCounter}`;
  }

  revisionFromRaw(raw) {
    if (typeof raw !== "string") {
      return null;
    }
    try {
      const parsed = JSON.parse(raw);
      if (
        parsed !== null
        && typeof parsed === "object"
        && Number.isInteger(parsed.revision)
        && parsed.revision >= 1
      ) {
        return parsed.revision;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  writeSlot(slotId, raw, {
    expectedSlot,
    preserveCurrentAsBackup = true,
    lockOwnerId,
    operationId = this.createOperationId(lockOwnerId)
  }) {
    invariant(typeof raw === "string", "SAVE_WRITE_RAW_INVALID");
    invariant(typeof preserveCurrentAsBackup === "boolean", "SAVE_BACKUP_FLAG_INVALID");
    requireIdentifier(lockOwnerId, "SAVE_LOCK_OWNER_INVALID");
    invariant(typeof operationId === "string" && operationId.length > 0, "SAVE_OPERATION_ID_INVALID");
    const keys = this.slotKeys(slotId);
    const expected = this.captureSlotState(expectedSlot);
    const lockRaw = this.#acquireLock(keys.lock, lockOwnerId, operationId);

    try {
      const current = this.readSlot(slotId);
      if (!this.slotMatchesExpected(current, expected)) {
        throw new DomainError("SAVE_CONFLICT", { slotId });
      }

      this.#storage.setItem(keys.temporary, raw);
      this.#requireLock(keys.lock, lockRaw);
      invariant(this.#storage.getItem(keys.temporary) === raw, "SAVE_TEMPORARY_VERIFY_FAILED");

      if (preserveCurrentAsBackup && current.primary !== null) {
        this.#storage.setItem(keys.backup, current.primary);
        this.#requireLock(keys.lock, lockRaw);
        invariant(
          this.#storage.getItem(keys.backup) === current.primary,
          "SAVE_BACKUP_VERIFY_FAILED"
        );
      }

      this.#storage.setItem(keys.primary, raw);
      this.#requireLock(keys.lock, lockRaw);
      invariant(this.#storage.getItem(keys.primary) === raw, "SAVE_PRIMARY_VERIFY_FAILED");
      this.#storage.removeItem(keys.temporary);
      this.#requireLock(keys.lock, lockRaw);

      const completed = this.readSlot(slotId);
      invariant(
        completed.primary === raw && completed.temporary === null,
        "SAVE_WRITE_VERIFY_FAILED"
      );
      return Object.freeze({
        slotId,
        slot: completed
      });
    } finally {
      this.#releaseLock(keys.lock, lockRaw);
    }
  }

  promoteTemporary(slotId, {
    expectedSlot,
    lockOwnerId,
    operationId = this.createOperationId(lockOwnerId)
  }) {
    requireIdentifier(lockOwnerId, "SAVE_LOCK_OWNER_INVALID");
    const keys = this.slotKeys(slotId);
    const expected = this.captureSlotState(expectedSlot);
    const lockRaw = this.#acquireLock(keys.lock, lockOwnerId, operationId);

    try {
      const current = this.readSlot(slotId);
      if (!this.slotMatchesExpected(current, expected) || current.temporary === null) {
        throw new DomainError("SAVE_CONFLICT", { slotId });
      }
      const sourceRaw = current.temporary;
      this.#storage.setItem(keys.primary, sourceRaw);
      this.#requireLock(keys.lock, lockRaw);
      invariant(
        this.#storage.getItem(keys.primary) === sourceRaw
          && this.#storage.getItem(keys.temporary) === sourceRaw,
        "SAVE_PROMOTION_VERIFY_FAILED"
      );
      this.#storage.removeItem(keys.temporary);
      this.#requireLock(keys.lock, lockRaw);

      const completed = this.readSlot(slotId);
      invariant(
        completed.primary === sourceRaw
          && completed.temporary === null
          && completed.backup === current.backup,
        "SAVE_PROMOTION_VERIFY_FAILED"
      );
      return Object.freeze({ slotId, source: "temporary", slot: completed });
    } finally {
      this.#releaseLock(keys.lock, lockRaw);
    }
  }

  promoteBackup(slotId, {
    expectedSlot,
    lockOwnerId,
    operationId = this.createOperationId(lockOwnerId)
  }) {
    requireIdentifier(lockOwnerId, "SAVE_LOCK_OWNER_INVALID");
    const keys = this.slotKeys(slotId);
    const expected = this.captureSlotState(expectedSlot);
    const lockRaw = this.#acquireLock(keys.lock, lockOwnerId, operationId);

    try {
      const current = this.readSlot(slotId);
      if (!this.slotMatchesExpected(current, expected) || current.backup === null) {
        throw new DomainError("SAVE_CONFLICT", { slotId });
      }
      const sourceRaw = current.backup;
      this.#storage.setItem(keys.temporary, sourceRaw);
      this.#requireLock(keys.lock, lockRaw);
      invariant(
        this.#storage.getItem(keys.primary) === current.primary
          && this.#storage.getItem(keys.temporary) === sourceRaw
          && this.#storage.getItem(keys.backup) === sourceRaw,
        "SAVE_PROMOTION_TEMPORARY_VERIFY_FAILED"
      );

      this.#storage.setItem(keys.primary, sourceRaw);
      this.#requireLock(keys.lock, lockRaw);
      invariant(
        this.#storage.getItem(keys.primary) === sourceRaw
          && this.#storage.getItem(keys.temporary) === sourceRaw,
        "SAVE_PROMOTION_VERIFY_FAILED"
      );
      this.#storage.removeItem(keys.temporary);
      this.#requireLock(keys.lock, lockRaw);

      const completed = this.readSlot(slotId);
      invariant(
        completed.primary === sourceRaw
          && completed.temporary === null
          && completed.backup === sourceRaw,
        "SAVE_PROMOTION_VERIFY_FAILED"
      );
      return Object.freeze({ slotId, source: "backup", slot: completed });
    } finally {
      this.#releaseLock(keys.lock, lockRaw);
    }
  }

  removeSlot(slotId, { expectedSlot, lockOwnerId, operationId = this.createOperationId(lockOwnerId) }) {
    requireIdentifier(lockOwnerId, "SAVE_LOCK_OWNER_INVALID");
    const keys = this.slotKeys(slotId);
    const expected = this.captureSlotState(expectedSlot);
    const lockRaw = this.#acquireLock(keys.lock, lockOwnerId, operationId);

    try {
      const current = this.readSlot(slotId);
      if (!this.slotMatchesExpected(current, expected)) {
        throw new DomainError("SAVE_CONFLICT", { slotId });
      }
      this.#storage.removeItem(keys.primary);
      this.#storage.removeItem(keys.temporary);
      this.#storage.removeItem(keys.backup);
      this.#requireLock(keys.lock, lockRaw);
      const completed = this.readSlot(slotId);
      invariant(
        completed.primary === null
          && completed.temporary === null
          && completed.backup === null,
        "SAVE_REMOVE_VERIFY_FAILED"
      );
      return Object.freeze({ slotId, removed: true, slot: completed });
    } finally {
      this.#releaseLock(keys.lock, lockRaw);
    }
  }

  isOwnedKey(key) {
    return typeof key === "string" && key.startsWith(SAVE_STORAGE_PREFIX);
  }

  slotIdFromKey(key) {
    if (!this.isOwnedKey(key)) {
      return null;
    }
    const suffixMatch = key.slice(SAVE_STORAGE_PREFIX.length).match(
      /^slot:([a-z0-9][a-z0-9_-]*):(primary|temporary|backup|lock)$/
    );
    return suffixMatch?.[1] ?? null;
  }

  #acquireLock(lockKey, ownerId, operationId) {
    const now = this.#clock();
    const existingRaw = this.#storage.getItem(lockKey);
    if (existingRaw !== null) {
      try {
        const existing = JSON.parse(existingRaw);
        if (
          existing !== null
          && typeof existing === "object"
          && Number.isInteger(existing.expiresAt)
          && existing.expiresAt > now
          && (existing.ownerId !== ownerId || existing.operationId !== operationId)
        ) {
          throw new DomainError("SAVE_LOCKED");
        }
      } catch (error) {
        if (error instanceof DomainError) {
          throw error;
        }
      }
    }

    const lockRaw = JSON.stringify({
      ownerId,
      operationId,
      expiresAt: now + this.#lockTtlMs
    });
    this.#storage.setItem(lockKey, lockRaw);
    invariant(this.#storage.getItem(lockKey) === lockRaw, "SAVE_LOCK_VERIFY_FAILED");
    return lockRaw;
  }

  #releaseLock(lockKey, lockRaw) {
    if (this.#storage.getItem(lockKey) === lockRaw) {
      this.#storage.removeItem(lockKey);
    }
  }

  #requireLock(lockKey, lockRaw) {
    if (this.#storage.getItem(lockKey) !== lockRaw) {
      throw new DomainError("SAVE_CONFLICT");
    }
  }
}
