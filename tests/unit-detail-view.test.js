import test from "node:test";
import assert from "node:assert/strict";
import { UnitDetailView } from "../src/presentation/unit-detail-view.js";
import { createV9CharacterManager } from "../src/definitions/v9-characters.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { FakeElement, installFakeDocument } from "../test-support/fake-battle-dom.js";
import { createStageDigest } from "../test-support/fixtures.js";

const text = element => element.textContent + element.children.map(text).join(" ");

test("opening chapter detail cards retain V9 aliases, isolate input and restore focus without changing battle state", () => {
  const restore = installFakeDocument();
  const characters = createV9CharacterManager();
  try {
    for (const [chapter, characterId, alias] of [[0, "shi_jin", "九紋龍"], [1, "lin_chong", "豹子頭"]]) {
      const definition = createV9OpeningStageDefinition(V9_OPENING_STAGE_SOURCE[chapter].id, characters);
      const stage = new StageFactory({ definitions: [definition], characterManager: characters,
        terrainCatalog: createV9CompatibleTerrainCatalog() }).create(definition.id);
      const unit = stage.getUnits().find(unit => unit.character.id === characterId);
      const before = createStageDigest(stage);
      const host = new FakeElement(), background = new FakeElement(), blocked = new FakeElement();
      const root = new FakeElement(), opener = new FakeElement();
      host.append(background, blocked, root); blocked.inert = true;
      root.ownerDocument = { activeElement: opener };
      root.querySelectorAll = () => [];
      opener.isConnected = true;
      for (const element of [root, opener]) element.focus = options => {
        assert.equal(options.preventScroll, true); root.ownerDocument.activeElement = element;
      };
      const view = new UnitDetailView(root);
      try {
        view.show(unit, stage, undefined, { keyboard: true });
        assert.match(text(root), new RegExp(alias));
        assert.match(text(root), new RegExp(unit.character.name));
        assert.equal(background.inert, true); assert.equal(blocked.inert, true);
        assert.equal(root.ownerDocument.activeElement, root);
        root.dispatch("keydown", { key: "Tab" });
        assert.equal(root.ownerDocument.activeElement, root);
        root.dispatch("keydown", { key: "Escape" });
        assert.equal(root.hidden, true); assert.equal(background.inert, false); assert.equal(blocked.inert, true);
        assert.equal(root.ownerDocument.activeElement, opener);
        view.show(unit, stage, undefined, { keyboard: true });
        view.dispose();
        assert.equal(background.inert, false); assert.equal(blocked.inert, true);
        assert.equal(root.ownerDocument.activeElement, root, "disposing a battle must not refocus its old controls");
        assert.equal(root.listeners.size, 0);
        assert.equal(createStageDigest(stage), before);
      } finally { view.dispose(); }
    }
  } finally { restore(); }
});
