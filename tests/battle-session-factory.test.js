import test from "node:test";
import assert from "node:assert/strict";

import { GAME_VERSION } from "../src/config/version.js";
import { PresentationRequestType } from "../src/core/presentation-request.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { BattleSessionFactory } from "../src/orchestration/battle-session-factory.js";
import { BattleViewFactory } from "../src/presentation/battle-view.js";
import {
  FakeElement,
  createFakeBattleViewTemplate,
  installFakeDocument
} from "../test-support/fake-battle-dom.js";
import { Affiliation, createServiceStage } from "../test-support/service-fixtures.js";

function stage() {
  return createServiceStage({
    id: "session_factory",
    map: [["plain", "plain"]],
    units: [
      { id: "actor", army: Affiliation.PLAYER, position: { x: 0, y: 0 } },
      { id: "enemy", army: Affiliation.ENEMY, position: { x: 1, y: 0 } }
    ]
  });
}

test("BattleSessionFactory creates a detached complete session with the current build", () => {
  const restoreDocument = installFakeDocument();
  try {
    const host = new FakeElement();
    const { template, createdViews } = createFakeBattleViewTemplate();
    const factory = new BattleSessionFactory({
      viewFactory: new BattleViewFactory({ host, template })
    });
    const session = factory.create(stage(), new BattleRandom(1));

    assert.equal(createdViews.length, 1);
    assert.equal(host.children.length, 0);
    assert.equal(session.isConnected, false);
    assert.equal(createdViews[0].elements.versionValue.textContent, GAME_VERSION);
    session.dispose();
    assert.equal(createdViews[0].root.removeCount, 1);
  } finally {
    restoreDocument();
  }
});

test("BattleSessionFactory disposes its detached view when construction fails", () => {
  const restoreDocument = installFakeDocument();
  try {
    const host = new FakeElement();
    const { template, createdViews } = createFakeBattleViewTemplate();
    const factory = new BattleSessionFactory({
      viewFactory: new BattleViewFactory({ host, template }),
      effectDurations: { [PresentationRequestType.MOVE]: -1 }
    });

    assert.throws(
      () => factory.create(stage(), new BattleRandom(1)),
      { code: "BATTLE_EFFECT_DURATION_INVALID" }
    );
    assert.equal(createdViews.length, 1);
    assert.equal(createdViews[0].root.removeCount, 1);
    assert.equal(host.children.length, 0);
  } finally {
    restoreDocument();
  }
});
