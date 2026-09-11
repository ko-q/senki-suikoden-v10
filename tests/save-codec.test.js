import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTENT_REVISION,
  GAME_VERSION,
  SAVE_FORMAT_VERSION
} from "../src/config/version.js";
import { SaveCodec, SaveKind } from "../src/persistence/save-codec.js";
import {
  MigrationCatalog,
  SaveMigrator
} from "../src/persistence/save-migrator.js";
import { createPopulatedSaveBattle } from "../test-support/save-fixtures.js";

function createDocument(overrides = {}) {
  const { battle } = createPopulatedSaveBattle();
  return {
    saveFormatVersion: SAVE_FORMAT_VERSION,
    gameVersion: GAME_VERSION,
    contentRevision: CONTENT_REVISION,
    saveKind: SaveKind.MANUAL,
    slotId: "manual_01",
    revision: 1,
    writerId: "test_writer",
    savedAt: 1234,
    battle,
    ...overrides
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test("SaveCodec round-trips a format 6 data-only document and freezes decoded data", () => {
  const codec = new SaveCodec();
  const document = createDocument();

  const raw = codec.encode(document);
  const decoded = codec.decode(raw);

  assert.deepEqual(decoded, document);
  assert.equal(Object.isFrozen(decoded), true);
  assert.equal(Object.isFrozen(decoded.battle), true);
  assert.equal(Object.isFrozen(decoded.battle.units), true);
  assert.equal(Object.isFrozen(decoded.battle.units[0].statusEffects), true);
  assert.equal(Object.getPrototypeOf(decoded.battle.units[0]), Object.prototype);
});

test("SaveCodec rejects unknown fields instead of serializing runtime state", () => {
  const codec = new SaveCodec();
  const document = clone(createDocument());
  document.battle.preview = { x: 1, y: 0 };

  assert.throws(
    () => codec.encode(document),
    { code: "SAVE_BATTLE_FIELDS_INVALID" }
  );
});

test("SaveCodec rejects invalid JSON and unsupported save formats", () => {
  const codec = new SaveCodec();

  assert.throws(() => codec.decode("{"), { code: "SAVE_JSON_INVALID" });
  assert.throws(
    () => codec.encode(createDocument({ saveFormatVersion: 5 })),
    { code: "SAVE_FORMAT_UNSUPPORTED" }
  );
});

test("SaveCodec requires status effects in enum order without duplicates", () => {
  const codec = new SaveCodec();
  const document = clone(createDocument());
  document.battle.units[0].statusEffects.reverse();

  assert.throws(
    () => codec.encode(document),
    { code: "SAVE_UNIT_STATUS_ORDER_INVALID" }
  );
});

test("SaveCodec rejects duplicate Unit and Trap identity", () => {
  const codec = new SaveCodec();
  const duplicateUnit = clone(createDocument());
  duplicateUnit.battle.units.push(clone(duplicateUnit.battle.units[0]));
  const duplicateTrap = clone(createDocument());
  duplicateTrap.battle.hiddenTraps[1].id = duplicateTrap.battle.hiddenTraps[0].id;

  assert.throws(
    () => codec.encode(duplicateUnit),
    { code: "SAVE_UNIT_ID_DUPLICATE" }
  );
  assert.throws(
    () => codec.encode(duplicateTrap),
    { code: "SAVE_TRAP_ID_DUPLICATE" }
  );
});

test("SaveMigrator is a pure format 6 passthrough with an immutable catalog", () => {
  const codec = new SaveCodec();
  const document = codec.decode(codec.encode(createDocument()));
  const catalog = new MigrationCatalog({
    eventIdMappings: { old_event: "save_event" }
  });
  const migrator = new SaveMigrator({ catalog });

  const migrated = migrator.migrate(document);

  assert.equal(migrated.document, document);
  assert.equal(migrated.migrated, false);
  assert.equal(migrated.sourceRevision, 1);
  assert.equal(Object.isFrozen(catalog.eventIdMappings), true);
  assert.throws(
    () => migrator.migrate({ ...document, saveFormatVersion: 5 }),
    { code: "SAVE_MIGRATION_FORMAT_UNSUPPORTED" }
  );
});
