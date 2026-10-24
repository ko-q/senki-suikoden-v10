import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { readV9StageMaps } from "./v9-map-source.mjs";

const source = (await readFile(resolve(process.argv[2] ?? "../v9-reference", "game.js"), "utf8")).replace(/\r\n/g, "\n");
const maps = readV9StageMaps(source);
const definitions = [];
for (const map of maps) {
  const start = source.indexOf(`        id:"${map.stageId}",`);
  const nextId = maps[map.chapterNumber]?.stageId;
  let block = source.slice(start, nextId ? source.indexOf(`        id:"${nextId}",`, start) : source.indexOf("\n    ]\n  }", start));
  if (map.chapterNumber === 9) {
    assert.ok(source.includes("this.stageNineFireWaterEffectTestEnabled=false"));
    // Keep the normal game branches, excluding the old effect-test-only front-line deployment.
    block = block.replace(/\.\.\.\(this\.stageNineFireWaterEffectTestEnabled\?\[\n[\s\S]*?\n          \]:\[\]\),/g, "")
      .replace(/^ {12}\.\.\.\(this\.stageNineFireWaterEffectTestEnabled\?\[\]:\[\n([\s\S]*?)\n            \]\)/gm, "$1");
  }
  const readString = (key) => JSON.parse(block.match(new RegExp(`^        ${key}:("[^"\\n]*"),`, "m"))[1]);
  const positions = new Map([...(block.match(/        positions:\{([\s\S]*?)\n        \}/)?.[1] ?? "")
    .matchAll(/([a-z0-9_]+):\[(\d+),(\d+)\]/g)].map(([, id, x, y]) => [id, { x: Number(x), y: Number(y) }]));
  const units = [...block.matchAll(/^( {10}| {12}| {14})(?:Object\.assign\()?this\.(createPlayerCharacterUnit|createEnemyCharacterUnit|u)\((.*?)\)(?:,\{([^}]+)\}\))?,?$/gm)].map((match) => {
    const [, indent, method, args, overrideLiteral] = match;
    const overrides = overrideLiteral ? JSON.parse(`{${overrideLiteral.replace(/([A-Za-z][A-Za-z0-9]*):/g, '"$1":').replace(/:\./g, ':0.')}}`) : null;
    if (overrides) {
      assert.ok(Object.keys(overrides).every((key) => ["maxHp", "maxStrategyUses", "specialTacticDamageRate", "zhujiaMobTacticAi"].includes(key)));
      if (overrides.specialTacticDamageRate !== undefined) assert.equal(overrides.specialTacticDamageRate, .75);
    }
    const reserve = map.chapterNumber === 3 && match.index > block.indexOf("        raidReinforcements:[")
      || map.chapterNumber === 5 && indent.length === 12
      || map.chapterNumber === 9 && indent.length >= 12;
    // All constructor arguments in these chapters are JSON primitives. Never eval legacy code.
    const values = JSON.parse(`[${args}]`);
    const id = values[0];
    if ([1, 2, 4, 5].includes(map.chapterNumber) && !reserve) assert.ok(positions.has(id), `Missing final position: ${id}`);
    const x = values[method === "u" ? 4 : 2], y = values[method === "u" ? 5 : 3];
    const position = positions.get(id) ?? { x, y: map.sourceRows === 8 ? y * 2 : y };
    if (method !== "u") {
      assert.equal(values.length, 6);
      return { id, characterId: values[1], army: method === "createPlayerCharacterUnit" ? "PLAYER" : "ENEMY",
        position, move: values[4], facing: values[5].toUpperCase(), ...(reserve ? { reserve: true } : {}) };
    }
    assert.equal(values.length, 19);
    const [ , name, shortName, team, , , martial, command, intelligence, charisma, move, facing,
      portraitKey, alias, combatSkill, specialAbility, personality, historical, characterSource] = values;
    assert.equal(team, "enemy");
    return { id, characterId: `${map.stageId}_${id}`, army: "ENEMY", position, move, facing: facing.toUpperCase(),
      ...(reserve ? { reserve: true } : {}),
      ...(overrides ? { overrides } : {}),
      mobCharacter: { id: `${map.stageId}_${id}`, name, shortName, martial, command, intelligence, charisma,
        portraitKey, alias, combatSkills: [combatSkill], specialAbilities: [specialAbility], personality, historical, source: characterSource } };
  }).sort((a, b) => Number(Boolean(a.reserve)) - Number(Boolean(b.reserve)));
  assert.equal(units.length, [12, 9, 31, 12, 49, 80, 61, 57, 95][map.chapterNumber - 1]);
  if ([1, 2, 4, 5].includes(map.chapterNumber)) assert.equal(positions.size, units.filter((unit) => !unit.reserve).length);
  for (const reserve of [false, true]) {
    const group = units.filter((unit) => Boolean(unit.reserve) === reserve);
    assert.equal(new Set(group.map((unit) => `${unit.position.x},${unit.position.y}`)).size, group.length);
  }
  for (const unit of units) assert.ok(map.map[unit.position.y]?.[unit.position.x]);
  const parseDialogue = (literal) => {
    const matches = [...literal.matchAll(/\{(unit|name):("[^"]+"),(?:action:("[^"]+"),)?text:("[^"]+")\}/g)];
    assert.equal(matches.length, [...literal.matchAll(/^\s*\{/gm)].length, "Unparsed dialogue line");
    return matches.map(([, kind, id, action, text]) => {
      const speaker = JSON.parse(id);
      if (kind === "unit") assert.ok(units.some((unit) => unit.id === speaker));
      return { ...(kind === "unit" ? { unitId: speaker } : { speakerName: speaker }),
        text: JSON.parse(text), ...(action ? { actionLabel: JSON.parse(action) } : {}) };
    });
  };
  const dialogue = (key, indentation = 8) => parseDialogue(block.match(new RegExp(`^ {${indentation}}${key}:\\[([\\s\\S]*?)^ {${indentation}}\\],?$`, "m"))[1]);
  const escapeMatch = block.match(/^        (?:escape|escapeAfterRaid):\{x:(\d+),y:(\d+),radius:(\d+),required:(\[[^\n]+\])\},/m);
  const escape = escapeMatch ? { destination: { x: Number(escapeMatch[1]), y: Number(escapeMatch[2]) },
    radius: Number(escapeMatch[3]), unitIds: JSON.parse(escapeMatch[4]) } : null;
  if (escape) for (const id of escape.unitIds) assert.ok(units.some((unit) => unit.id === id));
  definitions.push({ id: map.stageId, chapterNumber: map.chapterNumber, title: map.title,
    description: readString("description"), leader: readString("leader"), turnLimit: Number(block.match(/        turnLimit:(\d+),/)[1]),
    escape, objectiveText: readString("objective"),
    requiredSurvivors: JSON.parse(block.match(/        requiredSurvivors:(\[[^\n]+\]),/)?.[1] ?? "[]"),
    ...(map.chapterNumber === 8 ? { pursuit: {
      unitIds: JSON.parse(block.match(/        damingPursuitUnits:(\[[\s\S]*?\]),/)[1]),
      gateColumns: [3, 4], insideMaximumRow: 3, outsideRow: 4, candidateMinimumRow: 1,
      priorityActorIds: ["daming_reinforcement_infantry_left", "daming_reinforcement_infantry_right"]
    } } : {}),
    ...(map.chapterNumber === 9 ? {
      defection: { turn: 6, unitIds: ["yu_baosi"], arrival: dialogue("dialogue", 10) },
      relief: { requiredDefeatedUnitIds: ["qin_ming_zengtou"],
        arrival: parseDialogue(block.match(/        qinMingReinforcement:\{[\s\S]*?          dialogue:\[([\s\S]*?)\n          \],/)[1]) }
    } : {}),
    ...(map.chapterNumber === 7 ? { sorcery: {
      actorUnitId: "gao_lian", suppressorUnitId: "gongsun_sheng_gaotang", suppressionRange: 3,
      trapZones: [...block.match(/        hiddenTrapZones:\[([\s\S]*?)\n        \],/)[1]
        .matchAll(/\{type:("[^"]+"),label:("[^"]+"),count:(\d+),candidates:(\[[^\n]+\])\}/g)]
        .map(([, kind, label, count, candidates]) => ({ kind: JSON.parse(kind), label: JSON.parse(label), count: Number(count), candidates: JSON.parse(candidates) })),
      warning: parseDialogue(source.match(/if\(!this.finished&&isSpellTrap&&!this.gaotangSpellTrapDialogueTriggered\)\{[\s\S]*?await this.showDialogueSequence\(\[([\s\S]*?)\]\);/)[1])
    } } : {}),
    ...(map.chapterNumber === 6 ? { betrayal: {
      turn: Number(block.match(/        zhujiaBetrayal:\{\n          turn:(\d+),/)[1]),
      unitIds: JSON.parse(block.match(/        stationaryUnits:(\[[^\n]+\]),/)[1]),
      arrival: dialogue("dialogue", 10),
      trapZones: [...block.match(/        hiddenTrapZones:\[([\s\S]*?)\n        \],/)[1]
        .matchAll(/\{label:("[^"]+"),count:(\d+),candidates:(\[[^\n]+\])\}/g)]
        .map(([, label, count, candidates]) => ({ label: JSON.parse(label), count: Number(count), candidates: JSON.parse(candidates) }))
    } } : {}),
    ...(map.chapterNumber === 5 ? { rescue: {
      turn: Number(block.match(/        turnReinforcement:\{\n          turn:(\d+),/)[1]),
      arrival: dialogue("dialogue", 10)
    } } : {}),
    ...(map.chapterNumber === 3 ? { raid: {
      escapeObjective: readString("escapeObjective"),
      completionMessages: [
        "護送車を含む初期護送部隊を全滅！　生辰綱を奪取した。",
        "任務更新：晁蓋を北端の湿地に出現した旗まで脱出させてください。"
      ].map((text) => { assert.ok(source.includes(`this.addLog(${JSON.stringify(text)})`)); return text; }),
      turnLimit: Number(block.match(/        raidTurnLimit:(\d+),/)[1]),
      reinforcementTurn: Number(block.match(/        raidReinforcementTurn:(\d+),/)[1]),
      stationaryUnits: JSON.parse(block.match(/        stationaryUnits:(\[[^\n]+\]),/)[1]),
      arrival: dialogue("raidArrivalDialogue")
    } } : {}),
    units, intro: dialogue("intro"), victory: dialogue("victory") });
}
// The first chapter's literal escape specification must remain the audited one.
assert.ok(source.includes('escape:{x:3,y:0,radius:0,required:["shi_jin"]}'));
assert.ok(source.includes('escapeAfterRaid:{x:3,y:0,radius:0,required:["chao_gai"]}'));
const output = `// Generated from pinned v9.7.75 game.js by scripts/import-v9-opening-stages.mjs.\n`
  + `function freeze(value) {\n  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }\n  return value;\n}\n`
  + `export const V9_OPENING_STAGE_SOURCE = freeze(${JSON.stringify(definitions, null, 2)});\n`;
await writeFile(new URL("../src/definitions/v9-opening-stage-source.js", import.meta.url), output);
console.log(`Imported ${definitions.length} chapters, ${definitions.reduce((n, d) => n + d.units.length, 0)} units`);
