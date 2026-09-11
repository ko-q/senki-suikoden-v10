import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";

import {
  AudioAssetId,
  DEFAULT_AUDIO_ASSET_URLS,
  V9_AUDIO_ASSET_MANIFEST
} from "../src/audio/audio-assets.js";

test("all twenty v9.7.75 audio assets retain their decoded byte hashes", () => {
  assert.equal(V9_AUDIO_ASSET_MANIFEST.length, 20);
  assert.equal(
    new Set(V9_AUDIO_ASSET_MANIFEST.map((definition) => definition.id)).size,
    Object.values(AudioAssetId).length
  );

  for (const definition of V9_AUDIO_ASSET_MANIFEST) {
    const fileUrl = new URL(`../assets/audio/${definition.fileName}`, import.meta.url);
    const bytes = fs.readFileSync(fileUrl);
    assert.equal(bytes.byteLength, definition.byteLength, definition.fileName);
    assert.equal(
      crypto.createHash("sha256").update(bytes).digest("hex"),
      definition.sha256,
      definition.fileName
    );
    assert.equal(DEFAULT_AUDIO_ASSET_URLS[definition.id], fileUrl.href);
  }
});
