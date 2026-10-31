import { invariant } from "../core/domain-error.js";
import { createDialoguePresentationRequest, createSemanticPresentationRequest as request, PresentationRequestType as Type } from "../core/presentation-request.js";
import { Stage } from "../domain/stage.js";
import { createTacticSuccessDialogue } from "./tactic-dialogue-factory.js";

function positionPayload(position) {
  return position === null ? null : { x: position.x, y: position.y };
}

/**
 * 確定済みの戦闘状態・結果を表示用snapshotへ変換する。
 * Domain更新、乱数、ログ、表示待機、通知の送信は担当しない。
 */
export class BattlePresentationFactory {
  #stage;

  constructor(stage) {
    invariant(stage instanceof Stage, "BATTLE_PRESENTATION_STAGE_REQUIRED");
    this.#stage = stage;
  }

  missionBriefing() {
    return request(Type.MISSION_BRIEFING, this.#stage.briefing);
  }

  phase(turn, phase) {
    return request(Type.PHASE, { turn, phase });
  }

  unitFocus(unit) {
    return request(Type.UNIT_FOCUS, { unitId: unit.id });
  }

  move(unit, from, to) {
    return request(Type.MOVE, {
      unitId: unit.id, from: positionPayload(from), to: positionPayload(to)
    });
  }

  phaseStatus(unit, statusResult) {
    return request(Type.STATUS, {
      reason: "PHASE_START", unitId: unit.id,
      position: positionPayload(this.#stage.map.getPosition(unit)), statusResult,
      statusEffects: unit.statusEffects.map(effect => ({
        type: effect.type, remainingTurns: effect.remainingTurns
      }))
    });
  }

  action(actionType, actor, target, forced) {
    return request(Type.ACTION, {
      actionType, actorId: actor.id, targetId: target?.id ?? null,
      actorPosition: positionPayload(this.#stage.map.getPosition(actor)),
      targetPosition: target === null ? null : positionPayload(this.#stage.map.getPosition(target)),
      actorAffiliation: this.#stage.armyManager.getAffiliation(actor),
      actorIsMob: this.#stage.mobCharacters.includes(actor.character), forced
    });
  }

  actionResult(actor, operationType, result) {
    const requests = [];
    const targetResults = result.targetResults ?? [result];
    const entries = targetResults.map(entry => ({
      unitId: (entry.unit ?? entry.target).id,
      position: positionPayload(entry.position ?? entry.targetPosition),
      beforeTroops: entry.troops.before, afterTroops: entry.troops.after,
      damage: entry.damage, defeated: entry.defeated
    }));
    if (entries.some(entry => entry.damage > 0)) {
      requests.push(request(Type.DAMAGE, { operationType, actorId: actor.id, entries }));
    }
    const statusEntries = targetResults
      .filter(entry => JSON.stringify(entry.statusEffects.before) !== JSON.stringify(entry.statusEffects.after))
      .map(entry => ({
        unitId: (entry.unit ?? entry.target).id,
        position: positionPayload(entry.position ?? entry.targetPosition),
        before: entry.statusEffects.before, after: entry.statusEffects.after,
        effectTurns: entry.effectTurns ?? (entry.confusion?.success === true ? 1 : null)
      }));
    if (statusEntries.length > 0) {
      requests.push(request(Type.STATUS, { reason: operationType, actorId: actor.id, entries: statusEntries }));
    }
    const dialogue = createTacticSuccessDialogue(result);
    if (dialogue !== null) requests.push(createDialoguePresentationRequest(dialogue));
    return Object.freeze(requests);
  }

  trapResult(result) {
    const requests = [request(Type.TRAP, {
      trapId: result.trap.id, trapKind: result.trap.kind, unitId: result.unit.id,
      neutralized: result.neutralized, damage: result.damage,
      beforeTroops: result.beforeTroops, afterTroops: result.afterTroops,
      defeated: result.defeated, statusChange: result.statusChange
    })];
    if (result.damage > 0) {
      requests.push(request(Type.DAMAGE, {
        operationType: "TRAP", actorId: null,
        entries: [{
          unitId: result.unit.id, position: positionPayload(result.trap.position),
          beforeTroops: result.beforeTroops, afterTroops: result.afterTroops,
          damage: result.damage, defeated: result.defeated
        }]
      }));
    }
    if (result.statusChange !== null) {
      requests.push(request(Type.STATUS, {
        reason: "TRAP", unitId: result.unit.id,
        position: positionPayload(result.trap.position), statusChange: result.statusChange
      }));
    }
    return Object.freeze(requests);
  }

  battleResult(result) {
    return request(Type.BATTLE_RESULT, result);
  }
}
