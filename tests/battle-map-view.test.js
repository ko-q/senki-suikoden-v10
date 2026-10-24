import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { V9_STAGE_MAP_DEFINITIONS, getV9StageMapDefinition } from "../src/definitions/v9-stage-maps.js";
import { BattleMapView, resolveStageMapAsset } from "../src/presentation/battle-map-view.js";
import { BattleSessionFactory } from "../src/orchestration/battle-session-factory.js";
import { BattleViewFactory } from "../src/presentation/battle-view.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { createMapStage } from "../test-support/map-fixtures.js";
import { createStageDigest } from "../test-support/fixtures.js";
import { FakeElement, createFakeBattleViewTemplate, installFakeDocument } from "../test-support/fake-battle-dom.js";

function trackImages() {
  const images = [];
  const previous = globalThis.document.createElement;
  globalThis.document.createElement = (tag) => {
    const element = previous(tag);
    if (tag === "img") images.push(element);
    return element;
  };
  return images;
}

test("all nine terrain grids resolve exactly to their adopted map assets", () => {
  assert.equal(V9_STAGE_MAP_DEFINITIONS.length, 9);
  assert.equal(V9_STAGE_MAP_DEFINITIONS.reduce((n, d) => n + d.rows * d.columns, 0), 1248);
  for (const definition of V9_STAGE_MAP_DEFINITIONS) {
    const stage = createMapStage(definition);
    const before = createStageDigest(stage);
    const asset = resolveStageMapAsset(stage);
    assert.equal(asset.id, definition.mapKey);
    assert.equal(asset.stageId, definition.stageId);
    assert.equal(asset.rows, stage.map.height);
    assert.equal(createHash("sha256").update(JSON.stringify(definition.map)).digest("hex"), definition.terrainSha256);
    assert.ok(Object.isFrozen(definition.map) && definition.map.every(Object.isFrozen));
    assert.equal(createStageDigest(stage), before);
  }
  const fourth = getV9StageMapDefinition("qingfeng-fort");
  assert.equal(fourth.sourceRows, 8);
  assert.equal(fourth.rows, 16);
  for (let y = 0; y < 16; y += 2) assert.deepEqual(fourth.map[y], fourth.map[y + 1]);
  const ninth = getV9StageMapDefinition("zengtou-fortress");
  assert.equal(ninth.rows, 20);
  assert.equal(ninth.map[19][1], "road");
});

test("unknown stages use terrain colors and known stages reject wrong grids", () => {
  const definition = V9_STAGE_MAP_DEFINITIONS[0];
  assert.equal(resolveStageMapAsset(createMapStage(definition, { id: "fixture" })), null);
  assert.throws(() => resolveStageMapAsset(createMapStage(definition, { chapterNumber: 2 })),
    { code: "BATTLE_MAP_VIEW_DIMENSIONS_MISMATCH" });
  assert.throws(() => resolveStageMapAsset(createMapStage(definition, { map: [["plain"]] })),
    { code: "BATTLE_MAP_VIEW_DIMENSIONS_MISMATCH" });
  const changedMap = definition.map.map((row) => [...row]);
  changedMap[0][0] = "plain";
  assert.throws(() => resolveStageMapAsset(createMapStage(definition, { map: changedMap })),
    { code: "BATTLE_MAP_VIEW_TERRAIN_MISMATCH" });
});

test("background becomes transparent only after loading and survives ordinary redraws", () => {
  const restore = installFakeDocument();
  try {
    const images = trackImages();
    const board = new FakeElement();
    const view = new BattleMapView(board);
    const stage = createMapStage(V9_STAGE_MAP_DEFINITIONS[0]);
    view.render(stage);
    assert.equal(board.dataset.mapReady, "false");
    images[0].dispatch("load");
    assert.equal(board.dataset.mapReady, "true");
    assert.equal(board.style.backgroundSize, "112.5% 112.5%");
    assert.equal(board.style.backgroundPosition, "50% 25%");
    assert.equal(images[0].listeners.size, 0);
    board.replaceChildren();
    view.render(stage);
    assert.equal(images.length, 1);
    assert.equal(board.dataset.mapReady, "true");
    view.clear();
    assert.equal(board.style.backgroundImage, "");
  } finally { restore(); }
});

test("late loads and errors cannot repaint the replacement battle", () => {
  const restore = installFakeDocument();
  try {
    const images = trackImages();
    const board = new FakeElement();
    const view = new BattleMapView(board);
    view.render(createMapStage(V9_STAGE_MAP_DEFINITIONS[0]));
    const staleLoad = [...images[0].listeners.get("load")][0];
    view.render(createMapStage(V9_STAGE_MAP_DEFINITIONS[1]));
    assert.equal(images[0].listeners.size, 0);
    images[1].dispatch("load");
    staleLoad();
    assert.equal(board.dataset.mapKey, "chapter_2");
    view.render(createMapStage(V9_STAGE_MAP_DEFINITIONS[2]));
    const removedLoad = [...images[2].listeners.get("load")][0];
    images[2].dispatch("error");
    removedLoad();
    assert.equal(board.dataset.mapReady, "false");
    assert.equal(board.style.backgroundImage, "");
    view.clear();
  } finally { restore(); }
});

test("session validation rejects a mismatched map before activation and removes pending image listeners", () => {
  const restore = installFakeDocument();
  try {
    const images = trackImages();
    const host = new FakeElement();
    const { template, createdViews } = createFakeBattleViewTemplate();
    const factory = new BattleSessionFactory({ viewFactory: new BattleViewFactory({ host, template }) });
    const valid = factory.create(createMapStage(V9_STAGE_MAP_DEFINITIONS[0]), new BattleRandom(1));
    valid.validateConnection();
    valid.activate();
    const displayed = host.children[0];
    const invalid = factory.create(createMapStage(V9_STAGE_MAP_DEFINITIONS[0], { map: [["plain"]] }), new BattleRandom(2));
    assert.throws(() => invalid.validateConnection(), { code: "BATTLE_MAP_VIEW_DIMENSIONS_MISMATCH" });
    invalid.dispose();
    assert.equal(host.children[0], displayed);
    const lateLoad = [...images[0].listeners.get("load")][0];
    valid.dispose();
    lateLoad();
    assert.equal(images[0].listeners.size, 0);
    assert.equal(createdViews[0].elements.board.dataset.mapReady, "false");
  } finally { restore(); }
});
