import {
  CONTENT_REVISION,
  GAME_VERSION,
  SAVE_FORMAT_VERSION
} from "../config/version.js";
import {
  DomainError,
  invariant,
  requireEnumValue,
  requireIdentifier,
  requireIntegerInRange
} from "../core/domain-error.js";
import {
  BattleResumeKind,
  createResumeContext,
  PreparedBattleLoad
} from "../core/prepared-battle-load.js";
import { Affiliation } from "../domain/army.js";
import { BattleRandom } from "../domain/battle-random.js";
import { HiddenTrap } from "../domain/hidden-trap.js";
import { StagePhase } from "../domain/stage.js";
import { UnitActionState } from "../domain/unit.js";
import { StageFactory } from "../factories/stage-factory.js";
import { SaveCodec, SaveKind } from "../persistence/save-codec.js";
import { SaveMigrator } from "../persistence/save-migrator.js";
import { SaveRepository } from "../persistence/save-repository.js";

let writerSequence = 0;

function createWriterId() {
  writerSequence += 1;
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `writer_${globalThis.crypto.randomUUID()}`;
  }
  return `writer_${Date.now()}_${writerSequence}`;
}

function result(value) {
  return Object.freeze(value);
}

function sameStringArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function buildTrapDefinitionsByGeneratedId(stage) {
  const records = new Map();
  for (const definition of stage.hiddenTrapDefinitions) {
    for (let slotIndex = 0; slotIndex < definition.count; slotIndex += 1) {
      const trapId = definition.count === 1
        ? definition.id
        : `${definition.id}_${slotIndex + 1}`;
      invariant(!records.has(trapId), "SAVE_TRAP_GENERATED_ID_DUPLICATE", { trapId });
      records.set(trapId, Object.freeze({ definition, slotIndex }));
    }
  }
  return records;
}

function validateAndRestoreTraps(stage, savedTraps) {
  const definitionsById = buildTrapDefinitionsByGeneratedId(stage);
  const observedSlots = new Map();
  stage.clearHiddenTraps();

  for (const savedTrap of savedTraps) {
    const definitionRecord = definitionsById.get(savedTrap.id);
    invariant(definitionRecord !== undefined, "SAVE_TRAP_DEFINITION_NOT_FOUND", {
      trapId: savedTrap.id
    });
    const { definition, slotIndex } = definitionRecord;
    invariant(definition.kind === savedTrap.kind, "SAVE_TRAP_KIND_MISMATCH", {
      trapId: savedTrap.id
    });
    invariant(
      sameStringArray(definition.triggerAffiliations, savedTrap.triggerAffiliations),
      "SAVE_TRAP_AFFILIATIONS_MISMATCH",
      { trapId: savedTrap.id }
    );
    invariant(
      definition.candidatePositions.some((position) => (
        position.x === savedTrap.position.x && position.y === savedTrap.position.y
      )),
      "SAVE_TRAP_POSITION_NOT_CANDIDATE",
      { trapId: savedTrap.id }
    );

    const slots = observedSlots.get(definition) ?? [];
    slots.push(slotIndex);
    observedSlots.set(definition, slots);
    stage.addHiddenTrap(new HiddenTrap(savedTrap));
  }

  for (const slots of observedSlots.values()) {
    slots.sort((left, right) => left - right);
    invariant(
      slots.every((slotIndex, index) => slotIndex === index),
      "SAVE_TRAP_SLOT_SEQUENCE_INVALID",
      { slots }
    );
  }
}

function validateStableResumeState(stage) {
  const committed = [];
  for (const unit of stage.unitOrder) {
    invariant(
      unit.actionState !== UnitActionState.MOVED,
      "SAVE_LOAD_MOVED_UNIT_FORBIDDEN",
      { unitId: unit.id }
    );
    const affiliation = stage.armyManager.getAffiliation(unit);
    const position = stage.map.getPosition(unit);
    if (unit.actionState === UnitActionState.TACTIC_COMMITTED) {
      committed.push(unit);
      continue;
    }
    if (unit.actionState === UnitActionState.READY) {
      invariant(
        unit.hasTroops()
          && position !== null
          && affiliation === stage.phase,
        "SAVE_LOAD_READY_UNIT_INVALID",
        { unitId: unit.id }
      );
      continue;
    }
    invariant(unit.actionState === UnitActionState.FINISHED, "SAVE_LOAD_ACTION_STATE_INVALID", {
      unitId: unit.id
    });
  }

  if (stage.phase === StagePhase.ENEMY) {
    invariant(committed.length === 0, "SAVE_LOAD_ENEMY_TACTIC_COMMITTED");
    return createResumeContext(BattleResumeKind.ENEMY_CONTINUE);
  }
  invariant(committed.length <= 1, "SAVE_LOAD_TACTIC_COMMITTED_MULTIPLE");
  if (committed.length === 0) {
    return createResumeContext(BattleResumeKind.UNIT_SELECT);
  }
  const unit = committed[0];
  invariant(
    unit.hasTroops()
      && stage.map.getPosition(unit) !== null
      && stage.armyManager.playerArmy.has(unit),
    "SAVE_LOAD_TACTIC_COMMITTED_INVALID",
    { unitId: unit.id }
  );
  return createResumeContext(BattleResumeKind.TACTIC_FACING_SELECT, unit.id);
}

function validatePersistableBattle(battle) {
  const committed = [];
  for (const unit of battle.units) {
    invariant(
      unit.actionState !== UnitActionState.MOVED,
      "SAVE_DATA_MOVED_UNIT_FORBIDDEN",
      { unitId: unit.id }
    );
    const deployed = unit.army !== null && unit.position !== null && unit.troops > 0;
    const defeated = unit.army !== null && unit.position === null && unit.troops === 0;
    const reserve = unit.army === null && unit.position === null && unit.troops > 0;
    invariant(deployed || defeated || reserve, "SAVE_DATA_UNIT_LIFECYCLE_INVALID", {
      unitId: unit.id
    });
    if (!deployed) {
      invariant(
        unit.actionState === UnitActionState.FINISHED,
        "SAVE_DATA_INACTIVE_UNIT_NOT_FINISHED",
        { unitId: unit.id }
      );
    }
    if (unit.actionState === UnitActionState.READY) {
      invariant(unit.army === battle.phase, "SAVE_DATA_READY_UNIT_INVALID", {
        unitId: unit.id
      });
    }
    if (unit.actionState === UnitActionState.TACTIC_COMMITTED) {
      committed.push(unit);
    }
  }

  if (battle.phase === StagePhase.ENEMY) {
    invariant(committed.length === 0, "SAVE_DATA_ENEMY_TACTIC_COMMITTED");
    return;
  }
  invariant(committed.length <= 1, "SAVE_DATA_TACTIC_COMMITTED_MULTIPLE");
  if (committed.length === 1) {
    const unit = committed[0];
    invariant(
      unit.army === Affiliation.PLAYER && unit.position !== null && unit.troops > 0,
      "SAVE_DATA_TACTIC_COMMITTED_INVALID",
      { unitId: unit.id }
    );
  }
}

function restoreBattleIntoNewStage(stage, battle) {
  const expectedUnitIds = stage.unitOrder.map((unit) => unit.id);
  invariant(battle.units.length === expectedUnitIds.length, "SAVE_STAGE_UNIT_COUNT_MISMATCH");
  invariant(
    battle.units.every((savedUnit, index) => savedUnit.id === expectedUnitIds[index]),
    "SAVE_STAGE_UNIT_ORDER_MISMATCH"
  );

  stage.map.clearUnits();
  for (const unit of stage.unitOrder) {
    stage.armyManager.removeUnit(unit);
  }

  for (const savedUnit of battle.units) {
    const unit = stage.getUnit(savedUnit.id);
    unit.restoreTroops(savedUnit.troops);
    unit.setFacing(savedUnit.facing);
    unit.restoreActionState(savedUnit.actionState);
    unit.restoreStatusEffects(savedUnit.statusEffects);
    unit.restoreRemainingUses(savedUnit.remainingUses);

    if (savedUnit.army !== null) {
      const army = savedUnit.army === Affiliation.PLAYER
        ? stage.armyManager.playerArmy
        : stage.armyManager.enemyArmy;
      stage.armyManager.addUnit(unit, army);
    }
  }

  for (const savedUnit of battle.units) {
    if (savedUnit.position === null) {
      continue;
    }
    const unit = stage.getUnit(savedUnit.id);
    invariant(savedUnit.army !== null, "SAVE_PLACED_UNIT_WITHOUT_ARMY", { unitId: unit.id });
    const cell = stage.map.getCellAt(savedUnit.position.x, savedUnit.position.y);
    invariant(cell !== null, "SAVE_UNIT_POSITION_OUTSIDE", { unitId: unit.id });
    invariant(cell.terrain.canEnter(unit), "SAVE_UNIT_TERRAIN_FORBIDDEN", { unitId: unit.id });
    stage.map.placeUnit(unit, savedUnit.position);
  }

  stage.setTurnAndPhase(battle.turn, battle.phase);
  stage.eventManager.restoreCompletedEventIds(battle.completedEventIds);
  validateAndRestoreTraps(stage, battle.hiddenTraps);
  stage.battleLog.restore(battle.logs);

  const knownUnitIds = new Set(expectedUnitIds);
  for (const entry of stage.battleLog.getEntries()) {
    invariant(
      entry.unitIds.every((unitId) => knownUnitIds.has(unitId)),
      "SAVE_LOG_UNKNOWN_UNIT",
      { sequence: entry.sequence }
    );
  }

  stage.validateRuntime();
  return validateStableResumeState(stage);
}

function validateBattleDocumentAgainstRuntime(stageFactory, document) {
  validatePersistableBattle(document.battle);
  const stage = stageFactory.create(document.battle.stageId);
  const resumeContext = restoreBattleIntoNewStage(stage, document.battle);
  const battleRandom = new BattleRandom(1);
  battleRandom.importState(document.battle.randomState);
  return Object.freeze({
    stage,
    resumeContext,
    randomState: battleRandom.exportState()
  });
}

function freezeGuard(slotState, source, sourceRaw) {
  return Object.freeze({ slotState, source, sourceRaw });
}

/**
 * Saveの組立て、互換判定、新Stageへの復元を統括する。旧sessionには依存しない。
 */
export class SaveService {
  #repository;
  #codec;
  #migrator;
  #stageFactory;
  #writerId;
  #clock;
  #observedSlots;
  #conflictedSlots;
  #recoveryQueue;

  constructor({
    repository,
    codec = new SaveCodec(),
    migrator = new SaveMigrator(),
    stageFactory,
    writerId = createWriterId(),
    clock = () => Date.now()
  }) {
    invariant(repository instanceof SaveRepository, "SAVE_SERVICE_REPOSITORY_REQUIRED");
    invariant(codec instanceof SaveCodec, "SAVE_SERVICE_CODEC_REQUIRED");
    invariant(migrator instanceof SaveMigrator, "SAVE_SERVICE_MIGRATOR_REQUIRED");
    invariant(stageFactory instanceof StageFactory, "SAVE_SERVICE_STAGE_FACTORY_REQUIRED");
    this.#repository = repository;
    this.#codec = codec;
    this.#migrator = migrator;
    this.#stageFactory = stageFactory;
    this.#writerId = requireIdentifier(writerId, "SAVE_WRITER_ID_INVALID");
    invariant(typeof clock === "function", "SAVE_SERVICE_CLOCK_REQUIRED");
    this.#clock = clock;
    this.#observedSlots = new Map();
    this.#conflictedSlots = new Set();
    this.#recoveryQueue = Promise.resolve();
  }

  saveBattle({ slotId, saveKind, battle }) {
    requireIdentifier(slotId, "SAVE_SLOT_ID_INVALID");
    requireEnumValue(saveKind, SaveKind, "SAVE_KIND_INVALID");
    invariant(battle !== null && typeof battle === "object", "BATTLE_SAVE_DATA_REQUIRED");
    if (this.#conflictedSlots.has(slotId)) {
      return result({ ok: false, status: "conflict", code: "SAVE_CONFLICT", slotId });
    }

    const expectedSlot = this.#ensureObservedSlot(slotId);
    const priorRevisions = [
      expectedSlot.primary,
      expectedSlot.temporary,
      expectedSlot.backup
    ].map((raw) => this.#repository.revisionFromRaw(raw))
      .filter((revision) => Number.isInteger(revision));
    const revision = Math.max(0, ...priorRevisions) + 1;
    requireIntegerInRange(revision, 1, Number.MAX_SAFE_INTEGER, "SAVE_REVISION_EXHAUSTED");
    const savedAt = requireIntegerInRange(
      this.#clock(),
      0,
      Number.MAX_SAFE_INTEGER,
      "SAVE_TIME_INVALID"
    );
    const document = {
      saveFormatVersion: SAVE_FORMAT_VERSION,
      gameVersion: GAME_VERSION,
      contentRevision: CONTENT_REVISION,
      saveKind,
      slotId,
      revision,
      writerId: this.#writerId,
      savedAt,
      battle
    };
    const raw = this.#codec.encode(document);
    const frozenDocument = this.#codec.decode(raw);
    validateBattleDocumentAgainstRuntime(this.#stageFactory, frozenDocument);
    const preserveCurrentAsBackup = this.#isCompatiblePrimary(
      expectedSlot.primary,
      slotId,
      saveKind
    );

    try {
      const writeResult = this.#repository.writeSlot(slotId, raw, {
        expectedSlot,
        preserveCurrentAsBackup,
        lockOwnerId: this.#writerId
      });
      this.#observeSlot(slotId, writeResult.slot);
      return result({
        ok: true,
        status: "saved",
        code: "SAVE_OK",
        slotId,
        document: frozenDocument
      });
    } catch (error) {
      const code = error instanceof DomainError ? error.code : "SAVE_WRITE_FAILED";
      if (code === "SAVE_CONFLICT" || code === "SAVE_LOCKED") {
        this.#conflictedSlots.add(slotId);
        return result({ ok: false, status: "conflict", code: "SAVE_CONFLICT", slotId });
      }
      return result({ ok: false, status: "failed", code, slotId });
    }
  }

  enqueueRecoverySave(battle) {
    const task = this.#recoveryQueue.then(() => this.saveBattle({
      slotId: "recovery",
      saveKind: SaveKind.RECOVERY,
      battle
    }));
    this.#recoveryQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  enqueueRecoveryDelete() {
    const task = this.#recoveryQueue.then(() => this.deleteSlot({ slotId: "recovery" }));
    this.#recoveryQueue = task.then(() => undefined, () => undefined);
    return task;
  }

  inspectSlot(slotId, saveKind = SaveKind.MANUAL) {
    requireIdentifier(slotId, "SAVE_SLOT_ID_INVALID");
    requireEnumValue(saveKind, SaveKind, "SAVE_KIND_INVALID");
    const rawSlot = this.#repository.readSlot(slotId);
    const inspection = this.#inspectRawSlot(slotId, saveKind, rawSlot);
    this.#observeSlot(slotId, rawSlot);
    return inspection.publicResult;
  }

  inspectSlots(slotRequests = [
    Object.freeze({ slotId: "recovery", saveKind: SaveKind.RECOVERY })
  ]) {
    invariant(Array.isArray(slotRequests), "SAVE_SLOT_REQUESTS_INVALID");
    return Object.freeze(slotRequests.map((request) => {
      invariant(request !== null && typeof request === "object", "SAVE_SLOT_REQUEST_INVALID");
      return this.inspectSlot(request.slotId, request.saveKind);
    }));
  }

  prepareLoad({ slotId, saveKind, guard = null }) {
    requireIdentifier(slotId, "SAVE_SLOT_ID_INVALID");
    requireEnumValue(saveKind, SaveKind, "SAVE_KIND_INVALID");
    const rawSlot = this.#repository.readSlot(slotId);
    if (guard !== null && !this.#selectionMatches(rawSlot, guard)) {
      this.#conflictedSlots.add(slotId);
      throw new DomainError("SAVE_CONFLICT", { slotId });
    }
    const inspection = this.#inspectRawSlot(slotId, saveKind, rawSlot);
    if (inspection.candidate === null) {
      const codeByStatus = {
        empty: "SAVE_LOAD_EMPTY",
        incompatible: "SAVE_LOAD_INCOMPATIBLE",
        corrupt: "SAVE_LOAD_CORRUPT"
      };
      throw new DomainError(codeByStatus[inspection.publicResult.status], { slotId });
    }

    const { migration } = inspection.candidate;
    const document = migration.document;
    const { stage, resumeContext, randomState } = inspection.candidate.validated;
    const prepared = new PreparedBattleLoad({
      document,
      stage,
      randomState,
      resumeContext,
      sourceRevision: migration.sourceRevision
    });
    this.#observeSlot(slotId, rawSlot);
    return prepared;
  }

  deleteSlot({ slotId, guard = null }) {
    requireIdentifier(slotId, "SAVE_SLOT_ID_INVALID");
    if (this.#conflictedSlots.has(slotId) && guard === null) {
      return result({ ok: false, status: "conflict", code: "SAVE_CONFLICT", slotId });
    }
    const current = this.#repository.readSlot(slotId);
    if (guard !== null && !this.#selectionMatches(current, guard)) {
      this.#conflictedSlots.add(slotId);
      return result({ ok: false, status: "conflict", code: "SAVE_CONFLICT", slotId });
    }
    const expectedSlot = guard === null
      ? (this.#observedSlots.get(slotId) ?? this.#repository.captureSlotState(current))
      : guard.slotState;
    try {
      const removeResult = this.#repository.removeSlot(slotId, {
        expectedSlot,
        lockOwnerId: this.#writerId
      });
      this.#observeSlot(slotId, removeResult.slot);
      return result({ ok: true, status: "deleted", code: "SAVE_DELETE_OK", slotId });
    } catch (error) {
      const code = error instanceof DomainError ? error.code : "SAVE_DELETE_FAILED";
      if (code === "SAVE_CONFLICT" || code === "SAVE_LOCKED") {
        this.#conflictedSlots.add(slotId);
        return result({ ok: false, status: "conflict", code: "SAVE_CONFLICT", slotId });
      }
      return result({ ok: false, status: "failed", code, slotId });
    }
  }

  repairSlot({ slotId, saveKind = SaveKind.MANUAL, guard = null }) {
    requireIdentifier(slotId, "SAVE_SLOT_ID_INVALID");
    requireEnumValue(saveKind, SaveKind, "SAVE_KIND_INVALID");
    const current = this.#repository.readSlot(slotId);
    if (guard === null || !this.#selectionMatches(current, guard)) {
      this.#conflictedSlots.add(slotId);
      return result({ ok: false, status: "conflict", code: "SAVE_CONFLICT", slotId });
    }

    const inspection = this.#inspectRawSlot(slotId, saveKind, current);
    const source = inspection.candidate?.source ?? null;
    if (source === "primary") {
      this.#observeSlot(slotId, current);
      return result({
        ok: false,
        status: "not_required",
        code: "SAVE_REPAIR_NOT_REQUIRED",
        slotId
      });
    }
    if (source !== "temporary" && source !== "backup") {
      this.#observeSlot(slotId, current);
      return result({
        ok: false,
        status: "unavailable",
        code: "SAVE_REPAIR_UNAVAILABLE",
        slotId
      });
    }
    if (inspection.publicResult.repairable !== true) {
      this.#observeSlot(slotId, current);
      return result({
        ok: false,
        status: "protected",
        code: "SAVE_REPAIR_INCOMPATIBLE_GENERATION",
        slotId
      });
    }

    try {
      const promotion = source === "temporary"
        ? this.#repository.promoteTemporary(slotId, {
          expectedSlot: guard.slotState,
          lockOwnerId: this.#writerId
        })
        : this.#repository.promoteBackup(slotId, {
          expectedSlot: guard.slotState,
          lockOwnerId: this.#writerId
        });
      const repaired = this.#inspectRawSlot(slotId, saveKind, promotion.slot);
      invariant(
        repaired.publicResult.status === "occupied"
          && repaired.publicResult.source === "primary",
        "SAVE_REPAIR_RESULT_INVALID",
        { slotId, source }
      );
      this.#observeSlot(slotId, promotion.slot);
      return result({
        ok: true,
        status: "repaired",
        code: "SAVE_REPAIR_OK",
        slotId,
        source,
        inspection: repaired.publicResult
      });
    } catch (error) {
      const code = error instanceof DomainError ? error.code : "SAVE_REPAIR_FAILED";
      if (code === "SAVE_CONFLICT" || code === "SAVE_LOCKED") {
        this.#conflictedSlots.add(slotId);
        return result({ ok: false, status: "conflict", code: "SAVE_CONFLICT", slotId });
      }
      return result({ ok: false, status: "failed", code, slotId });
    }
  }

  handleStorageEvent(event) {
    invariant(event !== null && typeof event === "object", "SAVE_STORAGE_EVENT_INVALID");
    if (event.key === null) {
      for (const slotId of this.#observedSlots.keys()) {
        this.#conflictedSlots.add(slotId);
      }
      return this.#observedSlots.size > 0;
    }
    if (!this.#repository.isOwnedKey(event.key)) {
      return false;
    }
    const slotId = this.#repository.slotIdFromKey(event.key);
    if (slotId === null) {
      return false;
    }
    if (this.#observedSlots.has(slotId)) {
      this.#conflictedSlots.add(slotId);
    }
    return true;
  }

  isSlotConflicted(slotId) {
    requireIdentifier(slotId, "SAVE_SLOT_ID_INVALID");
    return this.#conflictedSlots.has(slotId);
  }

  #ensureObservedSlot(slotId) {
    if (!this.#observedSlots.has(slotId)) {
      this.#observeSlot(slotId, this.#repository.readSlot(slotId));
    }
    return this.#observedSlots.get(slotId);
  }

  #observeSlot(slotId, slot) {
    const captured = this.#repository.captureSlotState(slot);
    this.#observedSlots.set(slotId, captured);
    this.#conflictedSlots.delete(slotId);
    return captured;
  }

  #isCompatiblePrimary(raw, slotId, saveKind) {
    if (raw === null) {
      return false;
    }
    const candidate = this.#parseCandidate(raw, slotId, saveKind);
    return candidate.ok;
  }

  #parseCandidate(raw, slotId, saveKind) {
    if (raw === null) {
      return { ok: false, code: "SAVE_MISSING" };
    }
    try {
      const decoded = this.#codec.decode(raw);
      const migration = this.#migrator.migrate(decoded);
      this.#codec.validateShape(migration.document);
      invariant(migration.document.slotId === slotId, "SAVE_SLOT_ID_MISMATCH");
      invariant(migration.document.saveKind === saveKind, "SAVE_KIND_MISMATCH");
      invariant(
        migration.document.contentRevision === CONTENT_REVISION,
        "SAVE_CONTENT_REVISION_MISMATCH"
      );
      const validated = validateBattleDocumentAgainstRuntime(
        this.#stageFactory,
        migration.document
      );
      return {
        ok: true,
        migration,
        validated
      };
    } catch (error) {
      return {
        ok: false,
        code: error instanceof DomainError ? error.code : "SAVE_CANDIDATE_INVALID"
      };
    }
  }

  #inspectRawSlot(slotId, saveKind, rawSlot) {
    const sources = ["primary", "temporary", "backup"];
    const incompatibleCodes = new Set([
      "SAVE_FORMAT_UNSUPPORTED",
      "SAVE_MIGRATION_FORMAT_UNSUPPORTED",
      "SAVE_CONTENT_REVISION_MISMATCH"
    ]);
    const candidates = sources.map((source) => ({
      source,
      sourceRaw: rawSlot[source],
      parsed: this.#parseCandidate(rawSlot[source], slotId, saveKind)
    }));
    const selectedIndex = candidates.findIndex((candidate) => candidate.parsed.ok);
    const selected = selectedIndex < 0 ? null : candidates[selectedIndex];
    if (selected !== null) {
      const document = selected.parsed.migration.document;
      const repairable = selected.source !== "primary"
        && !candidates.slice(0, selectedIndex).some((candidate) => (
          candidate.sourceRaw !== null && incompatibleCodes.has(candidate.parsed.code)
        ));
      const publicResult = result({
        slotId,
        status: selected.source === "primary" ? "occupied" : selected.source,
        source: selected.source,
        repairable,
        summary: this.#createSummary(document),
        guard: freezeGuard(
          this.#repository.captureSlotState(rawSlot),
          selected.source,
          selected.sourceRaw
        )
      });
      return {
        publicResult,
        candidate: {
          source: selected.source,
          migration: selected.parsed.migration,
          validated: selected.parsed.validated
        }
      };
    }

    const presentCandidates = candidates.filter((candidate) => candidate.sourceRaw !== null);
    const status = presentCandidates.length === 0
      ? "empty"
      : presentCandidates.some((candidate) => incompatibleCodes.has(candidate.parsed.code))
        ? "incompatible"
        : "corrupt";
    return {
      publicResult: result({
        slotId,
        status,
        source: null,
        repairable: false,
        summary: null,
        guard: freezeGuard(this.#repository.captureSlotState(rawSlot), null, null)
      }),
      candidate: null
    };
  }

  #createSummary(document) {
    const livingUnits = document.battle.units.filter((unit) => unit.troops > 0);
    return Object.freeze({
      slotId: document.slotId,
      saveKind: document.saveKind,
      revision: document.revision,
      writerId: document.writerId,
      savedAt: document.savedAt,
      stageId: document.battle.stageId,
      turn: document.battle.turn,
      phase: document.battle.phase,
      playerUnitCount: livingUnits.filter((unit) => unit.army === Affiliation.PLAYER).length,
      enemyUnitCount: livingUnits.filter((unit) => unit.army === Affiliation.ENEMY).length,
      gameVersion: document.gameVersion,
      contentRevision: document.contentRevision
    });
  }

  #selectionMatches(rawSlot, guard) {
    if (
      guard === null
      || typeof guard !== "object"
      || !this.#repository.slotMatchesExpected(rawSlot, guard.slotState)
    ) {
      return false;
    }
    if (guard.source === null) {
      return guard.sourceRaw === null;
    }
    return rawSlot[guard.source] === guard.sourceRaw;
  }
}

/**
 * BattleControllerの非blocking checkpoint通知をSaveService queueへ接続する。
 */
export class SaveCheckpointAdapter {
  #saveService;
  #onCheckpoint;

  constructor(saveService, { onCheckpoint = () => {} } = {}) {
    invariant(saveService instanceof SaveService, "SAVE_CHECKPOINT_SERVICE_REQUIRED");
    invariant(typeof onCheckpoint === "function", "SAVE_CHECKPOINT_LISTENER_REQUIRED");
    this.#saveService = saveService;
    this.#onCheckpoint = onCheckpoint;
  }

  requestRecoverySave(snapshot) {
    const completion = this.#saveService.enqueueRecoverySave(snapshot);
    this.#onCheckpoint(snapshot, completion);
    return completion;
  }

  requestRecoveryClear() {
    return this.#saveService.enqueueRecoveryDelete();
  }
}
