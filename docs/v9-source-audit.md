# v9.7.75 実ファイル照合記録

照合日: 2026-09-06

## 参照元

- Repository: `ko-q/senki-suikoden`
- Branch: `main`
- Commit: `3e3fb85ca8279e5351668562dea677df777a1ddc`
- `game.js`内の公開版: `9.7.75`
- v9 save schema: `5`
- v9 save namespace: `senki_suikoden_save_v2`

v10側からこのRepositoryへ変更は加えていない。参照cloneは成果物へ含めない。

## Milestone 1で転記した範囲

`game.js`の`terrainData`、`canEnterTerrain()`、`terrainMoveCost()`を直接確認し、
地形の基本移動cost、通行可否、戦闘補正と水系・山野適性による移動例外を
`src/definitions/v9-compatible-terrain.js`へ責務分離して転記した。

## Milestone 2で転記した範囲

`game.js`の`BattleRandom`、戦闘技能判定、射線判定、方向補正、地形補正、
`calculateDamage()`、`calculateChargeDamage()`、撹乱・幻術成功率LUT、
火計・水計の範囲・威力・地形・撹乱式を直接確認した。

次を責務分離して実装した。

- `BattleRandom`: v9と同じxorshift32とstate import/export。
- `CombatService`: 通常攻撃、弓撃/投擲、突撃、盾牌、連環馬、湿地補正。
- `TacticService`: 撹乱Lv1-3、幻術、広域幻術、火計、水計。
- read-only queryと実行を分離し、validation失敗時はUnit・使用回数・RNGを変更しない。
- 複数対象は全計算後、awaitなしでUnitへ一括反映する。

v9の`specialTacticDamageRate=.75`は該当Stage Unitへ付与する専用能力IDとして表現し、
数値自体は変更していない。高廉の広域幻術を許可するStage固有条件は後続AI/Stage移植で
判定し、TacticServiceは確定済みRequestの効果だけを処理する。

## v10承認仕様として意図的に変えた範囲

- 幻術成功時にCONFUSEDを削除しない。
- CONFUSEDとILLUSIONは同一Unitへ同時に保持できる。
- 幻術中でも撹乱を独立して付与できる。

## Milestone 3で転記した範囲

`game.js`の`checkResult()`、`startPlayerTurn()`、`activateTurnReinforcement()`、
`findOpenCellNear()`、`activateZhujiaBetrayal()`、`activateZengtouBetrayal()`、
`initializeHiddenTraps()`、`firstActiveTrapOnPath()`、`resolveHiddenTrap()`を直接確認した。

次を責務分離して実装した。

- 章分岐に埋め込まれていた勝利・敗北判定を5種類の具体Objectiveへ分離。
- 増援、寝返り、第三章任務移行、一度きり会話を4種類の具体StageEventへ分離。
- v9の半径0〜4・北西東南順の増援cell探索をそのまま転記。
- v9の候補配列からの乱数抽選とsplice順を隠し罠生成へ転記。
- 通常罠20 damage・撹乱1 turn、妖術罠10 damage・幻術1 turnを転記。
- v9の`isIllusionUser()`による妖術罠無効化を`UnitAbility.ILLUSION`へ対応付け。
- v9の`knowsZhujiaTraps`を`UnitAbility.HIDDEN_TRAP_AWARENESS`へ対応付け。

Trap発動後のDOM、効果画像、SE、Dialogue表示は転記せず、Presentation層の後続作業として
残している。

## Milestone 4で転記した範囲

`game.js`の`enemyTurn()`、`findIllusionFriendlyTarget()`、
`resolveIllusionAction()`、`enemyCanAttackThisTurn()`、
`enemyStrategyUseRate()`、`chooseEnemyStrategyAction()`、
`damingPursuitMovePath()`、`enemyDamingPursuitFallbackAction()`、
`enemyAction()`を直接確認した。

次を責務分離して実装した。

- 通常敵の計略判定、弓撃、移動、突撃／通常攻撃、待機の優先順。
- 計略候補がある場合だけ行う使用率抽選と、能力差ごとの使用率。
- 幻術ForcedActionの低移動cost、低兵力、Unit定義順による対象選択。
- 高廉の広域幻術を公孫勝の生存・距離で抑止するStage固有規則。
- 祝家荘モブ隊長の味方損害40％、味方合計損害50％等の安全判定。
- 大名府追捕隊の先行順、二列門路前詰め、追跡距離、移動後通常攻撃限定、
  前進不能時の計略・弓撃fallback。
- 大名府左右増援歩兵の盧俊義・石秀優先と計略不使用。
- Stage Definition上のUnit IDを`StageAIConfig`のruntime Unit参照へ解決。

CONFUSEDとILLUSIONのphase開始処理は承認済みv10順序へ分離した。
ILLUSION_WAITは承認どおりFacingとBattleRandomを変更しない。

## Milestone 5で照合した範囲

`game.js`の`runActionResolution()`、`moveSelected()`、`enemyTurn(resume)`、
`startPlayerTurn()`、`resolveIllusionAction()`、`checkResult()`、
`battleSessionId`による旧戦闘guard、敵1部隊ごとの回復保存位置を直接確認した。

次をv10の確定設計へ合わせて責務分離した。

- BattleControllerで公開commandを直列化し、FlowStateとUnitActionStateを二重検証。
- commit済み経路を1cellずつ移動し、Trap、Event、即時敗北、再validationを固定順で処理。
- Combat/Tacticの同期commit直後に敗走UnitをBattleMapから除去し、結果演出前に敗北をlatch。
- Player phase終了、Enemy phaseの動的READY選択、次Player phase開始を統合。
- `startNewBattle()`と`resumeLoadedBattle()`を分離し、Enemy phase途中は残存READYだけを再開。
- v9の`battleSessionId`相当の安全性を、Battle単位AbortControllerとdispose後guardで表現。
- stable checkpointをBattleSaveDataへ固定し、回復保存I/OをBattleCheckpointPortへ分離。
- v9通常commandの敵味方制約を維持したまま、ILLUSION_ATTACK専用の味方通常攻撃経路を追加。

表示待機時間、DOM再描画、効果画像、SE、BGMはControllerへ移さず、
意味的PresentationRequestとして後続のBattleScreenへ渡す境界だけを実装した。

## Milestone 6で照合した範囲

`game.js`の`selectUnit()`、`moveSelected()`、通常攻撃command、待機時の方向選択、
Player phase終了、`battleSessionId`による旧画面guardを参照した。

次をv10のPresentation責務へ分離して実装した。

- BattleScreenが画面固有の選択、Preview、方向選択状態を保持する。
- BattleRendererはStageとBattleViewStateを読み取り、DOMだけを描画する。
- BattleEffectManagerは意味的PresentationRequestを表示し、Abort可能な短い待機を行う。
- 画面からBattleControllerへはBattleCommandPortだけを通し、具体Controller型へ依存しない。
- command実行中とDialogue中は入力をlockし、二重tapによる二重commitを防ぐ。
- disposeまたはBattle側Abortで、Dialogueと演出待機を旧画面へ継続させない。

人物画像、戦場画像、効果画像、SE、BGMはまだ対応付けていない。現時点の画面は英語の
開発用fixtureであり、通常攻撃、待機・方向確定、Player phase終了だけを操作可能とする。
弓撃、投擲、突撃、計略のService／Controller経路は存在するが、選択UIは後続作業である。

## Milestone 7で照合した範囲

`game.js`の`availableActionNames()`、`beginBow()`、`beginCharge()`、
`beginStrategy()`、`selectStrategyLevel()`、`playerBow()`、`playerCharge()`、
`playerStrategy()`、`playerSpecialTactic()`、`updateButtons()`、`cellClick()`を直接確認した。

次をv10のPresentation責務へ分離して実装した。

- 弓撃／投擲と突撃は、使用可能な対象がある場合だけcommandを有効化する。
- 弓撃／投擲は距離2〜固有最大射程、突撃は隣接敵だけを対象highlightする。
- 撹乱Lv1〜3、幻術、火計、水計は個別のtarget selection modeを持つ。
- 広域幻術は中心targetを要求せず、使用者自身をrequest targetとして即時commitする。
- Preview中の候補とtargetは仮位置からread-only queryし、実行時には選択経路をControllerへ渡す。
- 無効cellを選んでもtarget selection modeを解除せず、DomainとBattleRandomを変更しない。
- 計略commit後は`TACTIC_COMMITTED`から取消不能のFacing選択を再構成する。

開発用Unitには全Action境界を一画面で検証するため複数能力を付与している。この組合せは
正式人物データへ転記せず、正本Excel第4.7版入手後のmappingとも分離する。

## まだ転記していない範囲

- 人物データ: 現行`game.js`の注記と値は第4.6版であり、v10正本の
  `水滸伝_人物能力データ_第4.7版.xlsx`が今回の添付に存在しないため未転記。
- 正式Stage DefinitionへのAIConfig割当、演出、音声: 後続milestoneで各実装箇所を
  再度直接照合してから限定的に移植する。

## Milestone 8で照合した範囲

基準commitの`game.js`にある`SaveRepository`、`SaveCodec`、`SaveService`を直接確認した。

- `SaveRepository`（611行以降）のslot key、primary／temporary／backup、revision抽出を確認。
- `captureSlotState()`と`slotMatchesExpected()`（677行以降）の三世代raw比較を確認。
- storage lock、各write段階のlock再検証、書込み後read-back検証（691行以降）を確認。
- `writeSlot()`（785行以降）のtemporary→backup→primary→temporary削除順を確認。
- `removeSlot()`（888行以降）の競合検査と削除後検証を確認。
- `SaveCodec`（928行以降）のJSON境界と、`SaveService`（1005行以降）のslot観測、
  fallback候補、revision、writerId、selection guard、storage event競合処理を確認。

v10では三世代保護、実データ競合、lock、書込み後検証を責務分離して維持した。一方、v9の
legacy recovery探索・削除とschema 1〜5 migrationは意図的に移さず、v10専用prefixとformat 6
だけを扱う。Loadは現行の直接mutationを移植せず、確定設計どおり新Stageへのtransactional復元に
変更した。現行v9の追跡対象ファイルは変更していない。

## Milestone 9で照合した範囲

基準commitの`index.html`にあるrecovery overlay、manual Save／Load入口、slot listと、
`game.js`の`showRecoveryPrompt()`、`loadRecoveryFromPrompt()`、`renderSaveSlotList()`、
`confirmManualSave()`、`confirmManualLoad()`を直接確認した。

次をv10のPresentation／Game lifecycleへ責務分離して実装した。

- 正常なrecovery候補がある場合だけ、起動時にResume／Start new battleを明示選択する。
- recoveryのselection guardが別tab更新で古くなった場合、旧候補をLoadせず再検査する。
- 手動slotはempty／occupied／temporary／backup／corrupt／incompatibleを区別する。
- 上書き、Load、三世代削除は確認後だけ実行し、stale guardでは現在Battleを維持する。
- Load候補のStage、Controller、Screen、DOMをdetached rootで生成・接続検証する。
- candidate activate成功後だけ旧sessionをAbort／disposeし、旧buttonとcell listenerを解除する。

現行画面の手動slotは縦切り検証用の3枠であり、v9の正式20枠を削減する仕様決定ではない。
正式画面移植時に20枠表示とスマートフォンscrollを改めて照合する。v9の追跡対象ファイルは
変更していない。

## Milestone 10で照合した範囲

基準commitの`game.js`にある`manualSaveSlotCount=20`、`inspectManualSlots()`、
`promoteTemporary()`、`promoteBackup()`と、`index.html`の手動slot scroll表示を再確認した。

次をv10へ責務分離して実装した。

- 手動slot IDを`manual_01`〜`manual_20`の固定順で生成する。
- 20枠をスマートフォンでも内部scrollできる一覧として表示する。
- temporaryはprimaryへの書込み検証後にtemporaryを削除する。
- backupは一度temporaryへ退避して検証してからprimaryへ昇格し、backup自体は残す。
- 昇格前に正常candidateと選択時の三世代rawを再検査し、stale guardでは一切変更しない。
- より優先度の高い世代が非対応の場合はRepairを禁止し、将来読める可能性のあるrawを保持する。
- 手動slotの昇格は自動実行せず、Repairの確認後だけ実行する。

v9はrecovery読込時にfallbackを自動昇格し、手動slot読込ではfallbackを変更しない。v10の
手動Repairは、利用者が明示選択した場合だけ行う追加の保守操作であり、戦闘内容・Save shape・
乱数・人物値は変更しない。v9の追跡対象ファイルも変更していない。

## Milestone 11で照合した範囲

基準commitの`audio-assets.js`にある20個のData URLと、`game.js`の`AudioController`、
`battleThemeKeyForStage()`、勝利・敗北BGM、各戦闘・計略・罠・phase音の呼出位置を
直接確認した。

次をv10へ責務分離して実装した。

- 20個のData URLを個別音声fileへ復号し、byte数とSHA-256がv9と一致することをtestで固定。
- 章番号1、2、3を基準とする`generatedFixed / ds069 / strategy`の三章周期BGM選択。
- 勝利BGMと、3.3秒位置から一回再生する敗北BGM。
- 通常攻撃、味方／敵弓撃、突撃、撹乱、幻術、広域幻術、火計、水計、罠、phase開始の音声mapping。
- Domainの`BattleRandom`とは別の乱数系統で生成する足音・声・計略音。
- Gameが共有AudioControllerとBGM lifecycleを所有し、BattleEffectManagerはBattle専用の
  `BattleAudioSession`だけを使用する。
- Battle破棄時に再生中の一時音を停止し、遅延decode完了後にもsession有効性を再検査する。
- browser autoplay制約に合わせた初回操作unlock、音声ON／OFF、visibility change時の
  suspend／resume。

PresentationRequestは音源file名やasset IDを含まず、既存の意味情報だけからPresentation層で
cueへ変換する。Save format、content revision、storage prefix、戦闘式、AI、人物値、
BattleRandomの消費順は変更していない。v9の追跡対象ファイルも変更していない。

## Milestone 12で照合した範囲

基準commitの`battle-effect-assets.js`にある8個のWebP Data URL、`game.js`の
`BATTLE_EFFECT_TIMING`、各Action・damage・statusの呼出順、`index.html`の演出CSSを
直接確認した。

次をv10へ責務分離して実装した。

- 8個のData URLを個別WebP fileへ復号し、byte数とSHA-256がv9と一致することをtestで固定。
- 盤面再描画とは独立したBattle専用effect layerと`BattleVisualEffectSession`。
- 80msの1cell移動、味方／敵別の4本弓軌道、突撃砂煙と160／200msのimpact時機。
- 火計・水計の中心burst、計略範囲flash、広域幻術の7×7 overlay。
- 撹乱の1ターン「？」／2ターン「！」、通常幻術のドクロ、状態別Unit発光。
- 480msのUnit発光、780msのdamage popupと、2ターン成功時の2回発光。
- Abort／dispose時の演出DOM、待機timer、継続中砂煙の一括破棄。
- 広域幻術開始から0.3秒後の専用SEと、2.24秒後の幻術cast音。

PresentationRequestには画像file名やasset IDを追加せず、座標・Action種別・状態差分だけから
Presentation層で演出へ写像する。Save format、content revision、storage prefix、戦闘式、
AI、人物値、BattleRandomの消費順は変更していない。v9の追跡対象ファイルも変更していない。
