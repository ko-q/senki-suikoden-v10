import {
  invariant,
  requireIdentifier
} from "../core/domain-error.js";
import { SAVE_FORMAT_VERSION } from "../config/version.js";

function normalizeIdMapping(values, codePrefix) {
  invariant(
    values !== null
      && typeof values === "object"
      && !Array.isArray(values)
      && Object.getPrototypeOf(values) === Object.prototype,
    `${codePrefix}_INVALID`
  );
  const normalized = {};
  for (const [sourceId, targetId] of Object.entries(values)) {
    requireIdentifier(sourceId, `${codePrefix}_SOURCE_ID_INVALID`);
    normalized[sourceId] = requireIdentifier(targetId, `${codePrefix}_TARGET_ID_INVALID`);
  }
  return Object.freeze(normalized);
}

/**
 * 将来の明示importでだけ利用するdata-only ID対応表。
 */
export class MigrationCatalog {
  constructor({ eventIdMappings = {} } = {}) {
    this.eventIdMappings = normalizeIdMapping(eventIdMappings, "MIGRATION_EVENT_MAPPING");
    Object.freeze(this);
  }
}

/**
 * Runtime graphを参照しないpureな保存形式変換。初期版はv6のみを受理する。
 */
export class SaveMigrator {
  constructor({ catalog = new MigrationCatalog() } = {}) {
    invariant(catalog instanceof MigrationCatalog, "SAVE_MIGRATION_CATALOG_REQUIRED");
    this.catalog = catalog;
    Object.freeze(this);
  }

  migrate(document) {
    invariant(
      document !== null && typeof document === "object" && !Array.isArray(document),
      "SAVE_MIGRATION_DOCUMENT_INVALID"
    );
    invariant(
      document.saveFormatVersion === SAVE_FORMAT_VERSION,
      "SAVE_MIGRATION_FORMAT_UNSUPPORTED",
      { saveFormatVersion: document.saveFormatVersion }
    );
    return Object.freeze({
      document,
      migrated: false,
      sourceRevision: document.revision
    });
  }
}
