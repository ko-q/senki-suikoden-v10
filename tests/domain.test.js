import test from "node:test";
import assert from "node:assert/strict";

import { Affiliation } from "../src/domain/army.js";
import { Character, CharacterManager } from "../src/domain/character.js";
import { Position } from "../src/domain/position.js";
import { UnitActionState, UnitStatus } from "../src/domain/unit.js";
import { createStage } from "../test-support/fixtures.js";

test("CharacterManager rejects duplicate character IDs", () => {
  const character = new Character({
    id: "test_character",
    name: "Test Character",
    shortName: "T",
    martial: 50,
    command: 50,
    intelligence: 50,
    charisma: 50
  });

  assert.throws(
    () => new CharacterManager([character, character]),
    { code: "CHARACTER_ID_DUPLICATE" }
  );
});

test("Unit omits position, affiliation and duplicated lifecycle fields", () => {
  const stage = createStage();
  const unit = stage.getUnit("test_stage_player");
  const forbiddenProperties = [
    "x",
    "y",
    "team",
    "army",
    "isAlive",
    "isDeployed",
    "moveOrigin"
  ];

  for (const property of forbiddenProperties) {
    assert.equal(property in unit, false, property);
  }
  assert.equal(unit.hasTroops(), true);
  assert.deepEqual(stage.map.getPosition(unit), new Position(0, 1));
  assert.equal(stage.armyManager.getAffiliation(unit), Affiliation.PLAYER);
});

test("Unit enforces action transitions, independent statuses and use counts", () => {
  const stage = createStage();
  const unit = stage.getUnit("test_stage_player");

  unit.transitionActionState(UnitActionState.MOVED);
  assert.equal(unit.actionState, UnitActionState.MOVED);
  assert.throws(
    () => unit.transitionActionState(UnitActionState.READY),
    { code: "UNIT_ACTION_TRANSITION_INVALID" }
  );
  unit.transitionActionState(UnitActionState.TACTIC_COMMITTED);
  unit.transitionActionState(UnitActionState.FINISHED);
  unit.transitionActionState(UnitActionState.READY);

  unit.setStatus(UnitStatus.CONFUSED, 2);
  unit.setStatus(UnitStatus.ILLUSION, 1);
  assert.deepEqual(unit.statusEffects, [
    { type: UnitStatus.CONFUSED, remainingTurns: 2 },
    { type: UnitStatus.ILLUSION, remainingTurns: 1 }
  ]);
  unit.setStatus(UnitStatus.ILLUSION, 0);
  assert.equal(unit.getStatusTurns(UnitStatus.CONFUSED), 2);
});

test("BattleMap keeps its cell occupancy and position index consistent", () => {
  const stage = createStage();
  const unit = stage.getUnit("test_stage_player");
  const firstRead = stage.map.getPosition(unit);
  const secondRead = stage.map.getPosition(unit);

  assert.notEqual(firstRead, secondRead);
  assert.equal(Object.isFrozen(firstRead), true);
  stage.map.moveUnit(unit, new Position(1, 1));
  assert.equal(stage.map.getCellAt(0, 1).occupant, null);
  assert.equal(stage.map.getCellAt(1, 1).occupant, unit);
  assert.deepEqual(stage.map.getPosition(unit), new Position(1, 1));
  assert.equal(stage.map.validateConsistency(stage.getUnits()), true);

  assert.equal(stage.map.removeUnit(unit), true);
  assert.equal(stage.map.removeUnit(unit), false);
  assert.equal(stage.map.getPosition(unit), null);
  assert.equal(stage.map.validateConsistency(stage.getUnits()), true);
});

test("A defeated Unit remains in its Army and is removed only from BattleMap", () => {
  const stage = createStage();
  const unit = stage.getUnit("test_stage_player");
  const army = stage.armyManager.getArmy(unit);

  unit.applyDamage(unit.maxTroops);
  stage.map.removeUnit(unit);

  assert.equal(unit.hasTroops(), false);
  assert.equal(stage.map.getPosition(unit), null);
  assert.equal(stage.armyManager.getArmy(unit), army);
  assert.equal(stage.validateRuntime(), true);
});

test("ArmyManager transfers affiliation without changing Stage.unitOrder", () => {
  const stage = createStage();
  const unit = stage.getUnit("test_stage_enemy");
  const originalOrder = [...stage.unitOrder];

  assert.equal(stage.armyManager.transferUnit(unit, stage.armyManager.playerArmy), true);
  assert.equal(stage.armyManager.getAffiliation(unit), Affiliation.PLAYER);
  assert.deepEqual(stage.unitOrder, originalOrder);
  assert.equal(stage.armyManager.playerArmy.getUnits().includes(unit), true);
  assert.equal(stage.armyManager.enemyArmy.getUnits().includes(unit), false);
});
