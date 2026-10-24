import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { getPortraitAsset, V9_PORTRAIT_ASSET_MANIFEST } from "../src/presentation/portrait-assets.js";
import { getStageMapAsset, V9_STAGE_MAP_ASSET_MANIFEST } from "../src/presentation/stage-map-assets.js";

test("all 166 portraits and nine maps retain the decoded v9 image bytes", async () => {
  assert.equal(V9_PORTRAIT_ASSET_MANIFEST.length, 166);
  assert.equal(V9_STAGE_MAP_ASSET_MANIFEST.length, 9);
  for (const [manifest, lookup] of [
    [V9_PORTRAIT_ASSET_MANIFEST, getPortraitAsset],
    [V9_STAGE_MAP_ASSET_MANIFEST, getStageMapAsset]
  ]) {
    assert.equal(new Set(manifest.map((asset) => asset.id)).size, manifest.length);
    for (const definition of manifest) {
      const asset = lookup(definition.id);
      assert.ok(Object.isFrozen(asset));
      const bytes = await readFile(new URL(asset.url));
      assert.equal(bytes.length, asset.byteLength, asset.id);
      assert.equal(createHash("sha256").update(bytes).digest("hex"), asset.sha256, asset.id);
      assert.equal(asset.mimeType, bytes[0] === 137 ? "image/png" : "image/jpeg", asset.id);
    }
  }
});

test("portrait lookup requires the exact adopted key, including chapter-nine variants", () => {
  assert.equal(getPortraitAsset("wu_song_ch9").name, "武松");
  for (const key of ["wu_song", "", null, undefined, "toString", "__proto__", "../song_jiang"]) {
    assert.equal(getPortraitAsset(key), null);
  }
  // The source declared this JPEG as PNG. Correct the file suffix, never the bytes.
  assert.equal(getPortraitAsset("mob_executioner").declaredMimeType, "image/png");
  assert.equal(getPortraitAsset("mob_executioner").mimeType, "image/jpeg");
});

test("map catalog preserves chapter-one crop and the taller sixth/seventh/ninth boards", () => {
  assert.equal(getStageMapAsset("chapter_1").backgroundSize, "112.5% 112.5%");
  assert.equal(getStageMapAsset("chapter_1").backgroundPosition, "50% 25%");
  assert.deepEqual(V9_STAGE_MAP_ASSET_MANIFEST.map(({ columns, rows }) => [columns, rows]),
    [[8,16], [8,16], [8,16], [8,16], [8,16], [8,20], [8,20], [8,16], [8,20]]);
  assert.equal(getStageMapAsset(1), null);
  assert.equal(getStageMapAsset("development_stage"), null);
});
