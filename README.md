# 戦旗水滸伝 v10

現行v9を残したまま、別Repository・別URLで段階試験するOO再設計版です。
この成果物はMilestone 13であり、ゲーム全章の完成版ではありません。

## 現在動くもの

- GitHub Pagesで直接配信できる依存なしのES Modules構成
- Character / Unit / Terrain / BattleMap / MapCell
- Army / ArmyManager
- Stage runtime / StageFactoryの最小縦切り
- Speech / Dialogueのruntime参照
- StageEvent依存refの二段階解決と循環検査
- UnitControlRule / HiddenTrap / BattleLogの骨格
- MovementServiceの無副作用query
- 最大3本の候補経路と決定的sort
- BattleScreen / BattleRenderer / BattleEffectManagerを接続したスマートフォン対応画面
- v9.7.75と同一byteの既存SE／BGM 20点
- 意味的PresentationRequestから音源へ写像するAudioController
- 初回操作での音声解錠、ON／OFF、visibility停止・再開
- Battle単位の一時音所有と、破棄後の遅延decode再生防止
- 章番号による戦闘BGM、勝利BGM、敗北BGMの切替
- v9互換のtitle雷鳴・白転音とtitle BGM開始時機
- v9.7.75と同一byteの戦闘画像素材8点
- Battle専用overlayによる移動、弓、突撃、計略、状態、被害の画像演出
- v9の演出時間と広域幻術SE開始時刻の同期
- 再描画をまたぐ突撃砂煙と、Battle破棄時の演出一括cancel
- v9.7.75と同一byteのtitle／勝利／敗北画面素材7点
- 初回tapでopening、ready後の新しいtapでGameを起動するtitle画面
- 将兵5秒→勝利文字5秒→光線3秒、敗残将兵5秒→敗北文字5秒の結果演出
- 結果演出→結果Dialogue→Game結果画面の終了sequence
- 戦闘終了時recovery clearと、先行checkpoint後への削除直列化
- イントロ会話、部隊選択、移動Preview、全Action、待機・方向確定、Player phase終了の操作経路
- 弓撃／投擲、突撃、撹乱Lv1〜3、幻術、広域幻術、火計、水計の選択・対象指定UI
- Preview先を基準とするAction候補・対象highlightと、無効target選択時のmode保持
- Player phase終了後の敵AI実行と次turn開始、開発用Objectiveによる勝敗表示
- v9.7.75互換のBattleRandom（xorshift32）
- CombatService（通常攻撃・弓撃/投擲・突撃）
- TacticService（撹乱・幻術・広域幻術・火計・水計）
- `canExecute / inspectTargets / estimate` のread-only API
- 複数対象計略の同期的atomic commit
- Elimination / Reach / UnitDefeat / TurnLimit / SurviveUntilTurn Objective
- Reinforcement / Betrayal / MissionTransition / Dialogue Event
- Definition順のfixed-point Event連鎖とterminal checkpoint callback
- v9互換の隠し罠候補抽選、回避、妖術罠無効化、damage・status効果
- StatusServiceによるCONFUSED / ILLUSIONの独立減算と発動優先
- DOM非依存のDialogueController
- 通常敵AI、幻術ForcedAction、Stage固有AIを無副作用Planとして生成
- 高廉の広域幻術抑止、祝家荘の火計・水計安全判定、大名府追捕隊・優先標的
- StageAIConfigのUnit IDからruntime参照への解決
- BattleControllerによるcommand直列化、1cell移動、Trap、Event、Action、Objectiveの統合
- 新規戦闘開始とロード再開の分離、敵phase途中のREADY Unit再開
- TACTIC_COMMITTEDの方向確定待ちとstable save判定
- data-onlyのMOVE / ACTION / DAMAGE / STATUS / TRAP / PHASE / BATTLE_RESULT要求
- BattlePresentationPort / BattleCheckpointPortによる画面・回復保存との分離
- immutable BattleSaveData checkpointと非blocking回復保存通知
- Save format 6の厳密なSaveCodecとv6 passthrough SaveMigrator
- v10専用namespaceだけを扱うprimary / temporary / backup SaveRepository
- revision、writerId、storage lock、実データ比較による複数tab競合検出
- 書込み後検証、fallback候補検査、selection guard付き削除
- stable checkpointをrevision順に直列化するrecovery save queue
- 全Unit、所属、位置、状態、使用回数、Trap、Event、Log、RNGの新Stage復元
- contentRevision完全一致とStage runtime validationを通すPreparedBattleLoad
- 新session接続成功後だけ旧sessionを破棄するBattleSessionHost
- templateからdetached DOMを生成するBattleViewFactory
- Controller、Screen、Service、Viewを一つの破棄単位にするBattleSessionFactory
- Gameによる新規開始、recovery再開、manual Loadのsession lifecycle
- 起動時に正常なrecoveryを検出した場合だけ表示するResume／Start new battle画面
- empty／fallback／corrupt／incompatibleを区別する正式20枠の手動Save／Load／削除UI
- temporary／backupを検証後にprimaryへ明示昇格するRepair操作
- 上書き・Load・Repair・三世代削除の確認と、stale selection guardによる競合拒否
- session交換時の旧固定button／盤面cell listener解除
- 実画面のstable checkpointからv10 recovery slotへの自動保存
- dispose時のAbort、演出失敗の隔離、予期しないDomain例外のFAULTED停止
- 幻術同士討ち専用の味方通常攻撃経路
- BattleCommandPortによる画面からControllerへの構造的接続検査
- 二重tap防止、Dialogueと演出待機のAbort、dispose後の画面更新防止
- v10専用保存prefixとsave format 6の定数固定
- Node標準test runnerによる自動test

画面の人物とStageは、境界検証専用の英語fixtureです。正式な人物・章データではありません。

## まだ入れていないもの

- 正式人物データ（正本Excel第4.7版が必要）
- 正式人物portraitとAction cut-in
- 正式Stage map画像
- 正式Stage

未実装機能を仮のgame ruleで埋めず、後続milestoneでv9.7.75実ファイルと正本を
再照合しながら移植します。

Combat/Tacticの人物能力値はtest専用fixtureだけで検証しています。正式人物への能力ID・
使用回数mappingは、正本Excel第4.7版の入手後に行います。

現在の画面はBattleControllerとのAction操作境界を検証するものです。開発用Unitだけに
全能力を付与し、通常攻撃を含む全Actionを画面から検証できます。この能力構成は正式な
人物設定ではありません。

現在の画面ではstable checkpointのrecovery saveに加え、v9と同数の20個の手動slotへ
Save／Load／Repair／削除できます。Load時は新しいBattle一式をdetached DOM上で検証し、
成功した場合だけ表示rootとsessionを交換します。Repairは正常なtemporary／backupが選ばれた
場合だけ表示し、選択後に別tabで内容が変わっていれば全世代を変更せず拒否します。より新しい
非対応世代が手前にある場合もRepairを出さず、そのデータを将来の版のために保持します。

音声はブラウザの自動再生制限に合わせ、画面右上の`Sound: Start`または最初の画面操作で
解錠します。解錠後は同じbuttonでON／OFFを切り替えられます。

戦闘画像演出は盤面DOMとは別のBattle専用overlayに表示します。盤面再描画をまたいで残る
突撃砂煙を含め、Loadや新規開始で旧Battleを破棄した時点ですべて停止・除去します。

title画面は最初のtapで6.77秒のopeningを開始し、表示完了後の次のtapでBattleまたは
recovery選択へ進みます。勝敗演出も全layer表示完了後の新しいtapだけを受け付けます。

## ローカル確認

```sh
npm test
npm run check
python3 -m http.server 4173
```

その後、`http://localhost:4173/`を開きます。build処理や`node_modules`は不要です。

## GitHub Pages

公開URL: https://ko-q.github.io/senki-suikoden-v10/

初回のみRepositoryの **Settings → Pages → Build and deployment → Source** を
**GitHub Actions** に設定します。その後、**Actions → Deploy GitHub Pages → Run workflow**
で`main`を選んで実行すると公開できます。

以後は`main`へのpushで`.github/workflows/pages.yml`が自動実行されます。
Node.js 22で既存testとentry moduleの構文確認に成功した場合だけ、既存の`index.html`と
`src/`・`styles/`・`assets/`を公開します。build toolや追加dependencyは不要です。
設計資料とtestは公開artifactに含めません。

スマートフォンでも上記URLを開き、初回tapでtitle openingを開始し、表示完了後にもう一度
tapすると試験用Battleへ進めます。現在はMilestone 13の開発版であり、正式な全章版ではありません。

v9とは別URLです。同じ`ko-q.github.io`内ではlocalStorageのoriginは共有されますが、
既存のv10専用保存prefixによってv9の保存keyと分離します。

## 固定した互換境界

- v9参照commit: `3e3fb85ca8279e5351668562dea677df777a1ddc`
- v10 save format: `6`
- v10 storage prefix: `senki_suikoden_v10_test_save_v1:`
- PreviewはBattleMap、Unit、Army、乱数を変更しない
- Unitは`x / y / team / army / isAlive / isDeployed / moveOrigin`を保持しない

設計正本と実ファイル照合記録は`docs/`にあります。
