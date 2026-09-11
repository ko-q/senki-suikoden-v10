# v10 実装状況 Milestone 3

作成日: 2026-09-07

## 完了

- v9.7.75 commit `3e3fb85ca8279e5351668562dea677df777a1ddc`の
  `checkResult()`、増援、寝返り、任務移行、隠し罠処理を再照合。
- EliminationObjective、ReachObjective、UnitDefeatObjective、TurnLimitObjective、
  SurviveUntilTurnObjectiveを実装。
- 勝利Objective同士と敗北Objective同士のOR評価、Eventによるactive/inactive gating、
  phase開始・終了専用の時間Objective評価を分離。
- ReinforcementEvent、BetrayalEvent、MissionTransitionEvent、DialogueEventを実装。
- StageEventManagerへDefinition順のfixed-point連鎖、interruptMovementのOR集約、
  terminal checkpoint callbackを実装。
- EventのpresentationRequestsをDIALOGUE / NOTICEだけに制限し、DOM、音声、描画命令を
  Domainから排除。
- StageFactoryでEvent、Objective、PresentationのDefinition IDをUnit、Army、Dialogue、
  StageEventのruntime参照へ解決。
- 新規Battle用隠し罠の候補抽選、現在所属判定、罠回避、通常罠、妖術罠、妖術罠無効化を実装。

## v9から転記した具体値と順序

- 増援配置は指定位置から半径0〜4を探索する。
- 同一半径では `dy=-radius..radius`、その内側で `dx=-radius..radius` を走査し、
  Manhattan距離が半径と一致する最初の空きcellを使う。
- 罠候補はDefinition順を維持し、平地、空きcell、未選択位置だけを対象にする。
- 罠位置は `floor(BattleRandom.next() * available.length)` で選び、候補からspliceする。
- 通常罠は20 damageとCONFUSED 1 turn。
- 妖術罠は10 damageとILLUSION 1 turn。
- ILLUSION能力を持つUnitは妖術罠を無効化する。ただし罠は消費され、移動は終了する。
- v9の`knowsZhujiaTraps`はUnitの位置・所属とは別の能力なので、
  `HIDDEN_TRAP_AWARENESS`として表現する。正式Stage移植時は祝家荘潜入Unitへ付与する。

## v10境界

- ReachObjectiveはBattleMapの現在位置だけを読み、Unitを除去しない。
- EliminationObjectiveは現在Armyに所属する生存Unitだけを数え、未所属増援を数えない。
- EventのDomain actionが成功してからcompletedEventIdsへ記録する。
- interruptMovementは連鎖を止めず、連鎖後の残り移動だけを止める。
- terminal callbackはEventごとの不可逆変更直後にControllerがDefeatをlatchするための境界。
- Trap処理はactionState、Map除去、Event、演出、使用回数を変更しない。
- Trapで敗走したUnitのMap除去は、後続BattleControllerが最初のawait前に行う。
- CONFUSEDとILLUSIONは承認済みv10仕様どおり独立して保持する。

## 検証結果

- Node自動test: 52件成功。
- ObjectiveのOR、AND、Event gating、到達時のMap残存、専用phase timing: 成功。
- Event依存のfixed-point連鎖、interrupt継続、terminal停止、一度きりDialogue: 成功。
- 増援の固定走査順、配置不能時の未所属・未配置完了、寝返りとunitOrder維持: 成功。
- seeded trap抽選、通常罠、妖術罠、罠回避、所属判定、無効化: 成功。

## 次の実装候補

設計順ではStatusService、DialogueController、AIServiceを実装し、その後に
BattleControllerとPresentation Portへ接続する。正式人物・正式Stageは正本Excelと
章Definitionを照合できる段階まで仮値で埋めない。
