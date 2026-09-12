import test from "node:test";
import assert from "node:assert/strict";

import { BattleOutcome } from "../src/core/battle-result.js";
import { GameResultPanel } from "../src/presentation/game-result-panel.js";
import { createFakeGameResultElements } from "../test-support/fake-battle-dom.js";

test("GameResultPanel renders immutable result data and owns its restart handler", () => {
  const elements = createFakeGameResultElements();
  let restarts = 0;
  const panel = new GameResultPanel({ elements });
  panel.bindHandlers({
    onNewBattle: () => {
      restarts += 1;
    }
  });
  panel.show({
    result: Object.freeze({
      stageId: "foundation_preview",
      outcome: BattleOutcome.VICTORY,
      objectiveId: "development_victory",
      turn: 4,
      phase: "PLAYER"
    }),
    stageTitle: "stage.foundation_preview"
  });

  assert.equal(elements.overlay.hidden, false);
  assert.equal(elements.title.textContent, "Victory");
  assert.equal(elements.message.textContent, "stage.foundation_preview");
  assert.match(elements.details.textContent, /Turn 4/);
  elements.newBattleButton.dispatch("click");
  assert.equal(restarts, 1);
  panel.hide();
  assert.equal(elements.overlay.hidden, true);
  panel.dispose();
  elements.newBattleButton.dispatch("click");
  assert.equal(restarts, 1);
});
