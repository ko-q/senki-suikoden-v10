import test from "node:test";
import assert from "node:assert/strict";
import { ActionType } from "../src/core/action-request.js";
import { createSemanticPresentationRequest, PresentationRequestType } from "../src/core/presentation-request.js";
import { ActionCutInSession, getActionCutIn, V9_ACTION_CUT_IN_TIMING } from "../src/presentation/action-cut-in.js";
import { BattleEffectManager } from "../src/presentation/battle-effect-manager.js";
import { BattleRenderer } from "../src/presentation/battle-renderer.js";
import { UnitAbility } from "../src/domain/unit-ability.js";
import { Affiliation } from "../src/domain/army.js";
import { createServiceStage } from "../test-support/service-fixtures.js";
import { createStageDigest } from "../test-support/fixtures.js";
import { FakeElement, createFakeBattleElements, installFakeDocument } from "../test-support/fake-battle-dom.js";

function setup() {
  const stage = createServiceStage({ units: [{
    id: "archer", position: { x: 0, y: 0 }, character: { name: "花栄" },
    abilities: [UnitAbility.BOW_ATTACK]
  }] });
  const host = new FakeElement();
  const session = new ActionCutInSession({ stage, host });
  const request = createSemanticPresentationRequest(PresentationRequestType.ACTION,
    { actorId: "archer", actionType: ActionType.BOW_ATTACK, targetId: "target",
      actorPosition: { x: 0, y: 0 }, targetPosition: { x: 0, y: 2 },
      actorAffiliation: Affiliation.ENEMY, actorIsMob: true, forced: false });
  return { stage, host, session, request };
}

test("cut-in preserves v9 lines, projectile labels, timing and normal-attack exclusion", () => {
  const { stage } = setup();
  assert.equal(getActionCutIn(stage.getUnit("archer"), ActionType.BOW_ATTACK).text,
    "この一矢、外しはしない！");
  assert.equal(getActionCutIn(stage.getUnit("archer"), ActionType.NORMAL_ATTACK), null);
  assert.equal(V9_ACTION_CUT_IN_TIMING.DISPLAY_MS, 680);
  const actor = stage.getUnit("archer");
  assert.equal(getActionCutIn(actor, ActionType.BOW_ATTACK, Affiliation.PLAYER).gapMs, 80);
  assert.equal(getActionCutIn(actor, ActionType.BOW_ATTACK, Affiliation.ENEMY).gapMs, 70);
  assert.equal(getActionCutIn(actor, ActionType.CHARGE, Affiliation.ENEMY).gapMs, 0);
  assert.equal(getActionCutIn(actor, ActionType.CHARGE, Affiliation.PLAYER).gapMs, 80);
  assert.equal(getActionCutIn(actor, ActionType.ILLUSION, Affiliation.ENEMY).gapMs, 80);
  const thrower = createServiceStage({ units: [{ id: "thrower", position: { x: 0, y: 0 },
    abilities: [UnitAbility.THROW_ATTACK] }] }).getUnit("thrower");
  assert.equal(getActionCutIn(thrower, ActionType.BOW_ATTACK).actionLabel, "投擲");
});

test("a timed cut-in removes its DOM without modifying the battle", async () => {
  const restore = installFakeDocument();
  try {
    const { stage, host, session, request } = setup();
    const before = createStageDigest(stage);
    const pending = session.present(request, new AbortController().signal, 0);
    assert.equal(host.children.length, 1);
    assert.equal(host.children[0].children[0].children[2].textContent, "この一矢、外しはしない！");
    assert.equal(await pending, true);
    assert.equal(host.children.length, 0);
    assert.equal(createStageDigest(stage), before);
    session.dispose();
  } finally { restore(); }
});

test("disposing or aborting a cut-in cancels its wait and never starts action audio", async () => {
  const restore = installFakeDocument();
  try {
    for (const cancel of ["dispose", "abort"]) {
      const { host, session, request } = setup();
      const signal = new AbortController();
      let audioCount = 0;
      const manager = new BattleEffectManager({ renderer: new BattleRenderer(createFakeBattleElements()),
        cutInSession: session, audioSession: { present() { audioCount++; }, dispose() {} } });
      const pending = manager.present(request, signal.signal);
      const rejected = assert.rejects(pending, { name: "AbortError" });
      assert.equal(audioCount, 0);
      if (cancel === "dispose") manager.dispose(); else signal.abort();
      await rejected;
      assert.equal(host.children.length, 0);
      assert.equal(audioCount, 0);
      manager.dispose();
    }
  } finally { restore(); }
});

test("action sound and visuals start after the cut-in and share the same request", async () => {
  const restore = installFakeDocument();
  try {
    const { host, session, request } = setup();
    const events = [];
    const manager = new BattleEffectManager({ renderer: new BattleRenderer(createFakeBattleElements()),
      durations: { [PresentationRequestType.ACTION]: 0 }, cutInSession: session,
      audioSession: { present(actual) {
        assert.equal(actual, request);
        assert.equal(host.children.length, 0);
        events.push("audio");
        return { complete() { events.push("complete"); } };
      }, dispose() {} },
      visualSession: { async present(actual) {
        assert.equal(actual, request);
        events.push("visual"); return true;
      }, dispose() {} }
    });
    const pending = manager.present(request, new AbortController().signal);
    assert.deepEqual(events, []);
    await pending;
    assert.deepEqual(events, ["audio", "visual", "complete"]);
    manager.dispose();
  } finally { restore(); }
});
