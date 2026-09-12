import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import {
  DEFAULT_SCREEN_VISUAL_ASSET_URLS,
  ScreenVisualAssetId,
  V9_SCREEN_VISUAL_ASSET_MANIFEST
} from "../src/presentation/screen-visual-assets.js";

test("all seven v9.7.75 screen visual assets retain their decoded byte hashes", () => {
  assert.equal(V9_SCREEN_VISUAL_ASSET_MANIFEST.length, 7);
  assert.equal(
    new Set(V9_SCREEN_VISUAL_ASSET_MANIFEST.map((definition) => definition.id)).size,
    Object.values(ScreenVisualAssetId).length
  );

  for (const definition of V9_SCREEN_VISUAL_ASSET_MANIFEST) {
    const fileUrl = new URL(`../assets/screens/${definition.fileName}`, import.meta.url);
    const bytes = fs.readFileSync(fileUrl);
    assert.equal(bytes.byteLength, definition.byteLength, definition.fileName);
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      definition.sha256,
      definition.fileName
    );
    assert.equal(DEFAULT_SCREEN_VISUAL_ASSET_URLS[definition.id], fileUrl.href);
  }
});
