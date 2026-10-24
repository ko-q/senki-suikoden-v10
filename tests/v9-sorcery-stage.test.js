import test from "node:test";
import assert from "node:assert/strict";
import { Character, CharacterManager } from "../src/domain/character.js";
import { StageFactory } from "../src/factories/stage-factory.js";
import { createV9OpeningStageDefinition } from "../src/definitions/v9-opening-stages.js";
import { V9_OPENING_STAGE_SOURCE } from "../src/definitions/v9-opening-stage-source.js";
import { createV9CompatibleTerrainCatalog } from "../src/definitions/v9-compatible-terrain.js";
import { UnitAbility as A, UnitUse } from "../src/domain/unit-ability.js";
import { BattleRandom } from "../src/domain/battle-random.js";
import { ActionType } from "../src/core/action-request.js";
import { generateHiddenTraps, resolveHiddenTrap } from "../src/services/hidden-trap-rules.js";
import { BattleController, BattleFlowState } from "../src/orchestration/battle-controller.js";
import { MovementService } from "../src/services/movement-service.js";
import { CombatService } from "../src/services/combat-service.js";
import { TacticService } from "../src/services/tactic-service.js";
import { StatusService } from "../src/services/status-service.js";
import { AIService } from "../src/services/ai-service.js";
import { createBattleSaveData } from "../src/core/battle-save-data.js";
import { SaveService } from "../src/services/save-service.js";
import { SaveCodec, SaveKind } from "../src/persistence/save-codec.js";
import { SaveMigrator } from "../src/persistence/save-migrator.js";
import { SaveRepository } from "../src/persistence/save-repository.js";
import { MemoryStorage } from "../test-support/memory-storage.js";

const source = V9_OPENING_STAGE_SOURCE[6], warningId = `${source.id}_spell_warning`;
// Named stats and the two casters' skills are synthetic test inputs, never app data.
function character(id, name = `Test ${id}`, specialAbilities = []) {
  return new Character({ id, name, shortName: "T", martial: 50, command: 50,
    intelligence: 50, charisma: 50, specialAbilities, source: "test_fixture" });
}
const named = source.units.filter((u) => !u.mobCharacter).map((u) => character(u.characterId,
  undefined, ["gao_lian", "gongsun_sheng"].includes(u.characterId) ? ["幻術"] : []));
const chai = character("test_chai_jin", "柴進"), characters = new CharacterManager([...named, chai]);
function factory(catalog = characters) {
  return new StageFactory({ definitions: [createV9OpeningStageDefinition(source.id, catalog)],
    characterManager: catalog, terrainCatalog: createV9CompatibleTerrainCatalog() });
}
function stage() { return factory().create(source.id); }
function traps(runtime, random = new BattleRandom(20)) {
  for (const trap of generateHiddenTraps(runtime, random)) runtime.addHiddenTrap(trap);
  return random;
}
function warning(runtime, result) {
  return runtime.eventManager.resolveChain({ stage: runtime, trigger: "TRAP_TRIGGERED", payload: result });
}
function trigger(runtime, unit, trap) {
  runtime.map.moveUnit(unit, trap.position);
  const result = resolveHiddenTrap(runtime, unit, trap);
  return { unit, trap, result };
}
function kill(runtime, unit) {
  unit.applyDamage(unit.maxTroops); unit.setReadyForPhase(false); runtime.map.removeUnit(unit);
}
function services(battleRandom = new BattleRandom(1)) {
  const movementService = new MovementService(), combatService = new CombatService();
  const tacticService = new TacticService(), statusService = new StatusService();
  const aiService = new AIService({ battleRandom, movementService, combatService, tacticService });
  return { battleRandom, movementService, combatService, tacticService, statusService, aiService };
}

test("Gaotang preserves 61 source units and Chai Jin speaks without becoming a combat unit", () => {
  const runtime = stage();
  assert.equal(runtime.getUnits().length, 61);
  assert.equal(runtime.armyManager.playerArmy.getUnits().length, 23);
  assert.equal(runtime.armyManager.enemyArmy.getUnits().length, 38);
  assert.equal(runtime.map.height, 20);
  assert.equal(runtime.introDialogue.speeches.length, 5);
  assert.equal(runtime.victoryDialogue.speeches.length, 3);
  assert.equal(runtime.victoryDialogue.speeches[1].speaker, chai);
  assert.ok(runtime.getUnits().every((u) => u.character !== chai));
  assert.deepEqual(runtime.aiConfig.wideIllusionRules.map((r) => [r.actor.id, r.suppressor.id, r.suppressionRange]),
    [["gao_lian", "gongsun_sheng_gaotang", 3]]);
  assert.deepEqual(runtime.getUnits().filter((u) => u.hasAbility(A.WIDE_ILLUSION)).map((u) => u.id), ["gao_lian"]);
  assert.equal(runtime.validateRuntime(), true);
});

test("the noncombat speaker must resolve uniquely and named abilities are never inferred", () => {
  for (const catalog of [new CharacterManager(named), new CharacterManager([...named, chai, character("duplicate_chai", "柴進")])]) {
    assert.throws(() => createV9OpeningStageDefinition(source.id, catalog), { code: "V9_STAGE_SPEAKER_NOT_UNIQUE" });
  }
  const noIllusion = new CharacterManager([...named.map((c) => character(c.id)), chai]);
  assert.equal(factory(noIllusion).create(source.id).getUnit("gao_lian").hasAbility(A.WIDE_ILLUSION), false);
});

test("Gongsun Sheng suppresses wide illusion at three cells but not four or after defeat", () => {
  for (const scenario of ["three", "four", "defeated"]) {
    const runtime = stage(), actor = runtime.getUnit("gao_lian"), suppressor = runtime.getUnit("gongsun_sheng_gaotang");
    runtime.map.moveUnit(runtime.getUnit(source.leader), { x: 3, y: 0 });
    runtime.map.moveUnit(suppressor, scenario === "four" ? { x: 3, y: 3 } : { x: 4, y: 3 });
    if (scenario === "defeated") kill(runtime, suppressor);
    const plan = services().aiService.planEnemyTurn(actor, runtime);
    assert.equal(plan.request.type, scenario === "three" ? ActionType.ILLUSION : ActionType.WIDE_ILLUSION, scenario);
  }
});

test("wide illusion targets vulnerable players, costs no use and excludes illusion users", () => {
  const runtime = stage(), actor = runtime.getUnit("gao_lian"), target = runtime.getUnit(source.leader);
  const immune = runtime.getUnit("gongsun_sheng_gaotang"), other = runtime.getUnit("wu_yong_gaotang");
  runtime.map.moveUnit(target, { x: 3, y: 0 });
  runtime.map.moveUnit(other, { x: 5, y: 0 });
  runtime.map.moveUnit(immune, { x: 4, y: 1 });
  const tactic = new TacticService(), request = { type: ActionType.WIDE_ILLUSION, actor, target: actor };
  const usesBefore = actor.remainingUses[UnitUse.TACTIC];
  // The tactic's effect is independent of the AI gate, whose distance boundary is tested above.
  const estimate = tactic.estimate(request, runtime);
  assert.deepEqual(estimate.targets.map((t) => t.unit.id), [target.id, other.id]);
  const result = tactic.execute(request, runtime, new BattleRandom(1));
  assert.equal(actor.remainingUses[UnitUse.TACTIC], usesBefore);
  assert.equal(result.targetResults.length, 2);
  assert.equal(target.getStatusTurns("ILLUSION"), 2);
  assert.equal(immune.getStatusTurns("ILLUSION"), 0);
});

test("two ordinary and two spell traps use four draws and warn only after a harmful spell", () => {
  const runtime = stage(), random = traps(runtime), expected = new BattleRandom(20);
  for (let n = 0; n < 4; n++) expected.next();
  assert.deepEqual(random.exportState(), expected.exportState());
  const normal = runtime.getHiddenTraps().filter((t) => t.kind === "normal");
  const spell = runtime.getHiddenTraps().filter((t) => t.kind === "spell");
  assert.equal(normal.length, 2); assert.equal(spell.length, 2);
  const ordinary = runtime.getUnit(source.leader), immune = runtime.getUnit("gongsun_sheng_gaotang");
  const first = trigger(runtime, ordinary, normal[0]);
  assert.equal(first.result.damage, 20);
  assert.equal(ordinary.getStatusTurns("CONFUSED"), 1);
  assert.equal(warning(runtime, first).completedEvents.length, 0);
  const safe = trigger(runtime, immune, spell[0]);
  assert.equal(safe.result.neutralized, true);
  assert.equal(safe.result.damage, 0);
  assert.equal(immune.troops, immune.maxTroops);
  assert.equal(immune.getStatusTurns("ILLUSION"), 0);
  assert.equal(warning(runtime, safe).completedEvents.length, 0);
  assert.equal(warning(runtime, { trap: spell[1], unit: ordinary }).completedEvents.length, 0);
  const harmful = trigger(runtime, ordinary, spell[1]);
  assert.equal(harmful.result.damage, 10);
  assert.equal(ordinary.getStatusTurns("ILLUSION"), 1);
  assert.equal(ordinary.getStatusTurns("CONFUSED"), 1);
  const event = warning(runtime, harmful);
  assert.deepEqual(event.completedEvents.map((e) => e.id), [warningId]);
  assert.equal(event.presentationRequests[0].dialogue.speeches.length, 2);
  assert.equal(warning(runtime, harmful).completedEvents.length, 0);
  assert.ok([...normal.slice(0, 1), ...spell].every((t) => !t.active));
});

test("Gongsun defeat allows continuation, Gao defeat alone does not win, and Song defeat loses", () => {
  const runtime = stage();
  runtime.setTurnAndPhase(17, "PLAYER");
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseEndDefeat(runtime), null);
  runtime.setTurnAndPhase(18, "PLAYER");
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseStartDefeat(runtime), null);
  assert.equal(runtime.objectiveManager.evaluatePlayerPhaseEndDefeat(runtime).id, `${source.id}_turn_limit`);
  kill(runtime, runtime.getUnit("gongsun_sheng_gaotang"));
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime), null);
  kill(runtime, runtime.getUnit("gao_lian"));
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime), null);
  for (const unit of runtime.armyManager.enemyArmy.getUnits().filter((u) => u.hasTroops())) kill(runtime, unit);
  assert.equal(runtime.objectiveManager.evaluateVictory(runtime).id, `${source.id}_annihilation`);
  kill(runtime, runtime.getUnit(source.leader));
  assert.equal(runtime.objectiveManager.evaluateDefeat(runtime).id, `${source.id}_leader_defeat`);
});

test("the real controller passes trap immunity results and shows the warning only for damage", { timeout: 10000 }, async () => {
  const runtime = stage(), dependencies = services(new BattleRandom(20)), requests = [];
  const battle = new BattleController({ stage: runtime, ...dependencies,
    presentationPort: { async present(request) { requests.push(request); } } });
  const completion = battle.startNewBattle();
  try {
    for (let n = 0; battle.flowState !== BattleFlowState.IDLE && n < 100; n++) await new Promise(setImmediate);
    assert.equal(battle.flowState, BattleFlowState.IDLE);
    const spell = runtime.getHiddenTraps().filter((t) => t.kind === "spell"), randomBefore = dependencies.battleRandom.exportState();
    for (const [index, unitId] of ["gongsun_sheng_gaotang", source.leader].entries()) {
      const unit = runtime.getUnit(unitId), position = spell[index].position;
      const adjacent = [{ x: position.x, y: position.y + 1 }, { x: position.x, y: position.y - 1 },
        { x: position.x + 1, y: position.y }, { x: position.x - 1, y: position.y }]
        .find((p) => { const cell = runtime.map.getCellAt(p.x, p.y); return cell?.terrain.canEnter(unit) && !cell.isOccupied(); });
      assert.ok(adjacent);
      runtime.map.moveUnit(unit, adjacent);
      assert.equal(await battle.executeWait(unit, [position], "NORTH"), true);
      assert.equal(unit.actionState, "FINISHED");
      assert.equal(runtime.eventManager.getCompletedEventIds().includes(warningId), index === 1);
    }
    assert.equal(requests.filter((r) => r.dialogue?.id === `${source.id}_warning`).length, 1);
    assert.deepEqual(dependencies.battleRandom.exportState(), randomBefore);
    assert.equal(runtime.validateRuntime(), true);
    assert.deepEqual(battle.getDiagnostics(), []);
  } finally { battle.dispose(); await completion.catch(() => {}); }
});

test("save/load preserves warning completion, spell effects, trap positions and random state", () => {
  for (const warned of [false, true]) {
    const stageFactory = factory(), runtime = stageFactory.create(source.id), random = traps(runtime);
    const unit = runtime.getUnit(warned ? source.leader : "gongsun_sheng_gaotang");
    const payload = trigger(runtime, unit, runtime.getHiddenTraps().find((t) => t.kind === "spell"));
    warning(runtime, payload);
    for (const unit of runtime.getUnits()) unit.setReadyForPhase(runtime.armyManager.playerArmy.has(unit));
    const service = new SaveService({ stageFactory, repository: new SaveRepository({ storage: new MemoryStorage() }),
      codec: new SaveCodec(), migrator: new SaveMigrator(), writerId: "sorcery_test" });
    assert.equal(service.saveBattle({ slotId: "manual_01", saveKind: SaveKind.MANUAL,
      battle: createBattleSaveData(runtime, random) }).ok, true);
    const guard = service.inspectSlot("manual_01", SaveKind.MANUAL).guard;
    const prepared = service.prepareLoad({ slotId: "manual_01", saveKind: SaveKind.MANUAL, guard });
    const loaded = prepared.stage;
    assert.deepEqual(prepared.randomState, random.exportState());
    assert.deepEqual(loaded.getHiddenTraps(), runtime.getHiddenTraps());
    assert.deepEqual(loaded.getUnit(unit.id).statusEffects, unit.statusEffects);
    assert.equal(loaded.eventManager.getCompletedEventIds().includes(warningId), warned);
    const second = trigger(loaded, loaded.getUnit(source.leader), loaded.getHiddenTraps().find((t) => t.kind === "spell" && t.active));
    assert.equal(warning(loaded, second).completedEvents.length, warned ? 0 : 1);
    assert.equal(loaded.validateRuntime(), true);
  }
});
