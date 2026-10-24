import test from "node:test";
import assert from "node:assert/strict";
import { TerrainInfoView } from "../src/presentation/terrain-info-view.js";
import { UnitAbility } from "../src/domain/unit-ability.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { createServiceStage } from "../test-support/service-fixtures.js";
import { createStageDigest } from "../test-support/fixtures.js";

test("terrain descriptions distinguish largest-of defense, high ground, affinities and chain cavalry", () => {
  const terrain = createV9CompatibleTerrainCatalog(), element = { textContent: "" }, view = new TerrainInfoView(element);
  const stage = createServiceStage({ units: [
    { id: "ordinary", position: { x: 0, y: 0 } },
    { id: "water", position: { x: 1, y: 0 }, abilities: [UnitAbility.WATER_TERRAIN_AFFINITY] },
    { id: "wild", position: { x: 2, y: 0 }, abilities: [UnitAbility.WILD_TERRAIN_AFFINITY] },
    { id: "chain", position: { x: 3, y: 0 }, abilities: [UnitAbility.CHAIN_CAVALRY] }
  ] });
  const before = createStageDigest(stage);
  view.render(terrain.get("hill"), stage.getUnit("ordinary"));
  assert.equal(element.textContent, "地形情報： 丘\n移動2／被ダメージ15%または4の大きい方を軽減／攻撃+3");
  assert.equal(view.describe(terrain.get("forest"), stage.getUnit("wild")), "移動1／被ダメージ30%または8の大きい方を軽減");
  for (const id of ["swamp", "water"]) assert.equal(view.describe(terrain.get(id), stage.getUnit("water")), "移動1／攻防効果なし（水系適性）");
  assert.match(view.describe(terrain.get("swamp"), stage.getUnit("ordinary")), /^移動3／攻撃30%または8の大きい方を低下／被ダメージ30%または8の大きい方を増加$/);
  assert.match(view.describe(terrain.get("swamp"), stage.getUnit("wild")), /^移動2／/);
  assert.match(view.describe(terrain.get("swamp"), stage.getUnit("chain")), /連環馬さらに与ダメージ30%低下.*連環馬さらに20%増加/);
  assert.equal(view.describe(terrain.get("road"), stage.getUnit("chain")), "移動1／連環馬：被ダメージ20%軽減");
  assert.match(view.describe(terrain.get("swamp")), /水系適性部隊：移動1／攻防効果なし/);
  assert.match(view.describe(terrain.get("water")), /進入不可.*水系適性/);
  assert.equal(view.describe(terrain.get("wall")), "進入不可");
  view.render(null); assert.equal(element.textContent, "");
  assert.deepEqual(createStageDigest(stage), before);
});
