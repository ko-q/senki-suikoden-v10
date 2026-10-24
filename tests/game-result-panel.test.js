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
  assert.equal(elements.title.textContent, "勝利");
  assert.equal(elements.message.textContent, "stage.foundation_previewを攻略しました。");
  assert.match(elements.details.textContent, /4ターン目/);
  elements.newBattleButton.dispatch("click");
  assert.equal(restarts, 1);
  panel.hide();
  assert.equal(elements.overlay.hidden, true);
  panel.dispose();
  elements.newBattleButton.dispatch("click");
  assert.equal(restarts, 1);
});


test("defeat and final victory hide next-stage navigation, while a normal victory exposes it", () => {
  const elements = createFakeGameResultElements(), panel = new GameResultPanel({ elements });
  let advances = 0;
  panel.bindHandlers({ onNewBattle() {}, onNextBattle() { advances++; } });
  const result = { outcome: "DEFEAT", turn: 2, phase: "ENEMY" };
  panel.show({ result, stageTitle: "第一章", hasNextStage: true });
  assert.equal(elements.nextBattleButton.hidden, true);
  elements.nextBattleButton.dispatch("click"); assert.equal(advances, 0);
  panel.show({ result: { ...result, outcome: "VICTORY" }, stageTitle: "第一章", hasNextStage: true });
  elements.nextBattleButton.dispatch("click"); assert.equal(advances, 1);
  panel.hide(); elements.nextBattleButton.dispatch("click"); assert.equal(advances, 1);
  panel.show({ result: { ...result, outcome: "VICTORY" }, stageTitle: "最終章", hasNextStage: false });
  assert.equal(elements.nextBattleButton.hidden, true); panel.dispose();
  assert.equal(elements.nextBattleButton.listeners.size, 0);
});
