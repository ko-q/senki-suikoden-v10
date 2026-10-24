import { invariant, requireEnumValue, requireIntegerInRange } from "../core/domain-error.js";
import { Character } from "../domain/character.js";
import { Affiliation } from "../domain/army.js";
import { UnitAbility as A, UnitUse } from "../domain/unit-ability.js";

const futureAllies = new Set(["孫立", "孫新", "顧大嫂", "解珍", "解宝", "鄒淵", "鄒潤", "楽和", "郁保四"]);
const enemyBase = new Map(Object.entries({
  "祝朝奉": 500, "董超": 180, "薛覇": 180, "楊志": 220, "秦明": 240, "黄信": 220,
  "欒廷玉": 240, "祝龍": 220, "祝虎": 220, "祝彪": 220, "扈三娘": 220,
  "黄文炳": 160, "蔡得章": 300, "刑場執行官": 250, "高廉": 400, "于直": 220,
  "温文宝": 230, "薛元輝": 240, "梁世傑": 320, "李成": 260, "聞達": 260,
  "曾弄": 340, "史文恭": 320, "蘇定": 240, "曾塗": 250, "曾密": 240,
  "曾索": 240, "曾魁": 250, "曾昇": 230
}));

function enemyTroops(character, skills) {
  const { name, command } = character;
  if (futureAllies.has(name)) return 100 + Math.floor(command * .5);
  let base = enemyBase.get(name);
  if (base === undefined) {
    const rules = [
      [name.includes("飛天神兵"), 260], [name.includes("飛天歩兵"), 220],
      [name.includes("飛天騎兵"), 240], [name.includes("飛天弩兵"), 200],
      [name.includes("高廉食客・術士"), 100], [name.includes("高唐州参謀"), 120],
      [name.includes("隊長") || name.includes("守将"), 240],
      [name.includes("参謀") || name.includes("術師"), 160],
      [name.includes("刺客頭"), 200], [name.includes("刺客"), 140],
      [name.includes("弓兵") || name.includes("弩兵") || skills.includes("弓弩"), 180],
      [name.includes("騎兵") || skills.includes("騎乗戦闘") || skills.includes("騎馬戦闘"), 220],
      [name.includes("官兵") || name.includes("守備兵") || name.includes("執行官"), 200],
      [name.includes("護送兵") || name.includes("祝家荘兵"), 180]
    ];
    base = rules.find(([matches]) => matches)?.[1] ?? 180;
  }
  return base + Math.ceil(command * .5 / 10) * 10;
}

/** v9 u()/Unit rules applied to supplied character data; contains no named character stats.
 * Stage-only abilities (wide illusion, trap awareness, elemental damage overrides) are separate.
 */
export function createV9UnitProfile(character, affiliation, move) {
  invariant(character instanceof Character, "V9_PROFILE_CHARACTER_REQUIRED");
  requireEnumValue(affiliation, Affiliation, "V9_PROFILE_AFFILIATION_INVALID");
  requireIntegerInRange(move, 0, Number.MAX_SAFE_INTEGER, "V9_PROFILE_MOVE_INVALID");
  const skills = character.combatSkills.join("・");
  const special = character.specialAbilities.join("・");
  const abilities = [];
  const add = (condition, ability) => { if (condition) abilities.push(ability); };
  const bow = skills.includes("弓弩"), throwing = skills.includes("投擲術");
  const charge = skills.includes("騎乗戦闘") || skills.includes("騎馬戦闘");
  const illusion = special.includes("幻術"), fire = special.includes("火計"), water = special.includes("水計");
  const chain = special.includes("連環馬");
  add(bow, A.BOW_ATTACK); add(throwing, A.THROW_ATTACK); add(charge, A.CHARGE);
  add(skills.includes("盾牌戦闘"), A.SHIELD_COMBAT); add(chain, A.CHAIN_CAVALRY);
  add([skills, special].some((text) => ["水泳", "水中戦", "水軍適正"].some((key) => text.includes(key))), A.WATER_TERRAIN_AFFINITY);
  add(special.includes("山野適正"), A.WILD_TERRAIN_AFFINITY);
  add(illusion, A.ILLUSION); add(fire, A.FIRE_TACTIC); add(water, A.WATER_TACTIC);
  const intelligence = character.intelligence;
  const level = illusion ? 1 : fire || water ? 0 : intelligence >= 97 ? 3 : intelligence >= 90 ? 2 : intelligence >= 50 ? 1 : 0;
  for (let n = 1; n <= level; n++) abilities.push(A[`CONFUSION_LEVEL_${n}`]);
  const points = [[100, 10], [95, 8], [90, 7], [85, 6], [80, 5], [70, 4], [65, 3], [60, 2], [50, 1]];
  const command = character.command;
  return Object.freeze({
    maxTroops: affiliation === Affiliation.ENEMY ? enemyTroops(character, skills) : 100 + Math.floor(command * .5),
    move: chain ? 3 : move,
    abilities: Object.freeze(abilities),
    maxUses: Object.freeze({
      [UnitUse.PROJECTILE]: bow || throwing ? 2 : 0,
      [UnitUse.CHARGE]: charge ? command >= 100 ? 5 : command >= 90 ? 4 : command >= 80 ? 3 : command >= 70 ? 2 : 1 : 0,
      [UnitUse.TACTIC]: illusion ? 6 : fire || water ? 2 : points.find(([minimum]) => intelligence >= minimum)?.[1] ?? 0
    })
  });
}
