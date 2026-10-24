import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readV9StageMaps } from "./v9-map-source.mjs";

// Extract data only. Never execute the legacy JavaScript or re-encode images.
const sourceRoot = process.argv[2];
assert.ok(sourceRoot, "Usage: node scripts/import-v9-visual-assets.mjs <v9 directory>");
const outputRoot = fileURLToPath(new URL("../", import.meta.url));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sourceHashes = {
  "portrait-assets.js": "05cd2d40c3b2a5d325c85efa19bd53ecf045b03e45c3e899ef15d197afc90b6d",
  "stage-map-assets.css": "628c1a74762001c9c38d3594c21588c5f08102dcb694af88241d66d5e1efbac3"
};
const sources = {};
for (const [file, expected] of Object.entries(sourceHashes)) {
  // Git may check out LF as CRLF on Windows; normalize source text only.
  const source = (await readFile(resolve(sourceRoot, file), "utf8")).replace(/\r\n/g, "\n");
  assert.equal(hash(source), expected, `Unexpected v9.7.75 source: ${file}`);
  sources[file] = source;
}

function decode(id, declaredMimeType, base64) {
  assert.match(id, /^[a-z0-9_]+$/);
  const bytes = Buffer.from(base64, "base64");
  assert.equal(bytes.toString("base64"), base64, `Invalid base64: ${id}`);
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  assert.ok(png || jpeg, `Unknown image signature: ${id}`);
  const mimeType = png ? "image/png" : "image/jpeg";
  return {
    bytes,
    definition: {
      id, fileName: `${id}.${png ? "png" : "jpg"}`, mimeType, declaredMimeType,
      byteLength: bytes.length, sha256: hash(bytes)
    }
  };
}

const portraits = [...sources["portrait-assets.js"].matchAll(
  /^  (\w+):\{name:'([^']+)',src:'data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)'\},?\r?$/gm
)].map(([, id, name, mime, data]) => {
  const asset = decode(id, mime, data);
  asset.definition.name = name;
  return asset;
});
assert.equal(portraits.length, 166, "Portrait coverage changed");
const chapterWords = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];
const stageMaps = readV9StageMaps(await readFile(resolve(sourceRoot, "game.js"), "utf8"));
const maps = [...sources["stage-map-assets.css"].matchAll(
  /\.board\.stage-(\w+)-map::before\{[^{}]*?background-image:url\("data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)"\);background-size:([^;]+);background-position:([^;]+);background-repeat:no-repeat\}/g
)].map(([, word, mime, data, backgroundSize, backgroundPosition], index) => {
  assert.equal(word, chapterWords[index]);
  const asset = decode(`chapter_${index + 1}`, mime, data);
  Object.assign(asset.definition, {
    chapterNumber: index + 1, stageId: stageMaps[index].stageId,
    columns: stageMaps[index].columns, rows: stageMaps[index].rows,
    backgroundSize, backgroundPosition
  });
  return asset;
});
assert.equal(maps.length, 9, "Stage map coverage changed");

// Validate everything before writing any output.
for (const [directory, assets, exportName, moduleName] of [
  ["portraits", portraits, "V9_PORTRAIT_ASSET_MANIFEST", "portrait-asset-manifest.js"],
  ["maps", maps, "V9_STAGE_MAP_ASSET_MANIFEST", "stage-map-asset-manifest.js"]
]) {
  assert.equal(new Set(assets.map(({ definition }) => definition.id)).size, assets.length);
  await mkdir(resolve(outputRoot, "assets", directory), { recursive: true });
  for (const { bytes, definition } of assets) {
    await writeFile(resolve(outputRoot, "assets", directory, definition.fileName), bytes);
  }
  const definitions = assets.map(({ definition }) => definition);
  await writeFile(resolve(outputRoot, "src/presentation", moduleName),
    `// Generated from v9.7.75 commit 3e3fb85ca8279e5351668562dea677df777a1ddc.\n`
    + `// Reproduce with scripts/import-v9-visual-assets.mjs. Image bytes are unchanged.\n`
    + `export const ${exportName} = Object.freeze(\n${JSON.stringify(definitions, null, 2)}.map(Object.freeze));\n`);
  console.log(`${directory}: ${assets.length} assets, ${assets.reduce((sum, a) => sum + a.bytes.length, 0)} bytes`);
}
await writeFile(resolve(outputRoot, "src/definitions/v9-stage-maps.js"),
  `// Generated from v9.7.75 game.js at commit 3e3fb85ca8279e5351668562dea677df777a1ddc.\n`
  + `// Terrain only: not complete playable Stage definitions.\n`
  + `export const V9_STAGE_MAP_DEFINITIONS = Object.freeze(\n${JSON.stringify(stageMaps, null, 2)}\n`
  + `.map((definition) => Object.freeze({ ...definition, map: Object.freeze(definition.map.map(Object.freeze)) })));\n`
  + `const byStageId = new Map(V9_STAGE_MAP_DEFINITIONS.map((definition) => [definition.stageId, definition]));\n`
  + `export function getV9StageMapDefinition(stageId) { return byStageId.get(stageId) ?? null; }\n`);
