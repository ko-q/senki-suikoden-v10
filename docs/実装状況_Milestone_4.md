# v10 実装状況 Milestone 4

作成日: 2026-09-08

## 完了

- 承認済みの`StageEvent.triggers[]`を実装し、従来の単一`trigger`も互換入力として受理。
- 同じEventへ複数triggerが到達しても、`completedEventIds`により先着一回だけ実行。
- StatusServiceでCONFUSED / ILLUSIONのphase開始処理を分離。
- 開始時点の有効性を記録して両statusを独立減算し、ILLUSIONを優先して結果を返す。
- DialogueControllerをDOM非依存で実装し、解決済みDialogue refのSpeechを順番に再生。
- AIServiceで通常敵、幻術ForcedAction、Stage固有AIを無副作用Planとして生成。
- StageAIConfigを追加し、Definition上のUnit ID、門列、追捕範囲をruntime参照へ解決。
- MovementServiceへv9互換の到達cell走査順と、占有を無視する追跡用地形cost照会を追加。

## v9から転記したAI順序と具体値

- 通常敵は、計略判定、弓撃、移動、突撃／通常攻撃、待機の順に計画する。
- 計略候補が存在する場合だけ使用率の乱数を1回消費する。
- 参謀の使用率は0.98。
- 幻術の使用率は同turnに攻撃可能なら0.85、攻撃不能なら1.0。
- 火計・水計の使用率は同turnに攻撃可能なら0.70、攻撃不能なら1.0。
- 武力と知力の差に応じた使用率は0.03 / 0.08 / 0.15 / 0.25 / 0.45 /
  0.60 / 0.75 / 0.85を維持。
- 幻術ForcedActionは、低移動cost、低兵力、Stage.unitOrderの順で味方対象を選ぶ。
- 高廉の広域幻術は、公孫勝が生存し距離3以内なら通常幻術へ抑止する。
- 祝家荘の慎重な火計・水計役は、味方敗走、単体巻き込み、個別40％以上の損害、
  味方合計損害が敵合計の50％以上になる候補を避ける。
- 大名府追捕隊は、y座標降順、門列への距離、Stage.unitOrderで行動順を決める。
- 追捕隊は二列の門路を前から詰め、移動後は通常攻撃だけを使う。
- 前進不能時は使用率抽選なしで計略、弓撃の順にfallbackする。
- 大名府左右増援歩兵は盧俊義・石秀を優先し、計略を使わない。

## v10境界

- AIServiceはUnit、BattleMap、Army、damage、status、remainingUsesを変更しない。
- BattleRandomを消費するのは、実行予定の計略候補に対する確定使用率判定だけ。
- Preview、再描画、候補照会ではAI Planを生成しない。
- 章IDとUnit IDはAIServiceへ直書きせず、StageAIConfigへ置く。
- ILLUSION_WAITは承認済みv10仕様どおりFacingとBattleRandomを変更しない。
- CONFUSEDとILLUSIONは独立保持し、同時有効時はILLUSIONを先に実行する。

## 検証結果

- Node自動test: 72件成功。
- 複数triggerの先着一回、単一trigger互換、重複拒否: 成功。
- status独立減算、ILLUSION優先、残り1turnの発動: 成功。
- Dialogueの順次再生とfinishの冪等性: 成功。
- AIの通常優先順、乱数消費回数、広域幻術抑止、慎重計略、追捕隊、優先標的: 成功。
- AI Plan生成前後のDomain snapshotとBattleRandom state不変性: 成功。
- StageAIConfigのruntime Unit ref解決と不明ID拒否: 成功。

## 次の実装候補

BattleControllerを最小縦切りで実装し、BattlePresentationPortと
BattleCheckpointPortへ接続する。実移動1cellごとのTrap、Event、即時敗北判定、
演出待ち、行動再validationを確定順で統合する。正式人物・正式Stageは正本Excelと
章Definitionを照合できる段階まで仮値で埋めない。
