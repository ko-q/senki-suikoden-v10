import test from "node:test";
import assert from "node:assert/strict";

import { BattleRandom } from "../src/domain/battle-random.js";

test("BattleRandom reproduces the v9.7.75 xorshift32 sequence", () => {
  const random = new BattleRandom(1);

  assert.equal(random.next(), 270369 / 0x100000000);
  assert.deepEqual(random.exportState(), { algorithm: "xorshift32", state: 270369 });
  assert.equal(random.next(), 67634689 / 0x100000000);
  assert.deepEqual(random.exportState(), { algorithm: "xorshift32", state: 67634689 });
});

test("BattleRandom state can be restored without consuming an extra value", () => {
  const random = new BattleRandom(123456789);
  random.next();
  const savedState = random.exportState();
  const expected = random.next();

  random.importState(savedState);
  assert.equal(random.next(), expected);
  assert.equal(Object.isFrozen(savedState), true);
});

test("BattleRandom rejects invalid state without changing the current state", () => {
  const random = new BattleRandom(7);
  const before = random.exportState();

  assert.throws(
    () => random.importState({ algorithm: "xorshift32", state: 0 }),
    { code: "RANDOM_STATE_INVALID" }
  );
  assert.deepEqual(random.exportState(), before);
});
