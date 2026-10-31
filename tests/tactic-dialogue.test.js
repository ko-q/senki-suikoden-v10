import test from "node:test";
import assert from "node:assert/strict";
import { createTacticSuccessDialogue } from "../src/factories/tactic-dialogue-factory.js";
import { BattlePresentationFactory } from "../src/factories/battle-presentation-factory.js";
import { createServiceStage } from "../test-support/service-fixtures.js";
import { createStageDigest } from "../test-support/fixtures.js";
import { TacticService } from "../src/services/tactic-service.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { UnitAbility } from "../src/domain/unit-ability.js";

function setup(name = "朱武") {
  const stage = createServiceStage({ units: [
    { id: "caster", army: "PLAYER", position: { x: 0, y: 0 }, character: { name, intelligence: 100 },
      abilities: [UnitAbility.CONFUSION_LEVEL_3, UnitAbility.ILLUSION, UnitAbility.WIDE_ILLUSION], maxUses: { strategy: 6 } },
    { id: "centre", position: { x: 2, y: 0 }, character: { intelligence: 0 } },
    { id: "other", position: { x: 3, y: 0 }, character: { intelligence: 0 } }
  ] });
  return { stage, actor: stage.getUnit("caster"), target: stage.getUnit("centre"), other: stage.getUnit("other") };
}

test("tactic result dialogue follows successful targets, including a failed centre and wide illusion", () => {
  const { actor, target, other } = setup();
  for (const type of ["CONFUSION_LV1", "CONFUSION_LV2", "CONFUSION_LV3", "ILLUSION", "WIDE_ILLUSION"]) {
    const result = { type, actor, target, successfulTargets: [other, target] };
    const dialogue = createTacticSuccessDialogue(result);
    assert.equal(dialogue.speeches[1].speaker, target.character);
    assert.match(dialogue.speeches[0].text, /2隊/);
    assert.equal(createTacticSuccessDialogue({ ...result, successfulTargets: [other] }).speeches[1].speaker, other.character);
    assert.equal(createTacticSuccessDialogue({ ...result, target: actor }).speeches[1].speaker, other.character);
    assert.equal(createTacticSuccessDialogue({ ...result, successfulTargets: [] }), null);
  }
  for (const type of ["NORMAL_ATTACK", "CHARGE", "FIRE", "WATER"]) {
    assert.equal(createTacticSuccessDialogue({ type, actor, target, successfulTargets: [target] }), null);
  }
});

test("V9 named casters retain their distinct success lines", () => {
  for (const [name, type, single, multiple] of [
    ["呉用", "CONFUSION_LV2", "よし、策は成った。敵陣の指図はもはや通らぬ。", "よし、策は成った。2隊の指図はもはや通らぬ。"],
    ["公孫勝", "ILLUSION", "術は成りました。しばし幻の中に沈みなさい。", "2隊を幻の中へ封じました。今こそ妖陣を崩す時です。"],
    ["高廉", "WIDE_ILLUSION", "ククク……我が妖術に囚われたな！", "ククク……2隊まとめて我が妖術に囚われたな！"]
  ]) {
    const { actor, target, other } = setup(name);
    assert.equal(createTacticSuccessDialogue({ type, actor, target, successfulTargets: [target] }).speeches[0].text, single);
    assert.equal(createTacticSuccessDialogue({ type, actor, target, successfulTargets: [target, other] }).speeches[0].text, multiple);
  }
});

test("resolved tactic presents status then dialogue without changing troops, effects, uses or RNG", () => {
  const { stage, actor, target } = setup(), random = new BattleRandom(1);
  const result = new TacticService().execute({ type: "CONFUSION_LV2", actor, target }, stage, random);
  const before = createStageDigest(stage), randomBefore = random.exportState();
  const requests = new BattlePresentationFactory(stage).actionResult(actor, result.type, result);
  assert.deepEqual(requests.map(request => request.type), ["STATUS", "DIALOGUE"]);
  assert.equal(requests[1].dialogue.speeches[0].actionLabel, "撹乱成功");
  assert.equal(createStageDigest(stage), before);
  assert.deepEqual(random.exportState(), randomBefore);
  // Reapplying successfully at an existing duration still has a result dialogue.
  const unchanged = { ...result, targetResults: result.targetResults.map(entry => ({
    ...entry, statusEffects: { before: entry.statusEffects.after, after: entry.statusEffects.after }
  })) };
  assert.deepEqual(new BattlePresentationFactory(stage).actionResult(actor, result.type, unchanged).map(request => request.type), ["DIALOGUE"]);
});
