# v10 実装状況 Milestone 5

作成日: 2026-09-08

## 完了

- BattleControllerでPlayer command、phase transition、Enemy phaseを直列化。
- FlowStateとしてIDLE / RESOLVING_ACTION / TURN_TRANSITION / FINISHING / FAULTEDを実装。
- commit済み経路を1cellずつ処理し、MOVE、Trap、Event、Objective、残経路validationを統合。
- Action後に敗走UnitをBattleMapから同期除去し、最初の演出awaitより前にDefeatをlatch。
- Combat / Tactic結果からdata-onlyのACTION / DAMAGE / STATUS要求を生成。
- Trap結果からTRAP / DAMAGE / STATUS要求を生成。
- Player計略後のTACTIC_COMMITTEDと明示Facing確定を実装。
- READYが残っていても可能なPlayer phase終了と、Enemyの残存READY動的選択を実装。
- `startNewBattle()`と`resumeLoadedBattle()`を分離。
- Enemy phase途中のLoadではFINISHEDを再行動させず、残存READYだけを処理。
- 幻術同士討ち用の専用味方通常攻撃をCombatServiceへ追加。
- BattlePresentationPort / BattleCheckpointPortと無処理adapterを追加。
- stable checkpointのimmutable BattleSaveData生成を追加。
- Presentation失敗を診断記録へ隔離し、回復保存通知を非blocking化。
- dispose時のAbortと、予期しないDomain例外時のFAULTED停止を実装。

## 固定した処理順

### 1cell移動

```text
残経路validation
→ BattleMap.moveUnit
→ MOVE Presentation
→ Trap atomic commit / Map同期 / 即時Defeat
→ TRAP / DAMAGE / STATUS Presentation
→ TRAP_TRIGGERED Event
→ UNIT_REACHED Event
→ Defeat / Victory
→ actor・残経路再validation
```

### Action結果

```text
commit前validation
→ ACTION Presentation
→ Service atomic commit
→ 敗走UnitのMap除去とactionState確定
→ 即時Defeat latch
→ DAMAGE / STATUS Presentation
→ UNIT_DEFEATED Event
→ AFTER_OPERATION Event
→ Victory
```

## 保存・再開境界

- MOVEDは保存不可。
- Player Armyの生存・配置済みUnitが1件だけのTACTIC_COMMITTEDは保存可能。
- Enemy phaseでは各Unit完了後、次Plan作成前にcheckpointを通知。
- BattleSaveDataはturn、phase、BattleRandom state、全Unit、Trap、completedEventIds、Logを保持。
- 新規開始だけがTrap生成、Intro、最初のPHASE_START、status減算を実行。
- Load再開では上記を再実行せず、保存済みturn / phase / actionStateを使う。

## 検証結果

- Node自動test: 91件成功。
- BattleControllerの新規開始、移動攻撃、Trap中断、計略方向待ち、Enemy phase: 成功。
- Player / Enemy phaseのLoad再開分離: 成功。
- Preview commit失敗時のDomain / BattleRandom無変更: 成功。
- TACTIC_COMMITTED snapshotと全階層freeze: 成功。
- 幻術同士討ち専用経路と通常commandの味方攻撃拒否: 成功。
- dispose中断、Presentation失敗継続、回復保存失敗継続、FAULTED停止: 成功。
- 全JavaScript構文、公開module import、静的HTTP配信、ZIP整合性: 成功。

## 次の実装候補

BattleScreen / BattleRenderer / BattleEffectManagerを実装し、現在の開発用Previewを
BattleCommandPortへ接続する。その後、SaveCodec / SaveRepository / SaveService /
SaveMigratorとtransactional Loadへ進む。正式人物・正式Stageは正本Excelを入手するまで
仮値で埋めない。
