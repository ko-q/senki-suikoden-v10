# v10 実装状況 Milestone 8

作成日: 2026-09-09

## 完了

- `SaveCodec`へSave format 6のexact shape検査、encode、decode、deep freezeを実装。
- SaveDocument、BattleSaveData、UnitSaveData、HiddenTrap、BattleLogの必須fieldとenumを検査。
- statusEffectsのenum順、Unit／Trap／Event ID重複、Trap位置重複、Log sequenceを検査。
- `SaveMigrator`とimmutable `MigrationCatalog`を追加し、初期版をv6 passthroughに限定。
- `SaveRepository`をv10専用prefixに固定し、primary／temporary／backupの三世代を実装。
- slot実データ比較、writerId、期限付きstorage lock、lock再検証、書込み後検証を実装。
- `SaveService`へ手動保存、recovery queue、slot検査、fallback選択、削除、storage event処理を実装。
- Stable saveのMOVED禁止、inactive UnitのFINISHED、phaseとREADY所属、TACTIC_COMMITTED例外を再検査。
- contentRevision完全一致を要求し、不一致を安全なLoad失敗として扱う。
- `StageFactory.create()`後の新Stageだけへ全動的状態を復元し、旧Stageには参照しない構造にした。
- 全Unitの所属・位置・兵数・Facing・actionState・statusEffects・remainingUsesを復元。
- hiddenTraps、completedEventIds、BattleLog、turn／phase、BattleRandom stateを復元。
- Unit順、地形進入、Trap Definition候補、Log Unit ID、Stage runtime全体を検証。
- Domainから`UNIT_SELECT / TACTIC_FACING_SELECT / ENEMY_CONTINUE`のresumeContextを導出。
- 検証済みの`PreparedBattleLoad`を作り、新session構築まで旧Battleを変更しない。
- `BattleSessionHost`を追加し、新session接続検証後だけ旧sessionをdisposeして交換。
- `SaveCheckpointAdapter`でBattleControllerのstable checkpointをrevision順のrecovery queueへ接続。
- 開発画面のstable checkpointをv10専用recovery slotへ自動保存。storage不可環境では戦闘を継続。
- v9 keyを読取り・更新・削除しない回帰testを追加。

## Transactional Load境界

```text
raw三世代読取り
→ Codec shape検査
→ v6 migration
→ content／slot／kind検査
→ 新Stage生成
→ Save state復元
→ Runtime／stable resume検査
→ PreparedBattleLoad
→ 新sessionの非表示接続検証
→ 成功後だけ旧sessionを破棄・交換
→ resumeLoadedBattle
```

decode、互換判定、Stage生成、復元、runtime validation、新session接続のいずれかが失敗した場合、
旧Stage／旧sessionを維持する。交換後に発生した実行例外は既存BattleControllerのFAULTED境界で
停止する。

## 保存上の不変条件

- keyは必ず`senki_suikoden_v10_test_save_v1:`配下で生成する。
- Save formatは6、content revisionは`v10-save-transactional-load-8`。
- primary確定前にtemporaryへ同一rawを書き、各段階でlockと実データを再検証する。
- 正常な現primaryだけをbackupへ退避し、途中失敗時のtemporaryは復旧候補として残す。
- fallback候補はprimary、temporary、backupの順に独立検証する。
- selection guardと保存時のslot snapshotはrevisionだけでなく三世代raw全体を比較する。
- recovery queueはenqueue順に処理し、後のsnapshotを古い処理結果で上書きしない。
- CodecはRuntime object、DOM、関数、未定義fieldを受理しない。
- Preview、InteractionMode、Dialogue途中、FlowState、AI planは保存しない。
- v9 namespaceとv9 recovery keyは自動探索しない。

## 検証結果

- Node自動test: 132件成功。
- Save format 6 round-tripと全階層freeze: 成功。
- unknown field、invalid JSON、format不一致、status順序違反、重複ID拒否: 成功。
- temporary／backup fallbackと非昇格読込み: 成功。
- primary書込み検証失敗時のtemporary保持: 成功。
- 書込み途中のstorage lock奪取をprimary commit前に検出: 成功。
- 2 writerのstale save競合と明示refresh後の再試行: 成功。
- recovery snapshot 2件のrevision 1→2直列化: 成功。
- 全動的状態とRNGの新Stage復元: 成功。
- contentRevision不一致、配置衝突、MOVED改ざん時の旧Stage不変: 成功。
- 保存前の未知Stage ID／Runtime不整合拒否と未書込み保証: 成功。
- TACTIC_COMMITTEDと敵phaseのresumeContext導出: 成功。
- 新session接続失敗時の旧session維持とcandidate破棄: 成功。
- 接続成功時の`candidate接続→旧session破棄→resume`順: 成功。
- 実BattleController／BattleScreenでTACTIC_COMMITTEDからFacing選択への復帰: 成功。
- bootstrap DOMからのv10 recovery saveとv9 key不変: 成功。
- 全JavaScript構文、公開module import、静的HTTP配信: 最終成果物作成時に再検証する。

## まだ画面へ接続していないもの

- 手動slot一覧、保存、Load、削除のUI。
- recovery saveを検出して新規開始／再開を選ぶ起動画面。
- 同じ表示root上で旧／新BattleScreenを交換する実DOM session factory。
- fallback候補をprimaryへ昇格する明示的な復旧操作。

## 次の実装候補

Milestone 9ではGame／BattleSession lifecycleとSave／Load画面を接続する。起動時にrecovery slotを
検査し、ユーザーが選んだ場合だけPreparedBattleLoadを実sessionへ交換する。正式人物・正式Stage・
画像・音声は、正本とv9実素材を照合できる段階まで仮定しない。
