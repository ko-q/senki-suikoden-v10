import { invariant } from "./domain-error.js";
import { BattleRandom } from "../domain/battle-random.js";
import { Stage } from "../domain/stage.js";

function copyPosition(position) {
  if (position === null) {
    return null;
  }
  return Object.freeze({ x: position.x, y: position.y });
}

function copyRecord(record) {
  return Object.freeze(Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
  ));
}

/**
 * Stable checkpointで使用する保存可能なBattleSaveDataを生成する。
 */
export function createBattleSaveData(stage, battleRandom) {
  invariant(stage instanceof Stage, "BATTLE_SAVE_STAGE_REQUIRED");
  invariant(battleRandom instanceof BattleRandom, "BATTLE_SAVE_RANDOM_REQUIRED");

  const units = Object.freeze(stage.unitOrder.map((unit) => Object.freeze({
    id: unit.id,
    army: stage.armyManager.getAffiliation(unit),
    troops: unit.troops,
    position: copyPosition(stage.map.getPosition(unit)),
    facing: unit.facing,
    actionState: unit.actionState,
    statusEffects: Object.freeze(unit.statusEffects.map((effect) => Object.freeze({
      type: effect.type,
      remainingTurns: effect.remainingTurns
    }))),
    remainingUses: copyRecord(unit.remainingUses)
  })));

  const hiddenTraps = Object.freeze(stage.getHiddenTraps().map((trap) => Object.freeze({
    id: trap.id,
    kind: trap.kind,
    position: copyPosition(trap.position),
    active: trap.active,
    triggerAffiliations: Object.freeze([...trap.triggerAffiliations])
  })));

  const logs = Object.freeze(stage.battleLog.getEntries().map((entry) => Object.freeze({
    sequence: entry.sequence,
    turn: entry.turn,
    phase: entry.phase,
    type: entry.type,
    text: entry.text,
    unitIds: Object.freeze([...entry.unitIds])
  })));
  const randomState = battleRandom.exportState();

  return Object.freeze({
    stageId: stage.id,
    turn: stage.turn,
    phase: stage.phase,
    randomState: Object.freeze({ ...randomState }),
    units,
    hiddenTraps,
    completedEventIds: Object.freeze([...stage.eventManager.getCompletedEventIds()]),
    logs
  });
}
