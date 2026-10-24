import test from "node:test";
import assert from "node:assert/strict";
import { getConfusionLevel, getUsableConfusionLevel } from "../src/domain/unit-capabilities.js";
import { UnitAbility, UnitUse } from "../src/domain/unit-ability.js";
import { confusionLevel } from "../src/presentation/unit-detail-view.js";
import { TacticService } from "../src/services/tactic-service.js";
import { createActionRequest } from "../src/core/action-request.js";
import { createServiceStage } from "../test-support/service-fixtures.js";

test("display, capability and tactic acceptance agree without consuming uses", () => {
  const tactics = new TacticService();
  for (let level = 0; level <= 3; level++) {
    for (let uses = 0; uses <= 4; uses++) {
      const stage = createServiceStage({ units: [
        { id: "actor", army: "PLAYER", position: { x: 0, y: 0 },
          abilities: level ? [UnitAbility[`CONFUSION_LEVEL_${level}`]] : [],
          maxUses: { [UnitUse.TACTIC]: 4 }, remainingUses: { [UnitUse.TACTIC]: uses } },
        { id: "target", position: { x: 1, y: 0 } }
      ] });
      const actor = stage.getUnit("actor"), before = actor.remainingUses;
      assert.equal(getConfusionLevel(actor), level);
      assert.equal(confusionLevel(actor), level);
      assert.equal(getUsableConfusionLevel(actor), Math.min(level, uses));
      for (let requested = 1; requested <= 3; requested++) {
        assert.equal(tactics.canExecute(createActionRequest(`CONFUSION_LV${requested}`, actor, stage.getUnit("target")), stage),
          requested <= level && requested <= uses, `level ${level}, uses ${uses}, request ${requested}`);
      }
      assert.deepEqual(actor.remainingUses, before);
    }
  }
  assert.equal(confusionLevel(null), 0);
});
