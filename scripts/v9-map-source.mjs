import assert from "node:assert/strict";
import { createHash } from "node:crypto";

export const V9_GAME_SOURCE_SHA256 = "9fabc74803aeaf373d002ce1dd54356309b8561d98c44399eb90d9e024baf328";

/** Extract literal terrain arrays only; never execute the legacy Game constructor. */
export function readV9StageMaps(source) {
  const normalized = source.replace(/\r\n/g, "\n");
  assert.equal(createHash("sha256").update(normalized).digest("hex"), V9_GAME_SOURCE_SHA256,
    "Unexpected v9.7.75 game.js source");
  const terrainIds = new Set(["plain", "road", "forest", "hill", "mountain", "wall", "swamp", "water"]);
  const matches = [...normalized.matchAll(
    /^        id:"([^"]+)",\n        chapterNumber:(\d+),([\s\S]*?)^        map:(\[[\s\S]*?^        \]),/gm
  )];
  assert.equal(matches.length, 9);
  return matches.map(([, stageId, number, header, literal], index) => {
    const chapterNumber = Number(number);
    assert.equal(chapterNumber, index + 1);
    const sourceMap = JSON.parse(literal);
    assert.ok(sourceMap.every((row) => Array.isArray(row) && row.length === 8
      && row.every((id) => terrainIds.has(id))), `Invalid terrain grid: ${stageId}`);
    // v9 loadStage/expandMapRows doubles each row only for an eight-row source.
    const map = sourceMap.length === 8
      ? sourceMap.flatMap((row) => [[...row], [...row]]) : sourceMap.map((row) => [...row]);
    assert.ok(map.length === 16 || map.length === 20);
    const titleMatch = header.match(/^        title:"([^"]+)",/m);
    assert.ok(titleMatch);
    return {
      stageId, chapterNumber, title: titleMatch[1], mapKey: `chapter_${chapterNumber}`,
      columns: 8, rows: map.length, sourceRows: sourceMap.length,
      terrainSha256: createHash("sha256").update(JSON.stringify(map)).digest("hex"), map
    };
  });
}
