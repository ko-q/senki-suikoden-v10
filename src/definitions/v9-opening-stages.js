import { invariant } from "../core/domain-error.js";
import { Character, CharacterManager } from "../domain/character.js";
import { ObjectiveType as T, ObjectiveOutcome as O } from "../domain/objective.js";
import { V9_OPENING_STAGE_SOURCE } from "./v9-opening-stage-source.js";
import { getV9StageMapDefinition } from "./v9-stage-maps.js";
import { createV9UnitProfile } from "./v9-unit-profile.js";
import { UnitAbility, UnitUse } from "../domain/unit-ability.js";
import { formatV9ObjectiveText } from "./v9-objective-text.js";

const sourceById = new Map(V9_OPENING_STAGE_SOURCE.map((source) => [source.id, source]));

/** Nine chapter definitions. Named characters must already exist in the supplied catalog.
 * This does not register or fabricate canonical character data and does not change the app catalog.
 */
export function createV9OpeningStageDefinition(stageId, characterManager) {
  const source = sourceById.get(stageId);
  invariant(source !== undefined, "V9_OPENING_STAGE_NOT_FOUND", { stageId });
  invariant(characterManager instanceof CharacterManager, "V9_OPENING_CHARACTER_MANAGER_REQUIRED");
  const adviserUnitIds = [];
  const cautiousElementalUnitIds = [];
  const units = source.units.map((unit) => {
    const character = unit.mobCharacter ? new Character(unit.mobCharacter) : characterManager.get(unit.characterId);
    invariant(!unit.mobCharacter || !characterManager.has(unit.characterId), "STAGE_CHARACTER_ID_COLLISION", { characterId: unit.characterId });
    if (unit.army === "ENEMY" && character.name.includes("参謀")) adviserUnitIds.push(unit.id);
    if (unit.overrides?.zhujiaMobTacticAi) cautiousElementalUnitIds.push(unit.id);
    const profile = createV9UnitProfile(character, unit.army, unit.move);
    const infiltrator = source.betrayal?.unitIds.includes(unit.id) ?? false;
    const waitingDefector = source.defection?.unitIds.includes(unit.id) ?? false;
    const abilities = [...profile.abilities];
    if (unit.id === source.sorcery?.actorUnitId && abilities.includes(UnitAbility.ILLUSION)) abilities.push(UnitAbility.WIDE_ILLUSION);
    if (infiltrator) abilities.push(UnitAbility.HIDDEN_TRAP_AWARENESS);
    if (unit.overrides?.specialTacticDamageRate === .75) abilities.push(UnitAbility.ELEMENTAL_TACTIC_DAMAGE_75_PERCENT);
    return Object.freeze({ id: unit.id, characterId: unit.characterId, army: unit.reserve ? null : unit.army,
      position: unit.reserve ? null : unit.position, facing: unit.facing,
      actionState: unit.reserve || infiltrator || waitingDefector || source.raid?.stationaryUnits.includes(unit.id) ? "FINISHED" : "READY",
      ...profile, maxTroops: unit.overrides?.maxHp ?? profile.maxTroops,
      abilities: Object.freeze(abilities),
      maxUses: Object.freeze({ ...profile.maxUses,
        ...(unit.overrides?.maxStrategyUses !== undefined ? { [UnitUse.TACTIC]: unit.overrides.maxStrategyUses } : {}) }) });
  });
  const speeches = [], dialogues = [];
  for (const kind of ["intro", "victory", ...(source.raid || source.rescue || source.betrayal ? ["arrival"] : []),
    ...(source.sorcery ? ["warning"] : []), ...(source.defection ? ["defection", "relief"] : [])]) {
    const lines = kind === "arrival" ? (source.raid ?? source.rescue ?? source.betrayal).arrival
      : kind === "warning" ? source.sorcery.warning : ["defection", "relief"].includes(kind) ? source[kind].arrival : source[kind];
    const speechIds = lines.map((line, index) => {
      const id = `${stageId}_${kind}_${index}`;
      if (line.speakerName === "物語") {
        speeches.push(Object.freeze({ id, narratorLabel: "物語", text: line.text }));
        return id;
      }
      const unit = source.units.find((unit) => unit.id === line.unitId);
      let speakerCharacterId = unit?.characterId;
      if (line.speakerName) {
        const matches = characterManager.getAll().filter((character) => character.name === line.speakerName);
        invariant(matches.length === 1, "V9_STAGE_SPEAKER_NOT_UNIQUE", { name: line.speakerName });
        speakerCharacterId = matches[0].id;
      }
      invariant(speakerCharacterId !== undefined, "V9_STAGE_SPEAKER_NOT_FOUND", { stageId, id });
      speeches.push(Object.freeze({ id, speakerCharacterId, text: line.text,
        ...(line.actionLabel ? { actionLabel: line.actionLabel } : {}) }));
      return id;
    });
    dialogues.push(Object.freeze({ id: `${stageId}_${kind}`, speechIds: Object.freeze(speechIds) }));
  }
  const objectives = [
    { id: `${stageId}_leader_defeat`, type: T.UNIT_DEFEAT, outcome: O.DEFEAT, unitIds: Object.freeze([source.leader]) },
    { id: `${stageId}_annihilation`, type: T.ELIMINATION, outcome: O.VICTORY, targetArmy: "ENEMY",
      ...(source.raid ? { activeAfterEventId: `${stageId}_reinforcement` } : {}) },
    { id: `${stageId}_turn_limit`, type: T.TURN_LIMIT, maxTurn: source.turnLimit }
  ];
  for (const unitId of source.requiredSurvivors ?? []) objectives.push({ id: `${stageId}_${unitId}_defeat`,
    type: T.UNIT_DEFEAT, outcome: O.DEFEAT, unitIds: Object.freeze([unitId]), requireDeployment: true });
  if (source.escape) objectives.push({ id: `${stageId}_escape`, type: T.REACH, outcome: O.VICTORY, ...source.escape,
    ...(source.raid ? { activeAfterEventId: `${stageId}_raid_complete` } : {}) });
  const events = [], unitControlRules = [], hiddenTrapDefinitions = [];
  if (source.defection) {
    const eventId = `${stageId}_defection`;
    events.push(Object.freeze({ id: eventId, type: "BETRAYAL", trigger: "PHASE_START", phase: "PLAYER",
      turnAtLeast: source.defection.turn, unitIds: source.defection.unitIds, targetArmy: "PLAYER",
      skipPresentationWhenAllDefeated: true,
      presentationRequests: Object.freeze([Object.freeze({ type: "DIALOGUE", dialogueId: `${stageId}_defection` })]) }));
    unitControlRules.push(...source.defection.unitIds.map((unitId) => Object.freeze({ unitId, inactiveUntilEventId: eventId,
      activateOnCompletionDuringOwnPhase: true, actionLabel: "陣中待機" })));
    events.push(Object.freeze({ id: `${stageId}_relief`, type: "REINFORCEMENT", trigger: "PHASE_START", phase: "PLAYER",
      requiredDefeatedUnitIds: source.relief.requiredDefeatedUnitIds, targetArmy: "PLAYER",
      deployments: Object.freeze(source.units.filter((unit) => unit.reserve).map((unit) => Object.freeze({
        unitId: unit.id, preferredPosition: unit.position }))),
      presentationRequests: Object.freeze([Object.freeze({ type: "DIALOGUE", dialogueId: `${stageId}_relief` })]) }));
  }
  if (source.raid) {
    const completeId = `${stageId}_raid_complete`;
    const triggers = Object.freeze(["PHASE_START", "AFTER_OPERATION", "UNIT_DEFEATED"]);
    events.push(Object.freeze({ id: completeId, type: "MISSION_TRANSITION", triggers,
      logMessages: source.raid.completionMessages,
      requiredDefeatedUnitIds: Object.freeze(source.units.filter((unit) => unit.army === "ENEMY" && !unit.reserve).map((unit) => unit.id)) }));
    events.push(Object.freeze({ id: `${stageId}_reinforcement`, type: "REINFORCEMENT", triggers,
      requiredCompletedEventIds: Object.freeze([completeId]), phase: "PLAYER",
      turnAtLeast: source.raid.reinforcementTurn, targetArmy: "ENEMY",
      deployments: Object.freeze(source.units.filter((unit) => unit.reserve).map((unit) => Object.freeze({
        unitId: unit.id, preferredPosition: unit.position }))),
      presentationRequests: Object.freeze([Object.freeze({ type: "DIALOGUE", dialogueId: `${stageId}_arrival` })]) }));
    objectives.push({ id: `${stageId}_raid_deadline`, type: T.TURN_LIMIT,
      maxTurn: source.raid.turnLimit + 1, checkpoint: "PLAYER_PHASE_START", inactiveAfterEventId: completeId });
    unitControlRules.push(...source.raid.stationaryUnits.map((unitId) => Object.freeze({ unitId, alwaysInactive: true })));
  }
  if (source.rescue) {
    const rescueId = `${stageId}_rescue`;
    events.push(Object.freeze({ id: rescueId, type: "REINFORCEMENT", trigger: "PHASE_START", phase: "PLAYER",
      turnAtLeast: source.rescue.turn, targetArmy: "PLAYER",
      deployments: Object.freeze(source.units.filter((unit) => unit.reserve).map((unit) => Object.freeze({
        unitId: unit.id, preferredPosition: unit.position }))),
      presentationRequests: Object.freeze([Object.freeze({ type: "DIALOGUE", dialogueId: `${stageId}_arrival` })]) }));
    // Pending required rescuers are permitted before arrival; failed deployment after arrival is defeat.
    for (const unitId of source.escape.unitIds.filter((id) => id !== source.leader)) {
      const pending = source.units.find((unit) => unit.id === unitId).reserve;
      objectives.push({ id: `${stageId}_${unitId}_defeat`, type: T.UNIT_DEFEAT, outcome: O.DEFEAT,
        unitIds: Object.freeze([unitId]), requireDeployment: true,
        ...(pending ? { activeAfterEventId: rescueId } : {}) });
    }
  }
  if (source.betrayal) {
    const betrayalId = `${stageId}_betrayal`;
    events.push(Object.freeze({ id: betrayalId, type: "BETRAYAL", trigger: "PHASE_START", phase: "PLAYER",
      unitIds: source.betrayal.unitIds, targetArmy: "PLAYER", turnAtLeast: source.betrayal.turn,
      newFacing: "NORTH", confusionTargetArmy: "ENEMY", confusionTurns: 1,
      presentationRequests: Object.freeze([Object.freeze({ type: "DIALOGUE", dialogueId: `${stageId}_arrival` })]) }));
    unitControlRules.push(...source.betrayal.unitIds.map((unitId) => Object.freeze({ unitId,
      inactiveUntilEventId: betrayalId, activateOnCompletionDuringOwnPhase: true, actionLabel: "潜入待機" })));
    hiddenTrapDefinitions.push(...source.betrayal.trapZones.map((zone, index) => Object.freeze({
      id: `${stageId}_trap_zone_${index + 1}`, kind: "normal", count: zone.count,
      candidatePositions: Object.freeze(zone.candidates.map(([x, y]) => Object.freeze({ x, y }))),
      triggerAffiliations: Object.freeze(["PLAYER"]) })));
  }
  if (source.sorcery) {
    events.push(Object.freeze({ id: `${stageId}_spell_warning`, type: "DIALOGUE", trigger: "TRAP_TRIGGERED",
      trapKinds: Object.freeze(["spell"]), trapNeutralized: false,
      presentationRequests: Object.freeze([Object.freeze({ type: "DIALOGUE", dialogueId: `${stageId}_warning` })]) }));
    hiddenTrapDefinitions.push(...source.sorcery.trapZones.map((zone, index) => Object.freeze({
      id: `${stageId}_trap_zone_${index + 1}`, kind: zone.kind, count: zone.count,
      candidatePositions: Object.freeze(zone.candidates.map(([x, y]) => Object.freeze({ x, y }))),
      triggerAffiliations: Object.freeze(["PLAYER"]) })));
  }
  const [victoryText, ...defeatLines] = formatV9ObjectiveText(source.objectiveText).split("\n");
  return Object.freeze({
    id: stageId, chapterNumber: source.chapterNumber, titleKey: source.title,
    briefing: Object.freeze({ victory: victoryText.replace(/^勝利：/, ""), defeat: defeatLines.join("\n").replace(/^敗北：/, "") }),
    map: getV9StageMapDefinition(stageId).map,
    mobCharacters: Object.freeze(source.units.filter((unit) => unit.mobCharacter).map((unit) => unit.mobCharacter)),
    units: Object.freeze(units), speeches: Object.freeze(speeches), dialogues: Object.freeze(dialogues),
    objectives: Object.freeze(objectives.map(Object.freeze)),
    events: Object.freeze(events), unitControlRules: Object.freeze(unitControlRules),
    hiddenTrapDefinitions: Object.freeze(hiddenTrapDefinitions),
    aiConfig: Object.freeze({ adviserUnitIds: Object.freeze(adviserUnitIds), cautiousElementalUnitIds: Object.freeze(cautiousElementalUnitIds),
      pursuitRules: Object.freeze(source.pursuit ? [Object.freeze({ unitIds: source.pursuit.unitIds,
        gateColumns: source.pursuit.gateColumns, insideMaximumRow: source.pursuit.insideMaximumRow,
        outsideRow: source.pursuit.outsideRow, candidateMinimumRow: source.pursuit.candidateMinimumRow })] : []),
      targetPriorityRules: Object.freeze(source.pursuit ? [Object.freeze({ actorUnitIds: source.pursuit.priorityActorIds,
        targetUnitIds: source.escape.unitIds, disableStrategy: true })] : []),
      wideIllusionRules: Object.freeze(source.sorcery ? [Object.freeze({ actorUnitId: source.sorcery.actorUnitId,
        suppressorUnitId: source.sorcery.suppressorUnitId, suppressionRange: source.sorcery.suppressionRange })] : []) }),
    introDialogueId: `${stageId}_intro`, victoryDialogueId: `${stageId}_victory`, defeatDialogueId: null
  });
}
