import { invariant } from "../core/domain-error.js";
import { BattleRandom } from "../domain/battle-random.js";
import { HiddenTrap, HiddenTrapKind } from "../domain/hidden-trap.js";
import { Position } from "../domain/position.js";
import { UnitAbility } from "../domain/unit-ability.js";
import { Unit, UnitStatus } from "../domain/unit.js";

export const HiddenTrapEffect = Object.freeze({
  [HiddenTrapKind.NORMAL]: Object.freeze({
    damage: 20,
    statusType: UnitStatus.CONFUSED,
    statusTurns: 1,
    immunityAbilityId: null
  }),
  [HiddenTrapKind.SPELL]: Object.freeze({
    damage: 10,
    statusType: UnitStatus.ILLUSION,
    statusTurns: 1,
    immunityAbilityId: UnitAbility.ILLUSION
  })
});

function generatedTrapId(definition, slotIndex) {
  if (definition.count === 1) {
    return definition.id;
  }
  return `${definition.id}_${slotIndex + 1}`;
}

function validateGeneratedIdNamespace(definitions) {
  const ids = new Set();
  for (const definition of definitions) {
    for (let slotIndex = 0; slotIndex < definition.count; slotIndex += 1) {
      const id = generatedTrapId(definition, slotIndex);
      invariant(!ids.has(id), "GENERATED_TRAP_ID_DUPLICATE", { trapId: id });
      ids.add(id);
    }
  }
}

/**
 * v9.7.75と同じ候補順・重複除外・splice抽選で新規Battle用Trapを生成する。
 * StageとMapは変更せず、BattleRandomだけを必要数消費する。
 */
export function generateHiddenTraps(stage, battleRandom) {
  invariant(stage !== null && typeof stage === "object", "TRAP_STAGE_REQUIRED");
  invariant(battleRandom instanceof BattleRandom, "TRAP_RANDOM_REQUIRED");
  invariant(stage.getHiddenTraps().length === 0, "TRAP_STAGE_ALREADY_INITIALIZED");
  validateGeneratedIdNamespace(stage.hiddenTrapDefinitions);

  const selectedPositionKeys = new Set();
  const traps = [];
  for (const definition of stage.hiddenTrapDefinitions) {
    const available = definition.candidatePositions.filter((position) => {
      const cell = stage.map.getCellAt(position.x, position.y);
      return cell !== null
        && cell.terrain.id === "plain"
        && !cell.isOccupied()
        && !selectedPositionKeys.has(position.toKey());
    });
    const count = Math.min(definition.count, available.length);
    for (let slotIndex = 0; slotIndex < count; slotIndex += 1) {
      const selectedIndex = Math.floor(battleRandom.next() * available.length);
      const position = available.splice(selectedIndex, 1)[0];
      selectedPositionKeys.add(position.toKey());
      traps.push(new HiddenTrap({
        id: generatedTrapId(definition, slotIndex),
        kind: definition.kind,
        position,
        triggerAffiliations: definition.triggerAffiliations,
        active: true
      }));
    }
  }
  return Object.freeze(traps);
}

/**
 * 実移動後の現在位置で最初に発動可能なTrapをDefinition順に返す。
 */
export function findTriggerableHiddenTrap(stage, unit, positionValue = null) {
  invariant(stage !== null && typeof stage === "object", "TRAP_STAGE_REQUIRED");
  invariant(unit instanceof Unit, "TRAP_UNIT_REQUIRED");
  invariant(stage.getUnits().includes(unit), "TRAP_UNIT_NOT_IN_STAGE", { unitId: unit.id });
  if (unit.hasAbility(UnitAbility.HIDDEN_TRAP_AWARENESS)) {
    return null;
  }

  const currentPosition = stage.map.getPosition(unit);
  if (currentPosition === null) {
    return null;
  }
  const position = positionValue === null ? currentPosition : Position.from(positionValue);
  if (!currentPosition.equals(position)) {
    return null;
  }

  const affiliation = stage.armyManager.getAffiliation(unit);
  if (affiliation === null) {
    return null;
  }
  return stage.getHiddenTraps().find((trap) => (
    trap.position.equals(position) && trap.canTriggerFor(affiliation)
  )) ?? null;
}

/**
 * Trapのatomic効果だけを確定する。Map除去、Event、演出、actionStateはControllerが扱う。
 */
export function resolveHiddenTrap(stage, unit, trap) {
  invariant(trap instanceof HiddenTrap, "TRAP_INSTANCE_REQUIRED");
  invariant(stage.getHiddenTraps().includes(trap), "TRAP_NOT_IN_STAGE", { trapId: trap.id });
  invariant(
    findTriggerableHiddenTrap(stage, unit, trap.position) === trap,
    "TRAP_NOT_TRIGGERABLE",
    { trapId: trap.id, unitId: unit.id }
  );

  const effect = HiddenTrapEffect[trap.kind];
  invariant(effect !== undefined, "TRAP_EFFECT_NOT_FOUND", { kind: trap.kind });
  const beforeTroops = unit.troops;
  const neutralized = effect.immunityAbilityId !== null
    && unit.hasAbility(effect.immunityAbilityId);

  trap.deactivate();
  let damage = 0;
  let statusChange = null;
  if (!neutralized) {
    damage = effect.damage;
    unit.applyDamage(damage);
    if (unit.hasTroops()) {
      const beforeTurns = unit.getStatusTurns(effect.statusType);
      const afterTurns = Math.max(beforeTurns, effect.statusTurns);
      unit.setStatus(effect.statusType, afterTurns);
      statusChange = Object.freeze({
        type: effect.statusType,
        beforeTurns,
        afterTurns
      });
    }
  }

  return Object.freeze({
    trap,
    unit,
    neutralized,
    damage,
    beforeTroops,
    afterTroops: unit.troops,
    defeated: beforeTroops > 0 && !unit.hasTroops(),
    statusChange,
    interruptMovement: true
  });
}
