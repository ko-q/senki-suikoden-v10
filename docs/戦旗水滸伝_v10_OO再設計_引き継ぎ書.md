# 戦旗水滸伝 v10 OO再設計・引き継ぎ書

作成日: 2026-09-06  
状態: 統合レビュー反映済み。一次設計課題は解決済み。Milestone 7まで実装済み。

## 1. 最重要ルール

- 現行実装はGitHub `ko-q/senki-suikoden` のv9.7.75分割版を基準とする。
- 基準commitは `3e3fb85ca8279e5351668562dea677df777a1ddc`。
- 現行構成は `index.html / game.js / stage-map-assets.css / portrait-assets.js / screen-assets.js / battle-effect-assets.js / audio-assets.js`。
- 新しい設計問題は、まず `問題 / 影響 / 修正案` を提示する。承認なくゲーム実装へ進まない。
- 実装時は必ず現行実ファイルを直接確認する。記憶や過去説明だけで判断しない。
- 広範囲な正規表現置換や大規模一括改変は禁止する。原因箇所だけを限定修正する。
- 人物能力・技能・性格等は `水滸伝_人物能力データ_第4.7版.xlsx` が正本。推測・無断変更をしない。
- v10 OO化と同時にゲームバランスやAI性能を変えない。まず現行挙動を責務分離して移植する。
- 正式採用済み画像・音声を無断で再生成・差し替えしない。

## 2. 開発・公開の前提

- 現行v9.7.75は、そのまま稼働・保守できる状態で残す。
- v10は別ソリューションとして作り、別URLで段階的に試験公開する。
- v10試験版では途中段階の不具合を許容する。完成まで一括移行する必要はない。
- v10開発中、v9リポジトリはread-onlyの仕様参照元として扱う。v10作業を理由にv9へ変更を混ぜない。
- v9とv10の保存領域は最初から完全に分離する。v10試験がv9の保存データを変更してはならない。
- v9保存データのimportはv10中核動作の成立後に行う。初期試験版の開始条件にはしない。

## 3. 全体構成と依存方向

```text
Game
├─ CharacterManager
├─ TerrainCatalog
├─ StageFactory
├─ SaveRepository
├─ SaveCodec
├─ SaveMigrator
├─ SaveService
├─ AudioController
├─ BattleScreen
│   ├─ BattleRenderer
│   ├─ BattleEffectManager
│   └─ DialogueController
└─ BattleController
    ├─ BattlePresentationPort
    ├─ BattleCheckpointPort
    ├─ BattleRandom
    ├─ Stage
    │   ├─ BattleMap
    │   │   └─ MapCell
    │   │       ├─ Terrain
    │   │       └─ Unit?
    │   ├─ unitsById
    │   │   └─ Unit
    │   │       └─ Character
    │   ├─ ArmyManager
    │   ├─ ObjectiveManager
    │   ├─ StageEventManager
    │   ├─ SpeechManager
    │   ├─ DialogueManager
    │   ├─ aiConfig
    │   ├─ mobCharacters
    │   ├─ unitOrder
    │   ├─ unitControlRules
    │   ├─ hiddenTraps
    │   └─ battleLog
    ├─ MovementService
    ├─ CombatService
    ├─ TacticService
    ├─ StatusService
    └─ AIService
```

基本依存方向:

```text
Game
→ BattleController
→ Stage / Services
→ Entity
```

画面・回復保存との境界は次のportで接続する。

```text
BattleScreen → BattleCommandPort ← BattleController
BattleController → BattlePresentationPort ← BattleScreen
BattleController → BattleCheckpointPort ← Game / SaveService adapter
```

- BattleControllerはBattleScreenを直接参照しない。
- BattleScreenはBattleControllerの具体型ではなくBattleCommandPortを使う。
- Gameが両者を生成して接続する。
- `BattlePresentationPort.present(request, abortSignal)` は狭い非同期境界とする。
- `BattleCheckpointPort.requestRecoverySave(snapshot)` はstable snapshotの保存要求だけを受ける。
- DialogueControllerはBattleScreen内部に置き、BattleControllerから参照しない。

## 4. Game

```text
initialize()
showTitle()
showStageSelect()
startBattle(stageId)
loadBattle(...)
endBattle(...)
disposeBattle()
```

Gameは戦闘ルール、AI、移動、勝敗、StageEvent、描画、Save mappingを持たない。

- `startBattle(stageId)` はStageを生成し、BattleControllerの `startNewBattle()` を開始する。
- `loadBattle(...)` はSaveServiceの `prepareLoad()` 成功後だけ新Battleへ交換し、`resumeLoadedBattle()` を開始する。
- BattleControllerは終了時にBattleResultのPromiseをresolveする。Gameがそれを受けて画面遷移する。
- BattleControllerからGameを逆参照しない。
- Battle切替時は旧Controllerを必ず `dispose()` する。
- Load準備中はGameがsession transition lockを掛け、旧Battleを表示したまま新commandを止める。prepareLoad失敗時は旧Battleを変更せずlockを解除する。
- 手動Save、Load、離脱等のapplication操作はBattleScreenからGameへのcallbackで通知し、戦闘rule commandと分ける。
- GameはControllerのstable snapshotをSaveServiceへ渡すだけで、Save mappingを行わない。
- visibility changeによる音声停止・再開はGame/BattleScreenとAudioControllerで現行挙動を維持する。

## 5. Unit

```text
Unit
├─ id
├─ character
├─ maxTroops
├─ troops
├─ move
├─ abilities
├─ facing
├─ actionState
├─ statusEffects
├─ maxUses
└─ remainingUses
```

Unitに持たせないもの:

```text
x / y / team / army / isAlive / isDeployed / moveOrigin
```

- 生存は `troops > 0` から導出する。
- 配置中かどうかはBattleMapのPosition有無から導出する。
- 所属はArmyManagerから導出する。
- `moveOrigin` と `undoMove()` は廃止する。

### UnitActionState

```text
READY
MOVED
TACTIC_COMMITTED
FINISHED
```

## 6. BattleMap / Position

実位置の唯一の正本はBattleMapとする。

```text
BattleMap
├─ getPosition(unit)
├─ getCellForUnit(unit)
├─ getCellAt(x,y)
├─ placeUnit(unit,position)
├─ moveUnit(unit,destination)
├─ removeUnit(unit)
└─ clearUnits()
```

- JavaScriptに引数違いのoverloadはないため、`getCell(unit)` と `getCell(x,y)` は作らない。
- `getPosition()` は外部から変更できないPosition値のコピーを返す。
- MapCell占有とprivate位置indexは、BattleMapのmutation APIだけで同期更新する。
- Runtime validationでMapCell占有と位置indexの相互整合性を検査する。
- Preview unit、previewDestination、candidatePathsをBattleMapへ入れない。
- 敗走Unitは `troops=0`、Armyには残し、BattleMapから除去する。

## 7. ArmyとUnit順

Unitにteamを持たせず、Army membershipを所属の唯一の正本とする。

```text
ArmyManager
├─ playerArmy
├─ enemyArmy
├─ getArmy(unit)
├─ getAffiliation(unit)
├─ areAllies(a,b)
├─ areEnemies(a,b)
└─ transferUnit(unit,targetArmy)
```

- 寝返りは `transferUnit()` で行う。
- 1Unitが複数Armyへ所属することを禁止する。
- AI等の同率判定順はArmyの現在配列順ではなく、immutableな `Stage.unitOrder` を使う。
- Armyへの追加、離脱、寝返りで `Stage.unitOrder` を変更しない。

## 8. Stage runtime

```text
Stage
├─ id
├─ chapterNumber
├─ title
├─ turn
├─ phase
├─ map
├─ unitsById
├─ unitOrder
├─ armyManager
├─ speechManager
├─ dialogueManager
├─ eventManager
├─ objectiveManager
├─ aiConfig
├─ mobCharacters
├─ unitControlRules
├─ hiddenTrapDefinitions
├─ hiddenTraps
├─ battleLog
├─ introDialogue
├─ victoryDialogue
└─ defeatDialogue
```

`unitOrder` は全UnitのDefinition順を保持するimmutable配列で、AIの決定的tie-breakに使う。

BattleLogEntry:

```text
sequence
turn
phase
type
text
unitIds[]
```

BattleControllerだけが `stage.battleLog.append()` を呼ぶ。ServiceとPresentationはBattleLogを直接変更しない。

### UnitControlRule

```text
unit: Unit
alwaysInactive: boolean
inactiveUntilEvent: StageEvent | null
activateOnCompletionDuringOwnPhase: boolean
actionLabel?: string
```

- 輸送隊等の非行動Unitや、寝返りまで静止するUnitを表す。
- Unit本体へstationary/canAct flagを追加しない。
- phase開始時はEvent完了状態から行動可否を導出する。
- gating Eventがactive Armyのphase途中で完了した場合、`activateOnCompletionDuringOwnPhase=true` のUnitだけをControllerがREADYにする。
- RuleはDefinition由来であり、進捗はcompletedEventIdsと保存済みactionStateから再構成する。Rule自体の進捗はSaveしない。

## 9. 透明Previewと移動経路

原則:

> 戻れる間はBattleScreen。戻れない選択が正式受理された瞬間からBattleController。

Preview中:

- 実Unitは元位置のまま。
- actionStateはREADYのまま。
- BattleMapを変更しない。
- Trap / StageEventを発火しない。
- BattleRandomを消費しない。

経路仕様:

- move allowance内のvalid simple pathとする。
- 同じcellを再訪しない。
- 通行不可cellと占有cellを通過しない。
- detourを許可する。
- 隣接Destinationは直行1stepだけとする。
- 選択中経路だけを薄い赤線で表示する。
- 5番目の操作ボタンは `[弓撃] [突撃] [計略] [待機] [経路 1/3]`。
- 候補経路は最大3本とする。
- 並び順は `移動cost → step数 → 各stepの(y,x)座標列辞書順` とし、RNGを使わない。
- priority queueを同じ順序で展開し、Destinationへ到達した先頭3本で探索を打ち切る。全simple pathを列挙しない。
- commit時にselectedPathを値コピーして固定する。
- commit後に再探索・rerouteしない。

### Preview位置からの行動照会

BattleMap上の実位置を書き換えず、次の一時DTOを使う。

```text
ActionQueryContext
├─ actor: Unit
└─ originPosition: Position
```

- `getAvailableActions()` と `getActionTargets()` はActionQueryContextを受け取る。
- originPositionはUNIT_SELECTEDでは実位置、MOVE_PREVIEWではpreviewDestinationとする。
- commit時は固定経路を実移動し、TrapとStageEvent連鎖の完了後、最終位置でActionRequestを再validationする。
- 再validationで無効になった場合は最終行動を取り消し、UnitをFINISHEDにする。
- 未実行の弓撃・突撃・計略使用回数は消費しない。

## 10. 実移動1cell処理

```text
1 次cellをvalidation
2 BattleMap.moveUnit()
3 初回実移動ならREADYからMOVED
4 MOVE Presentation
5 trigger対象Trapを1件解決
6 Trap効果をatomic commitし、Mapを同期
7 即時Defeat checkpointで結果をlatch
8 TRAP / DAMAGE Presentation
9 敗北でなければTRAP_TRIGGERED Event
10 actor生存時だけUNIT_REACHED Event連鎖
11 Event後Defeat checkpoint
12 Victory評価
13 actorを再validation
14 interruptMovementを確認
15 remainingPathを再validation
16 問題なければ次cell
```

移動開始後、Trap、StageEvent、残経路無効等で停止した場合:

```text
現在cellで停止
→ 予定最終行動を取消
→ FINISHED
```

停止理由を問わず、未実行の弓撃・突撃・計略使用回数は消費しない。

## 11. ActionRequestとFacing

```text
ActionRequest
├─ type
├─ actor
└─ target
```

ActionType:

```text
NORMAL_ATTACK
BOW_ATTACK
CHARGE
CONFUSION_LV1
CONFUSION_LV2
CONFUSION_LV3
ILLUSION
WIDE_ILLUSION
FIRE
WATER
```

WAITはActionTypeにしない。

Facing仕様:

- 通常攻撃、弓撃、突撃は対象方向へ自動Facingし、攻撃後の方向指定を行わない。
- 45度tieは東西優先とする: `NE→E / SE→E / SW→W / NW→W`。
- 計略は `READY→(MOVED)→TACTIC_COMMITTED→Facing→FINISHED`。
- 計略実行後、Battleが続く場合だけBattleScreenをTACTIC_FACING_SELECTへ移す。
- WAIT_FACING_SELECT中はDomainをREADYのままにし、Backを許可する。
- 待機はFacing確定時に経路とFacingを同時commitする。
- 目的地まで到達できた場合だけ選択Facingを適用する。

## 12. MovementService

```text
getReachableCells(unit,stage)
getCandidatePaths(unit,destination,stage,limit=3)
validatePath(unit,path,stage)
validateRemainingPath(unit,remainingPath,stage)
```

- 移動可能範囲、候補経路、経路validationだけを担当する。
- Unit、BattleMap、Armyを変更しない。
- 実位置変更はBattleControllerが `BattleMap.moveUnit()` を呼ぶ。
- Trap、StageEvent、Objective、UI、undoMoveを持たない。

## 13. CombatService / TacticService

- Combat/Tacticのvalidation、計算、Unitへの直接効果を担当する。
- BattleMap、Army、phase、Objective、StageEvent、UIを変更しない。
- v10初期移植では現行v9の計算式、使用回数、特殊ルールを維持する。
- AIやPreviewが使う `canExecute / inspectTargets / estimate` 系APIはread-onlyとし、実行APIと分ける。
- 実行APIは全対象の結果を先に計算し、awaitを挟まず一括commitする。
- validation失敗時はUnit、使用回数、RNGを変更しない。
- `CombatResult / TacticResult` は対象Unit参照、変更前後の兵力・状態、敗走有無、演出用の攻撃元/対象Position snapshotを持つ。
- Service結果直後、BattleControllerが敗走UnitをBattleMapから同期的に除去してから最初のawaitへ進む。

## 14. StatusService

```text
UnitStatus
├─ CONFUSED
└─ ILLUSION
```

CONFUSEDとILLUSIONは独立保持し、相互に削除・上書きしない。

phase開始時の処理順:

```text
1 処理開始時点で各statusのremainingTurns > 0を記録
2 正数のremainingTurnsを両方1減らす
3 開始時点でILLUSIONが有効ならILLUSION
4 それ以外でCONFUSEDが有効ならCONFUSION_SKIP
5 どちらも無効ならNONE
```

残り1のstatusもそのphaseでは効果を発揮し、処理後に消える。

例:

```text
CONFUSED=2
ILLUSION=1

次phase
→ 両方1減少
→ ILLUSION
→ CONFUSED=1が残る

次phase
→ CONFUSEDを1減少
→ CONFUSION_SKIP
```

```text
PhaseStartStatusResult
├─ NONE
├─ CONFUSION_SKIP
└─ ILLUSION
```

- StatusServiceは状態効果の種類まで決める。
- 幻術対象と経路はAIServiceが決める。
- FINISHED化とoperation進行はBattleControllerが行う。

## 15. 幻術ForcedAction

```text
ForcedActionRequest
├─ type
├─ actor
└─ target?
```

type:

```text
ILLUSION_ATTACK
ILLUSION_WAIT
```

```text
ForcedActionPlan
├─ request
└─ selectedPath
```

対象優先順位:

1. 低移動コスト
2. 低兵力
3. `Stage.unitOrder` の早い順

- 対象選択にRNGを使わない。
- ILLUSION_WAITはFacingを変更しない。
- ILLUSION_WAITはBattleRandomを消費しない。
- ForcedActionPlanは判断時に1回だけ作り、実行途中で再計画しない。
- 実移動する場合は通常移動と同じBattleMap、Trap、StageEvent処理を通す。

## 16. Trap

TrapはStageEventではない。

```text
HiddenTrap
├─ id
├─ kind
├─ position
├─ active
└─ triggerAffiliations[]
```

- Previewでは発動しない。
- 実移動中の各cellで判定する。
- 最初のtrigger対象active trapで停止する。
- planned final actionを取り消す。
- 未実行の使用回数は消費しない。
- 幻術の強制実移動でも同じ判定を行う。
- 発動したTrapは `active=false` にする。
- 対象外Unitが通過しただけならactiveのままにする。
- `triggerAffiliations` はArmyManagerの現在所属に対して判定する。
- 初期移植の現行StageではPLAYERを指定する。
- Trap回避能力とSpell trap免疫はUnit.abilitiesを使う具体ルールとして現行v9から移植する。
- 回避した場合はTrapを消費しない。
- Spell trapの数値、対象、免疫能力IDは実装時に現行sourceと人物能力正本を直接照合する。

新規BattleではBattleControllerがhiddenTrapDefinitionsとBattleRandomからactive HiddenTrapを生成する。Loadでは保存済みhiddenTrapsをそのまま復元し、再生成しない。

## 17. StageEvent

汎用Condition/Action engineは作らない。

Trigger:

```text
PHASE_START
AFTER_OPERATION
UNIT_DEFEATED
UNIT_REACHED
TRAP_TRIGGERED
```

- 各Eventは重複のない`triggers[]`を持ち、複数の発火時機をOR条件として扱える。
- 同じEventが複数triggerから成立しても、先に成立した1回だけを完了する。
- Definition読込時は移行用に単一`trigger`も受理し、runtimeでは`triggers[]`へ正規化する。

具体Event:

```text
ReinforcementEvent
BetrayalEvent
MissionTransitionEvent
DialogueEvent
```

共通依存:

```text
requiredCompletedEvents[]
```

自己参照と循環依存は禁止する。

```text
StageEventResult
├─ completed
├─ interruptMovement
└─ presentationRequests[]
```

- `movementCommitted` は廃止する。
- StageEventが返せるpresentationRequestsは当面DIALOGUEとNOTICEだけとする。
- DOM、具体SE/BGM、render、InteractionModeを含めない。
- `interruptMovement=true` はStageEvent連鎖を止めない。
- 連鎖終了後の残り実移動だけを止める。

### StageEvent連鎖アルゴリズム

```text
1 発火したtriggerをtriggers[]に含む未完了EventをDefinition順に走査
2 requiredCompletedEventsと具体条件を満たす最初のEventを実行
3 Domain action成功後にcompletedEventIdsへ記録
4 presentationRequestsを順番に収集
5 interruptMovementをOR集約
6 不可逆変更なら即時Defeat checkpoint
7 敗北でなければ先頭から再走査
8 新たに実行可能なEventがなくなるまで反復
9 収集済みPresentationを順番に表示
```

同一Eventは1回だけ完了できる。`interruptMovement` では連鎖を止めないが、Battle終了がlatchされた場合は残りEventを実行しない。

Trigger payloadと発火時点:

- `PHASE_START`: 新規phaseの開始処理中に1回。
- `UNIT_DEFEATED`: 1operationの全対象atomic反映後、敗北checkpointを通過した場合にService結果順で処理。
- `UNIT_REACHED`: 実移動の各cell確定後。Trapでactorが敗走した場合は発火しない。
- `TRAP_TRIGGERED`: Trap効果のatomic反映と敗北checkpoint後。
- `AFTER_OPERATION`: 通常行動、待機、ForcedActionの全処理後に1回。

### ReinforcementEvent

- 全候補UnitはStageFactoryで生成済みにする。
- 発生時は `Unit取得→配置位置探索→Army.add→BattleMap.place`。
- 配置位置探索は現行v9と同じ「指定位置から半径0〜4の最寄り空きcell」とする。
- Definition順と固定走査順で探索し、RNGを使わない。
- 厳密な走査順は実装時にv9実ファイルからそのまま移植する。
- 配置失敗時はArmy未所属、Map未配置のままにする。
- 配置失敗でもEvent自体はcompletedとする。

### BetrayalEvent

```text
units[]
targetArmy
newFacing?
confusionTargetArmy?
confusionTurns?
presentationRequests[]
```

- 所属変更は `ArmyManager.transferUnit()` を使う。
- transfer後もStage.unitOrderを変更しない。
- UnitControlRuleのgating解除はEvent完了と同じtransaction内でControllerが反映する。

### MissionTransitionEvent

- Event完了そのものを任務進行に使う。
- 第三章例では `raid_complete` によりObjectiveのactive/inactive gatingを切り替える。
- `StageEvent = 任務進行`、`Objective = 最終勝敗条件` と分離する。

### DialogueEvent

- 一度だけ発生する会話・通知を表す。
- 高唐州の初回Trap会話はTRAP_TRIGGEREDのDialogueEventとする。
- 専用booleanを増やさず、Event IDをcompletedEventIdsに保存する。

## 18. Objective

具体型:

```text
EliminationObjective
ReachObjective
UnitDefeatObjective
TurnLimitObjective
SurviveUntilTurnObjective
```

- Victory Objective同士はORとする。
- Defeat Objective同士もORとする。
- AND条件は各Objective内部で表す。
- ReachObjectiveはUnitをBattleMapから消さない。
- 到達はBattleMapの現在Positionから判定する。
- `activeAfterEvent / inactiveAfterEvent` を持てる。
- Objective専用進捗はSaveしない。
- EliminationObjectiveは現在Army所属かつ `troops > 0` のUnitだけを数える。
- 将来増援のArmy未所属Unitは数えない。
- 将来増援まで撃破条件に含めるStageは、最後の増援Event完了までObjectiveをgatingする。

```text
ObjectiveManager
├─ evaluateVictory(stage)
├─ evaluateDefeat(stage)
├─ evaluatePlayerPhaseEndDefeat(stage)
└─ evaluatePlayerPhaseStartVictory(stage)
```

返却値は `Objective | null`。

Timing:

- 危険な不可逆Domain変更直後にDefeat checkpointを入れる。
- Victoryは関連する論理処理とEvent連鎖の完了後に評価する。
- 同一operationでVictoryとDefeatが同時成立した場合はDefeatを優先する。
- 最終Player Turn終了時は `Victory→TurnLimit defeat→Enemy phase`。
- SurviveUntilTurnは対象Player phase開始時、phase-entry EventとStatus処理後、入力前に評価する。

## 19. Speech / Dialogue

DialogueLineは廃止してSpeechへ統合する。

```text
Speech
├─ id
├─ speaker: Character
├─ text
└─ actionLabel?

Dialogue
├─ id
└─ speeches: Speech[]
```

- SpeechManagerとDialogueManagerはread-only data managerとする。
- RuntimeではdialogueIdではなく解決済みDialogue参照を使う。

```text
DialogueController
├─ dialogue
├─ currentIndex
├─ start()
├─ getCurrentSpeech()
├─ advance()
├─ finish()
└─ isActive
```

- DialogueControllerはDOMを知らない。
- Dialogue playback途中状態はSaveしない。

## 20. Presentation境界とcancel

```text
StageEventResult.presentationRequests
→ BattleController
→ await BattlePresentationPort.present(request, abortSignal)
→ BattleScreen implementation
```

- BattleScreenは表示を行い、完了時にPromiseをresolveする。
- BattleScreenが戦闘進行を自分から再開しない。
- PresentationRequestはUI命令ではなく、意味を表すdiscriminated unionとする。

```text
DIALOGUE
NOTICE
MOVE
ACTION
DAMAGE
STATUS
TRAP
PHASE
CONFIRM
BATTLE_RESULT
```

- DOM node、CSS class、画像ID、SE/BGMファイル名、InteractionModeを含めない。
- BattleScreenが意味要求を具体的な描画と音へ変換する。
- BattleEffectManagerからAudioControllerを利用する。
- BattleControllerはAudioControllerを参照しない。
- Presentationの非abortエラーはControllerが記録し、同期renderへのfallback後に論理処理を続ける。確定済みDomainを再実行・rollbackしない。

ControllerはBattleごとのAbortControllerとdisposed flagを持つ。

- `dispose()` はidempotentにabortする。
- すべてのawait後にabort/disposedを確認する。
- 画面切替後の旧Presentation完了でDomain処理を再開しない。
- abortは正常なlifecycle終了として扱い、不要なerror表示を出さない。

## 21. AIService

```text
AIService
├─ selectNextEnemyUnit(stage)
├─ planEnemyTurn(unit,stage)
├─ planIllusionAction(unit,stage)
└─ private concrete planners...
```

AIServiceは考えるだけで、Unit、BattleMap、Army、damage、status、remainingUsesを変更しない。

```text
EnemyTurnPlan
├─ kind: ACTION | WAIT
├─ request?
├─ selectedPath[]
└─ finalFacing?
```

- v10初期移植ではAIを賢くしない。
- 現行の個別ルールをprivate plannerへ移す。
- 巨大BehaviorTreeや汎用ScoreEngineを作らない。
- Stage固有AIはStage.aiConfigにRuntime Unit参照で保持する。
- Stage.aiConfigは、参謀、慎重な火計・水計役、広域幻術と抑止役、追捕隊、
  優先標的をDefinition上のUnit IDからRuntime Unit参照へ解決して保持する。
- 大名府追捕隊の門列・城内最終行・城外開始行もStage.aiConfigへ置き、
  AIServiceへ章IDやUnit IDの直書きを持ち込まない。
- MovementServiceとCombat/Tacticのread-only APIだけを使う。
- planは実際に行動させる決定点で1回だけ作る。
- Preview、候補表示、失敗commit、再描画でplanを作り直さない。
- 同率判定はStage.unitOrderを使う。

## 22. BattleRandom

- Save必須とする。
- Previewとread-only queryで消費しない。
- commit前validation失敗で消費しない。
- Domain結果を確定する実際の判断だけで消費する。
- EnemyTurnPlanとForcedActionPlanはvalidation後に1回だけ作り、同じ行動の再評価で再消費しない。
- random trap placementは新規Battle初期化時だけ消費する。
- Load時は保存済みstateを復元し、trap再生成で消費しない。
- Audio、UI装飾、Repository operation ID等の非Domain乱数は別系統を使う。

## 23. BattleController

責務は「Domain上で何を、どの順で、いつ確定させるか」。

public API候補:

```text
startNewBattle() -> Promise<BattleResult>
resumeLoadedBattle() -> Promise<BattleResult>
dispose()
getStage()
getBattleResult()
isStableForSave()
createSaveSnapshot()
getReachableCells(unit)
getCandidatePaths(unit,destination)
getAvailableActions(actionQueryContext)
getActionTargets(actionQueryContext,actionType)
executeAction(actionRequest,selectedPath)
executeWait(actor,selectedPath,finalFacing)
finalizeTacticFacing(actor,facing)
endPlayerTurn()
```

`executeAction()` と `executeWait()` は `Promise<boolean>` を返す。

- `false`: commit前validation失敗。DomainとRNGの変更なし。
- `true`: 正式受理。

private主要処理:

```text
validateActionCommit()
executePlannedAction()
executeWaitPlan()
executeCommittedMovement()
executeActionByType()
resolveTrap()
resolveStageEventChain()
resolveConsequences()
resolveDefeatCheckpoint()
executeForcedAction()
executeEnemyPlan()
runEnemyPhase()
startPhase()
processPhaseStartStatuses()
advancePhase()
finishBattle()
```

FlowState:

```text
IDLE
RESOLVING_ACTION
TURN_TRANSITION
FINISHING
FAULTED
```

FlowStateはSaveしない。

Command guard:

- すべてのpublic mutation commandはphase、FlowState、Army所属、BattleMap上の生存、UnitActionState、UnitControlRuleを入口で検証する。
- mutation commandは直列化し、同時commandとdouble tapを受け付けない。
- commit前に拒否した場合はDomainとRNGを変更しない。
- 予期しないinvariant違反やDomain実行例外は `false` にせず、ControllerをFAULTEDへ移す。
- FAULTEDでは入力とSaveを禁止し、診断情報を残してGameへerrorを返す。推測rollbackや処理継続は行わない。

### 攻撃・計略のConsequence解決順

```text
1 commit前validation
2 必要なACTION Presentation
3 Serviceが全対象を計算して同期的にatomic commit
4 敗走UnitをBattleMapから除去し、actionState/useを同期確定
5 即時Defeat checkpointで結果をlatch
6 DAMAGE / STATUS等の結果Presentation
7 敗北がlatch済みならfinishBattleして終了
8 UNIT_DEFEATED Event連鎖
9 Eventによる変更直後のDefeat checkpoint
10 AFTER_OPERATION Event連鎖
11 Victory評価
```

- Defeat checkpointはawaitを挟まず評価し、成立結果をlatchする。結果演出を表示しても、その間に追加Domain処理を行わない。
- 敗北成立時は以後のEvent、Victory、次行動へ進まない。
- Presentation中もcommand lockを維持する。
- Tactic成功後にBattleが続く場合だけTACTIC_COMMITTEDでIDLEへ戻す。
- BattleScreenがTACTIC_COMMITTEDを見てTACTIC_FACING_SELECTへ入る。
- 正式受理後に最終行動だけ取り消された場合も、Battleが続くならAFTER_OPERATIONを1回実行する。
- TACTIC_FACING_SELECTのFacing確定ではAFTER_OPERATIONを再実行しない。

### Battle終了

- `finishBattle()` は1回だけ実行できる。
- result Presentation後にBattleResult Promiseをresolveする。
- GameがPromiseを受けて `endBattle()` を行う。
- ControllerはGameへcallback以外の逆参照を持たない。
- `dispose()` でBattleを破棄した場合は未完了PromiseをAbortErrorでsettleし、Gameが正常な画面切替として処理する。

## 24. Phase

- Player phaseは手動終了とする。
- READY Unitが残っていてもターン終了できる。
- 終了確定時、残READYをFINISHEDにする。
- MOVEDまたはTACTIC_COMMITTEDがいる場合はphase transitionを拒否する。

phase開始処理:

```text
phase / turn更新
→ TURN_TRANSITION
→ PHASE_START Event連鎖
→ active Armyを再取得
→ UnitControlRuleを適用
→ 行動可能UnitだけREADY、非行動UnitはFINISHED
→ Status処理を1Unitずつ実行
→ 各ForcedAction後にConsequence / Event / battle check
→ SurviveUntilTurn等を評価
→ IDLE
```

- Status処理中にArmyが変わる可能性があるため、Controller localの `processedUnitIds:Set` を使う。
- processedUnitIdsはSaveしない。
- Enemy phaseは固定indexではなく、その時点の残りREADY Unitから動的に選ぶ。

### 新規開始とLoad再開

`startNewBattle()` だけが次を行う。

```text
BattleRandom初期化
→ random trap生成
→ intro Dialogue
→ 最初のPlayer phase開始処理
```

`resumeLoadedBattle()` は保存済みturn、phase、RNG、Trap、UnitActionStateをそのまま再開し、次を再実行しない。

```text
intro Dialogue
random trap生成
PHASE_START Event
status duration減算
UnitのREADY reset
turn加算
```

- Player phaseに正当なTACTIC_COMMITTEDがあれば、BattleScreenはTACTIC_FACING_SELECTを導出する。
- Enemy phaseなら保存時点のREADY UnitからAI処理を再開する。
- 保存時点でFINISHEDのUnitは再行動させない。

## 25. BattleScreen / InteractionMode

```text
UNIT_SELECT
UNIT_SELECTED
MOVE_PREVIEW

CONFUSION_LEVEL_SELECT

BOW_TARGET_SELECT
CHARGE_TARGET_SELECT
CONFUSION_LV1_TARGET_SELECT
CONFUSION_LV2_TARGET_SELECT
CONFUSION_LV3_TARGET_SELECT
ILLUSION_TARGET_SELECT
FIRE_TARGET_SELECT
WATER_TARGET_SELECT

WAIT_FACING_SELECT
TACTIC_FACING_SELECT

LOCKED
```

`NORMAL_ATTACK_TARGET_SELECT` は作らない。通常攻撃はUNIT_SELECTEDまたはMOVE_PREVIEWから敵Unitを直接tapする。

UI state:

```text
selectedUnit
previewDestination
candidatePaths[]
selectedPathIndex
reachableCells
selectableTargets
```

selectedPathは `candidatePaths[selectedPathIndex]` から導出する。

- 別の行動可能自軍Unitをtapしたら直接選択を切り替える。
- TargetSelect中の無効tapでは選択解除しない。
- MOVE_PREVIEW中に元位置をtapしたらUNIT_SELECTEDへ戻る。
- MOVE_PREVIEW中に移動範囲外をtapしたらUNIT_SELECTへ戻る。
- WAIT_FACING_SELECTはBack可。
- TACTIC_FACING_SELECTはBack不可。
- LOCKED中は入力を無効にする。
- Load後は保存しないUI stateを復元しない。
- 通常LoadはUNIT_SELECT、正当なTACTIC_COMMITTEDが1件ある場合だけTACTIC_FACING_SELECTから再開する。

## 26. BattleRenderer / BattleEffectManager

- BattleRendererは `Stage + BattleViewState` を描くだけで、DomainとInteractionModeを変更しない。
- BattleEffectManagerはDomainを変更せず、確定済み結果の見せ方だけを担当する。
- BattleEffectManagerはPresentationRequestに応じてAudioControllerを利用できる。
- 演出失敗をDomain再実行で補償しない。必要なら画面を再renderし、確定済みDomainを正本とする。

## 27. Save

SaveRepositoryの現行の強みを維持する。

```text
primary
temporary
backup
revision
writerId
conflict検出
書込み後検証
```

### v9との保存領域分離

v10試験版のRepository key prefixは次で固定する。

```text
senki_suikoden_v10_test_save_v1:
```

- primary、temporary、backup、recovery、slot keyはすべてこのprefix配下に置く。
- v9の `senki_suikoden_save_v2` と既存recovery keyを自動探索、更新、削除しない。
- `saveFormatVersion` とkey namespace versionは別概念とする。

### SaveDocument

```text
saveFormatVersion = 6
gameVersion
contentRevision
saveKind
slotId
revision
writerId
savedAt
battle
```

BattleSaveData:

```text
stageId
turn
phase
randomState
units[]
hiddenTraps[]
completedEventIds[]
logs[]
```

UnitSaveData:

```text
id
army: PLAYER | ENEMY | null
troops
position | null
facing
actionState
statusEffects[]
remainingUses
```

保存表現:

- `units[]` には初期Unit、将来増援、配置失敗Unitを含むStage全Unitを1回ずつ保存する。
- 敗走Unitは `troops=0 / army!=null / position=null`。
- 未登場または配置失敗の増援Unitは `army=null / position=null`。
- statusEffectsは `{type, remainingTurns}` の配列をstatus enum順に保存する。
- hiddenTrapsは `{id, kind, position, active, triggerAffiliations}` を保存する。
- logsは表示済み文字列を含むdata-onlyなBattleLogEntryとして保存する。
- logsへRuntime object参照を含めない。

保存しないもの:

```text
Character
maxTroops / move / abilities / maxUses
UI Preview / InteractionMode
Dialogue途中
FlowState
Objective専用進捗
moveOrigin / previous
EnemyTurnPlan / ForcedActionPlan
processedUnitIds
```

### Stable save判定

次をすべて満たす場合だけ保存できる。

```text
FlowState == IDLE
disposed / FINISHING / FAULTEDではない
Presentation・command・phase transitionが進行中ではない
MOVEDのUnitが0件
全UnitがREADY / FINISHED、または下記TACTIC_COMMITTED例外
```

TACTIC_COMMITTED例外:

- Player Armyの生存・配置済みUnitがちょうど1件だけTACTIC_COMMITTED。
- 他UnitはREADYまたはFINISHED。
- 計略効果と使用回数は確定済み。
- Load後のTACTIC_FACING_SELECTをDomainから一意に導出できる。

したがってTACTIC_COMMITTEDは条件付きstable、MOVEDは常にunstableとする。

- Preview中でもDomainがstableなら保存できる。
- Preview UIは保存せず、Load後はUNIT_SELECTから再開する。
- Enemy phaseでは、1Unitのoperation完了後かつ次plan作成前をstable checkpointとする。
- Enemy checkpointではREADY/FINISHEDを保存し、Load後は残りREADY Unitから再開する。
- Controllerはstable checkpointでimmutable BattleSaveDataをBattleCheckpointPortへ通知する。
- PortはSaveServiceのrecovery save queueへ渡し、Repository I/Oを戦闘進行へ直結させない。
- Queueは同一slotをrevision順に直列化し、古い完了結果で新しいsnapshotを上書きしない。

## 28. SaveCodec / SaveMigrator / SaveService

### SaveCodec

```text
encode()
decode()
validateShape()
```

- Domainを知らない。
- JSON shape、enum、型、必須fieldを検査する。

### SaveMigrator

- pure transformationとする。
- Stage固有ID対応を外部から受け取るimmutable MigrationCatalogに依存してよい。
- StageFactoryとRuntime objectには依存しない。
- v10初期試験版はv6だけを読込み対象とする。
- 初期実装はv6 passthroughから始め、後で段階migrationを追加する。

将来のv9→v10明示import方針:

- `hasActed=true → FINISHED`。
- `hasMoved=false && actionCommitted=false && hasActed=false → READY`。
- actionCommittedと最終Facing待ち情報が整合する場合だけTACTIC_COMMITTED。
- `hasMoved=true && !hasActed && !actionCommitted` 等の曖昧状態はmigration failure。
- v9 Event flag、増援結果、高唐州の一度きりTrap会話はMigrationCatalogでEvent IDへ明示mappingする。
- 不明値を推測しない。
- 元v9保存を変更しない。
- v9 namespaceを自動importしない。
- ユーザーが明示的にimportを選んだ場合だけ読取り、成功後にv10 namespaceへ新規保存する。

### SaveService

```text
repository
codec
migrator
stageFactory
saveBattle()
enqueueRecoverySave()
prepareLoad()
inspectSlots()
deleteSlot()
repairSlot()
handleStorageEvent()
```

Transactional load:

```text
Repositoryからraw取得
→ Codec.decode
→ Migrator
→ SaveData validation
→ StageFactory.create(stageId)
→ 新StageへSave state復元
→ Runtime全体validation
→ PreparedBattleLoad作成
→ Gameが新Controller / Screenを非表示状態で生成・接続validation
→ 成功後だけ旧Battleをdisposeして参照を交換
→ resumeLoadedBattle()
```

- 途中失敗なら旧Battleを変更しない。
- SaveServiceはDOM、BattleScreen、旧Controllerを変更しない。
- transactional保証の範囲はdecodeから新session接続validationまでとする。交換後の実行例外は新ControllerをFAULTEDへ止める。
- 初期試験版ではcontentRevisionの完全一致を要求する。
- contentRevision不一致は安全なLoad失敗とする。
- migration後の書戻しが必要な場合もBattle交換成功後にだけ行う。

```text
PreparedBattleLoad
├─ document
├─ stage
├─ randomState
├─ resumeContext
└─ sourceRevision
```

resumeContextは保存済みphaseとTACTIC_COMMITTEDの有無から再開方法を表す。Preview、InteractionMode、Dialogue途中状態を持たない。

## 29. StageFactory

公開API:

```text
create(stageId) -> Stage
```

StageFactoryはSaveDataを知らない。

生成順:

```text
1 Definition基本検証
2 mobCharacters
3 全Unitsとimmutable unitOrder
4 BattleMap
5 Army / ArmyManager
6 初期Army登録
7 初期Map配置
8 Speech
9 Dialogue
10 全StageEvent instance生成（依存ref解決前）
11 Event ID ref解決、requiredCompletedEvents接続、循環検査
12 StageEventManager
13 Objective生成とEvent/Unit ref解決
14 ObjectiveManager
15 StageAIConfig生成とUnit ref解決
16 hiddenTrapDefinitions
17 unitControlRulesとintro/victory/defeat Dialogue ref
18 Stage生成
19 Runtime全体validation
20 return
```

- global CharacterManagerとStage mobCharactersのID衝突はエラーとする。
- Eventは二段階生成し、後方参照をDefinition順に依存せず解決する。
- ObjectiveはEvent refが必要なためEvent解決後に作る。
- AIConfigはDefinitionではID、RuntimeではUnit参照を使う。
- StageFactoryでBattleRandomを消費しない。
- random trapは新規Battle開始時にBattleControllerが生成する。
- LoadではSaveDataのtrapをSaveServiceが復元する。
- Definition validationとRuntime validationの二段構えにする。
- UnitFactory、EventFactory等はまだpublic class化せず、StageFactory private helperで対応する。
- Stageは元Definition objectを保持しない。

Runtime validation対象:

- Unit IDとCharacter IDの一意性。
- UnitのArmy重複所属。
- MapCell占有とBattleMap位置index。
- troops、Army、positionの組合せ。
- Event、Objective、AIConfig、Dialogue、UnitControlRuleの参照先。
- requiredCompletedEventsの自己参照と循環。
- completedEventIdsが当該StageのEvent IDだけであること。

## 30. Runtime参照とID参照

| 場所 | 使用形式 | ルール |
|---|---|---|
| Stage Definition | ID | data-only。Runtime objectを持たない |
| Stage Runtime | object ref | Unit、Character、Dialogue、Event、Objective、AIConfigを解決済み参照で結ぶ |
| BattleMap / Army | Unit ref | 座標・所属の正本。Unit IDから都度推測しない |
| completedEventIds | ID | Save可能なEvent完了の正本 |
| SaveDocument | ID / primitive | Runtime ref、DOM、関数を含めない |
| BattleLog | ID / text snapshot | 後のCharacter変更で過去表示を変えない |
| PresentationRequest | battle内ref / snapshot | abort可能な同一Battle session内だけで使用し、Saveしない |

## 31. 一時DTO

plain objectとJSDocでよい。

```text
ActionQueryContext
CombatResult
TacticResult
StageEventResult
ConsequenceOutcome
PhaseStartStatusResult
ForcedActionRequest
ForcedActionPlan
EnemyTurnPlan
PresentationRequest
PresentationResponse
PreparedBattleLoad
BattleResult
BattleViewState
```

作らないもの:

```text
MovementResult
generic ActionResult
moveOrigin
undo hierarchy
```

## 32. v9から意図的に変えるv10仕様

次は移植ミスではなく、承認済みのv10仕様として扱う。

- CONFUSEDとILLUSIONを独立保持し、ILLUSIONがCONFUSEDを削除しない。
- ILLUSION_WAITはFacingを変更せず、BattleRandomも消費しない。
- 幻術による実移動も、trigger対象であればTrapを発動させる。

それ以外の計算式、AIの賢さ・優先度・使用率、人物能力、Stage固有挙動、演出・音声はv9.7.75を維持する。

## 33. 実装順

```text
0 v10別ソリューション、別URL前提の骨格、test環境、保存namespace固定
1 Character / Unit / Terrain
2 Map / Cell / Army
3 Stage / Definition / Factory
4 MovementとPreviewの最小縦切り
5 Combat / Tactic
6 Objective / Event / Trap
7 Status / AI / Dialogue
8 BattleControllerとPresentation Port
9 BattleScreen / Renderer / Effect
10 Save v6 / Repository / transactional Load
11 各章を順次移植
12 v9との回帰比較
13 必要になった時点でv9明示importを追加
```

- 各段階でv10 URLへ不完全版を出して試験してよい。
- 全機能完成まで公開を待つbig-bang方式にはしない。
- 保存namespace、BattleMap位置一元化、RNG境界、transactional Loadは後付けせず最初から守る。

## 34. 最小検証gate

各層を実装する際、少なくとも次を自動testまたは再現手順で確認する。

| Gate | 合格条件 |
|---|---|
| Map整合 | place/move/remove後にMapCell占有とposition indexが一致する |
| Preview無副作用 | Preview操作前後でStage snapshotとBattleRandom stateが一致する |
| 失敗commit | `executeAction() == false` の前後でDomainとRNGが一致する |
| 経路決定性 | 同じStageから常に同じ順の最大3経路を返す |
| Event連鎖 | dependency連鎖をDefinition順で全処理し、interruptでも連鎖を中断しない |
| Status併存 | CONFUSED=2 / ILLUSION=1がILLUSION後にCONFUSED=1を残す |
| 新規/Load分離 | LoadでPHASE_START、status減算、trap生成、turn加算が再実行されない |
| Stable save | MOVEDを拒否し、正当なTACTIC_COMMITTEDとEnemy checkpointを復帰できる |
| 保存分離 | v10のSave/Load/Delete後もv9 key値がbyte単位で変わらない |
| Transactional Load | decode/migrate/restore/validation各失敗で旧Battleが変わらない |
| 起動時recovery | 正常候補がある場合は明示選択までBattleを生成せず、Load時にintro/phase処理を再実行しない |
| DOM session交換 | candidateをdetached rootで接続後、表示rootを1個だけにし、旧button/cell listenerを解除する |
| Save UI競合 | stale guardでSave/Load/Repair/Deleteせず、旧sessionと三世代rawを維持して再確認を要求する |
| Cancel | dispose後に旧awaitが完了してもDomain、画面、新Battleへ作用しない |
| AI/RNG | 同じStageとrandomStateから同じplanと結果になる |
| Fault停止 | unexpected error後はFAULTEDとなり、二重commitとSaveを受け付けない |

## 35. 現在の到達点

統合レビューを完了し、次を設計決定済みとする。

- 責務重複と抜け。
- 具体UIへの循環依存。
- Runtime参照とID参照。
- Preview位置でのquery境界。
- Event連鎖、Trap、Consequence、Objectiveの順序。
- 新規BattleとLoad再開の分離。
- Stable saveとTACTIC_COMMITTED復帰。
- StageFactoryの二段階Event解決。
- 非同期cancel/dispose。
- Domain乱数と非Domain乱数の分離。
- 別URL開発とv9/v10保存分離。
- stable recovery checkpointの通知責務。
- 予期しない失敗時のFAULTED停止。

実装順0〜10のうち、v10骨格、Domain、Factory、Movement、Combat/Tactic、
Objective/Event/Trap、Status/AI/Dialogue、BattleControllerとPort、BattleScreen、
BattleRenderer、BattleEffectManager、Playerの全Action選択UI、Save format 6、三世代Repository、
transactional Load境界までMilestone 8で実装済みである。Milestone 9ではGame lifecycle、
detached DOM上のBattleViewFactory、BattleSessionFactory、起動時recovery選択、手動
Save／Load／削除UIを接続した。Milestone 10では手動slotをv9同数の20枠へ正式化し、
正常なtemporary／backupをprimaryへ明示昇格するRepairを追加した。画面から通常攻撃、弓撃／投擲、突撃、
撹乱Lv1〜3、幻術、広域幻術、火計、水計、待機、方向確定、Player phase終了を操作でき、
stable checkpointはv10 recovery slotへ自動保存される。Load候補は旧Battleと別のDOM rootで
接続検証し、activate成功後だけ旧sessionをdisposeする。Milestone 11ではv9と同一byteの
音声20点、AudioController、意味要求からのcue mapping、BGM lifecycle、音声unlock／toggle、
visibility停止・再開、Battle単位の一時音cancelを実装した。後続実装を妨げる未決定事項はない。
Milestone 12ではv9と同一byteの戦闘演出画像8点を分離し、BattleVisualEffectSession、
盤面と独立したeffect layer、移動・弓・突撃・計略・状態変化・被害表示を接続した。
継続中の突撃砂煙は盤面再描画に巻き込まれず、Load／新規開始／disposeでは旧Battleの
演出DOMとtimerを一括破棄する。広域幻術は霧開始から300ms後に専用SE、2240ms後に
幻術cast音と範囲flashへ進むv9順序に合わせた。Save形式、戦闘式、AI、Domain RNGは変更していない。

次は設計未決ではなく、実装時に正本から転記・照合する項目である。

- 戦闘・計略の数値と使用回数。
- 個別AIの優先順位と確率。
- 増援cellの厳密な走査順。
- Trap回避とSpell trap免疫の能力ID。
- 正式人物portrait、Action cut-in、Stage map、title／結果画面のmapping・同期時間。
- 人物能力、技能、性格。

## 36. 次に行うこと

統合レビューとMilestone 12までは完了済み。20枠のSave UI、fallback Repair、既存音声、
戦闘画像演出の分離実装まで完了したため、
実装順11以降を進める。

```text
1 title／勝利／敗北の専用画面と結果演出
2 正式人物データ入手後にportrait／Action cut-inと正式Stageを順次移植
3 Stage map画像を正式Stageへ接続
4 v9との回帰比較
```

以後、新しい設計問題は `問題 / 影響 / 修正案` で提示する。承認のないゲーム実装、v9変更、ゲームバランス変更、AI性能変更は行わない。
