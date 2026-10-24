import test from "node:test";
import assert from "node:assert/strict";
import { CharacterPortraitView } from "../src/presentation/character-portrait-view.js";
import { FakeElement, installFakeDocument } from "../test-support/fake-battle-dom.js";

test("portrait replacement removes old listeners and ignores a late image failure", () => {
  const restore = installFakeDocument();
  try {
    const host = new FakeElement();
    const view = new CharacterPortraitView(host);
    const first = Object.freeze({ name: "宋江", portraitKey: "song_jiang" });
    const second = Object.freeze({ name: "花栄", portraitKey: "hua_rong" });
    view.render(first);
    const oldImage = host.children[0];
    const lateError = [...oldImage.listeners.get("error")][0];
    view.render(first);
    assert.equal(host.children[0], oldImage, "ordinary redraw must not restart image loading");
    view.render(second);
    assert.equal(oldImage.listeners.size, 0);
    lateError();
    assert.equal(host.hidden, false);
    assert.equal(host.children[0].alt, "花栄");
    host.children[0].dispatch("error");
    assert.equal(host.hidden, true);
    assert.equal(host.children.length, 0);
    view.render(first);
    const activeImage = host.children[0];
    view.dispose();
    view.dispose();
    assert.equal(activeImage.listeners.size, 0);
    view.render(second);
    assert.equal(host.hidden, true);
    assert.equal(host.children.length, 0);
  } finally { restore(); }
});

test("unknown portrait keys clear the previous speaker without guessing an image", () => {
  const restore = installFakeDocument();
  try {
    const host = new FakeElement();
    const view = new CharacterPortraitView(host);
    view.render({ name: "宋江", portraitKey: "song_jiang" });
    view.render({ id: "song_jiang", name: "宋江", portraitKey: "" });
    assert.equal(host.hidden, true);
    view.render(null);
    assert.equal(host.children.length, 0);
  } finally { restore(); }
});
