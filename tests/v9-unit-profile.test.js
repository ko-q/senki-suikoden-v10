import test from "node:test";
import assert from "node:assert/strict";
import { Character } from "../src/domain/character.js";
import { createV9UnitProfile } from "../src/definitions/v9-unit-profile.js";
import { UnitAbility as A } from "../src/domain/unit-ability.js";

function character(overrides = {}) {
  return new Character({ id: "test_only", name: "Test", shortName: "T", martial: 50,
    command: 50, intelligence: 50, charisma: 50, source: "test_fixture", ...overrides });
}

test("v9 troop calculation preserves enemy name precedence and future ally exceptions", () => {
  const cases = [["Test", [], 210], ["董超", [], 210], ["祝朝奉", [], 530],
    ["孫立", ["騎乗戦闘"], 125], ["官軍騎兵隊長", ["騎乗戦闘"], 270],
    ["高唐州参謀", [], 150], ["高廉食客・術士", [], 130], ["飛天神兵隊長", [], 290],
    ["飛天歩兵", [], 250], ["飛天騎兵", [], 270], ["飛天弩兵", [], 230],
    ["刺客頭", [], 230], ["刺客", [], 170], ["官兵", ["弓弩術"], 210],
    ["官兵", [], 230], ["Test", ["騎馬戦闘"], 250]];
  for (const [name, combatSkills, expected] of cases) {
    assert.equal(createV9UnitProfile(character({ name, combatSkills }), "ENEMY", 4).maxTroops, expected, name);
  }
  assert.equal(createV9UnitProfile(character({ command: 1 }), "PLAYER", 4).maxTroops, 100);
  assert.equal(createV9UnitProfile(character({ command: 1 }), "ENEMY", 4).maxTroops, 190);
  assert.equal(createV9UnitProfile(character({ command: 100 }), "PLAYER", 4).maxTroops, 150);
});

test("tactic and charge thresholds preserve the v9 boundary values", () => {
  const thresholds = [[49,0], [50,1], [59,1], [60,2], [64,2], [65,3], [69,3], [70,4],
    [79,4], [80,5], [84,5], [85,6], [89,6], [90,7], [94,7], [95,8], [99,8], [100,10]];
  for (const [intelligence, expected] of thresholds) {
    assert.equal(createV9UnitProfile(character({ intelligence }), "PLAYER", 4).maxUses.strategy, expected);
  }
  for (const [command, count] of [[0,1], [69,1], [70,2], [79,2], [80,3], [89,3], [90,4], [99,4], [100,5]]) {
    assert.equal(createV9UnitProfile(character({ command, combatSkills: ["騎乗戦闘"] }), "PLAYER", 4).maxUses.charge, count);
  }
  const at96 = createV9UnitProfile(character({ intelligence: 96 }), "PLAYER", 4);
  const at97 = createV9UnitProfile(character({ intelligence: 97 }), "PLAYER", 4);
  assert.ok(!at96.abilities.includes(A.CONFUSION_LEVEL_3));
  assert.ok(at97.abilities.includes(A.CONFUSION_LEVEL_3));
});

test("skills map to immutable combat profiles without modifying character data", () => {
  const supplied = character({ combatSkills: ["弓弩術", "投擲術", "盾牌戦闘", "水泳", "騎乗戦闘"],
    specialAbilities: ["山野適正", "連環馬"] });
  const before = JSON.stringify(supplied);
  const profile = createV9UnitProfile(supplied, "ENEMY", 5);
  assert.equal(profile.move, 3);
  assert.equal(profile.maxUses.bow, 2);
  for (const ability of [A.BOW_ATTACK, A.THROW_ATTACK, A.SHIELD_COMBAT, A.WATER_TERRAIN_AFFINITY,
    A.WILD_TERRAIN_AFFINITY, A.CHARGE, A.CHAIN_CAVALRY]) assert.ok(profile.abilities.includes(ability));
  assert.ok(Object.isFrozen(profile) && Object.isFrozen(profile.abilities) && Object.isFrozen(profile.maxUses));
  assert.equal(JSON.stringify(supplied), before);
  assert.throws(() => createV9UnitProfile(supplied, "enemy", 4), { code: "V9_PROFILE_AFFILIATION_INVALID" });
});

test("illusion and elemental users preserve their special tactic limits", () => {
  const illusion = createV9UnitProfile(character({ intelligence: 100, specialAbilities: ["幻術"] }), "ENEMY", 4);
  assert.equal(illusion.maxUses.strategy, 6);
  assert.ok(illusion.abilities.includes(A.ILLUSION) && illusion.abilities.includes(A.CONFUSION_LEVEL_1));
  assert.ok(!illusion.abilities.includes(A.CONFUSION_LEVEL_2) && !illusion.abilities.includes(A.WIDE_ILLUSION));
  for (const [special, ability] of [["火計", A.FIRE_TACTIC], ["水計", A.WATER_TACTIC]]) {
    const profile = createV9UnitProfile(character({ intelligence: 100, specialAbilities: [special] }), "PLAYER", 4);
    assert.equal(profile.maxUses.strategy, 2);
    assert.ok(profile.abilities.includes(ability));
    assert.ok(!profile.abilities.includes(A.CONFUSION_LEVEL_1));
  }
});
