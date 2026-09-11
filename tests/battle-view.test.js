import test from "node:test";
import assert from "node:assert/strict";

import { BattleViewFactory } from "../src/presentation/battle-view.js";
import {
  FakeElement,
  createFakeBattleViewTemplate
} from "../test-support/fake-battle-dom.js";

test("BattleViewFactory builds detached roots and activates exactly one view", () => {
  const host = new FakeElement();
  const { template, createdViews } = createFakeBattleViewTemplate();
  const factory = new BattleViewFactory({ host, template });
  const first = factory.create();
  const second = factory.create();

  assert.equal(createdViews.length, 2);
  assert.equal(first.root.parentNode, null);
  assert.equal(second.root.parentNode, null);
  first.activate();
  assert.equal(host.children[0], first.root);
  assert.equal(first.isActive, true);

  second.activate();
  assert.equal(host.children[0], second.root);
  assert.equal(first.root.parentNode, null);
  assert.equal(second.root.parentNode, host);
  first.dispose();
  assert.equal(host.children[0], second.root);
  second.dispose();
  assert.equal(host.children.length, 0);
});

test("BattleViewFactory rejects a template missing a required Battle element", () => {
  const host = new FakeElement();
  const root = new FakeElement({ selectorMap: new Map() });
  const fragment = new FakeElement({
    selectorMap: new Map([["[data-battle-view-root]", root]])
  });
  const factory = new BattleViewFactory({
    host,
    template: { content: { cloneNode: () => fragment } }
  });

  assert.throws(() => factory.create(), { code: "BATTLE_VIEW_ELEMENT_MISSING" });
  assert.equal(host.children.length, 0);
});
