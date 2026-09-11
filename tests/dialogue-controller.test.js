import test from "node:test";
import assert from "node:assert/strict";

import { Character } from "../src/domain/character.js";
import { Dialogue, Speech } from "../src/domain/dialogue.js";
import { DialogueController } from "../src/presentation/dialogue-controller.js";

function createDialogue() {
  const speaker = new Character({
    id: "test_speaker",
    name: "Test Speaker",
    shortName: "T",
    martial: 50,
    command: 50,
    intelligence: 50,
    charisma: 50,
    source: "test_fixture"
  });
  return new Dialogue({
    id: "test_dialogue",
    speeches: [
      new Speech({ id: "first", speaker, text: "First." }),
      new Speech({ id: "second", speaker, text: "Second." })
    ]
  });
}

test("DialogueController plays resolved Speech references in order", () => {
  const dialogue = createDialogue();
  const controller = new DialogueController();

  assert.equal(controller.isActive, false);
  assert.equal(controller.getCurrentSpeech(), null);
  assert.equal(controller.start(dialogue), dialogue.speeches[0]);
  assert.equal(controller.dialogue, dialogue);
  assert.equal(controller.currentIndex, 0);
  assert.equal(controller.advance(), dialogue.speeches[1]);
  assert.equal(controller.currentIndex, 1);
  assert.equal(controller.advance(), null);
  assert.equal(controller.isActive, false);
  assert.equal(controller.dialogue, null);
  assert.equal(controller.currentIndex, -1);
});

test("DialogueController finish is idempotent and returns the finished Dialogue", () => {
  const dialogue = createDialogue();
  const controller = new DialogueController();
  controller.start(dialogue);

  assert.equal(controller.finish(), dialogue);
  assert.equal(controller.finish(), null);
});
