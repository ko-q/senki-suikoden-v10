import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTENT_REVISION,
  GAME_VERSION,
  SAVE_FORMAT_VERSION,
  SAVE_STORAGE_PREFIX
} from "../src/config/version.js";

test("v10 save identifiers cannot collide with the v9 namespace", () => {
  assert.equal(SAVE_FORMAT_VERSION, 6);
  assert.equal(SAVE_STORAGE_PREFIX, "senki_suikoden_v10_test_save_v1:");
  assert.equal(SAVE_STORAGE_PREFIX.includes("senki_suikoden_save_v2"), false);
});

test("Milestone 11 keeps Save content compatible with Milestone 8", () => {
  assert.equal(GAME_VERSION, "10.0.0-dev.11");
  assert.equal(CONTENT_REVISION, "v10-save-transactional-load-8");
});
