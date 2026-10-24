import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readV9StageMaps } from "./v9-map-source.mjs";

const source = (await readFile(resolve(process.argv[2] ?? "../v9-reference", "game.js"), "utf8")).replace(/\r\n/g, "\n");
readV9StageMaps(source); // Verify the audited whole-file hash before extracting literal data.
const literal = source.match(/const CHARACTER_MANAGER=new CharacterManager\(\[([\s\S]*?)\n\]\);/)[1];
const records = [...literal.matchAll(/new Character\(\{([^{}]+)\}\)/g)].map(([, body]) => {
  // Quote only property names outside string values; no legacy code is executed.
  const json = body.replace(/("(?:\\.|[^"\\])*"|\b[a-zA-Z][a-zA-Z0-9_]*\s*:)/g,
    (token) => token.startsWith('"') ? token : `"${token.slice(0, -1).trim()}":`);
  const value = JSON.parse(`{${json}}`);
  const { short, portrait, combatSkill, specialAbility, ...rest } = value;
  return { ...rest, shortName: short, portraitKey: portrait,
    combatSkills: combatSkill.split("・"), specialAbilities: specialAbility.split("・") };
});
assert.equal(records.length, 92);
assert.equal(new Set(records.map((record) => record.id)).size, records.length);
await writeFile(new URL("../src/definitions/v9-characters.js", import.meta.url),
  '// Generated from pinned v9.7.75. Existing v9 values, not a claim of Excel 4.7 verification.\n'
  + 'import { Character, CharacterManager } from "../domain/character.js";\n'
  + `const records = ${JSON.stringify(records, null, 2)};\n`
  + 'export function createV9CharacterManager() { return new CharacterManager(records.map((record) => new Character(record))); }\n');
console.log(`Imported ${records.length} existing v9 characters`);
