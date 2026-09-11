# v10 実装状況 Milestone 12

作成日: 2026-09-11

## 完了

- v9.7.75の`battle-effect-assets.js`から戦闘演出画像8点を個別WebPへ復号。
- 全画像fileのbyte数とSHA-256をmanifestおよび自動testで固定。
- `BattleVisualEffectSession`がBattle専用effect layer、演出DOM、timerを一元管理。
- 盤面再描画と演出layerを分離し、後続Presentation中も突撃砂煙を維持。
- 1cell移動、味方／敵の4本弓軌道、突撃砂煙を接続。
- 火計burst、水計burst、計略範囲flash、広域幻術overlayを接続。
- 撹乱記号、通常幻術ドクロ、Unit発光、damage popupを接続。
- 2ターン状態成功時の2回発光を接続。
- 広域幻術の画像とSE開始時刻をv9順序へ同期。
- Load、新規開始、Battle破棄時に旧演出DOMとtimerを一括cancel。
- PresentationRequestへ画像asset IDを持ち込まず、既存の意味情報からPresentation層で写像。
- Save format、content revision、storage prefix、戦闘式、AI、人物値、Domain RNGは変更なし。

## 責務境界

```text
BattleController
  → assetを知らないPresentationRequest
BattleEffectManager
  → 音声と画像演出を同じAbortSignalで開始
BattleVisualEffectSession
  → Battle専用effect layer、演出DOM、timerを所有
BattleRenderer
  → 盤面cellだけを再描画し、effect layerを変更しない
BattleSessionFactory
  → Stage・盤面・effect layerを同じVisual sessionへ接続
```

## v9素材の同一性

- 対象asset数: 8。
- 復号後の総byte数: 16,540,780 bytes。
- MIME type: 全点`image/webp`。
- 各fileは`src/presentation/battle-visual-assets.js`のSHA-256で個別検証する。
- 画像の再生成、加工、差替えは行っていない。

## v9演出時間

| 演出 | 時間 |
|---|---:|
| 1cell移動 | 80ms |
| 弓1本 | 230ms |
| 弓最終射出後の余白 | 250ms |
| 計略範囲flash | 140ms |
| Unit発光 | 480ms |
| damage popup | 780ms |
| 突撃砂煙 | 1440ms |
| 通常幻術ドクロ | 720ms |
| 撹乱記号 | 720ms |
| 火計burst | 1440ms |
| 水計burst | 960ms |
| 広域幻術overlay | 2240ms |

突撃は砂煙を1440ms維持しながら、mobは160ms、named Unitは200msでdamage処理へ進む。
広域幻術はoverlay開始300ms後に専用SE、2240ms後に幻術cast音と範囲flashへ進む。

## 互換境界

- 実装版は`10.0.0-dev.12`。
- Save formatは6のまま変更しない。
- content revisionは`v10-save-transactional-load-8`を維持する。
- storage prefixは`senki_suikoden_v10_test_save_v1:`のまま変更しない。
- v9.7.75のRepositoryと保存領域には変更を加えない。
- 画像演出と音声同期はDomainのBattleRandomを消費しない。

## 検証結果

- 戦闘画像assetのbyte数・SHA-256照合: 8点成功。
- 移動、弓、突撃、火計、水計、広域幻術、状態、被害演出: 成功。
- 2ターン撹乱の記号選択と2回発光: 成功。
- Abort／dispose後の演出全除去: 成功。
- BattleEffectManager、BattleSessionFactory、盤面再描画との統合: 成功。
- Node自動test: 181件成功。
- 全JavaScript構文、公開module import、静的HTTP配信: 成功。

## まだ正式化していないもの

- 正式人物データとportrait。
- portraitを使うAction cut-in。
- 正式StageとStage map画像。
- title／勝利／敗北の専用画面画像とtap進行。

正式人物と正式Stageは正本Excel第4.7版を確認できるまで仮定しない。次は人物値を必要としない
title／勝利／敗北の専用画面と、結果演出・Dialogueのv9順序を実装する。
