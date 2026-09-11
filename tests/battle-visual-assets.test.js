import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import {
  BattleVisualAssetId,
  DEFAULT_BATTLE_VISUAL_ASSET_URLS,
  V9_BATTLE_VISUAL_ASSET_MANIFEST
} from "../src/presentation/battle-visual-assets.js";

test("all eight v9.7.75 battle visual assets retain their decoded byte hashes", () => {
  assert.equal(V9_BATTLE_VISUAL_ASSET_MANIFEST.length, 8);
  assert.equal(
    new Set(V9_BATTLE_VISUAL_ASSET_MANIFEST.map((definition) => definition.id)).size,
    Object.values(BattleVisualAssetId).length
  );

  for (const definition of V9_BATTLE_VISUAL_ASSET_MANIFEST) {
    const fileUrl = new URL(`../assets/effects/${definition.fileName}`, import.meta.url);
    const bytes = fs.readFileSync(fileUrl);
    assert.equal(bytes.byteLength, definition.byteLength, definition.fileName);
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      definition.sha256,
      definition.fileName
    );
    assert.equal(DEFAULT_BATTLE_VISUAL_ASSET_URLS[definition.id], fileUrl.href);
  }
});
