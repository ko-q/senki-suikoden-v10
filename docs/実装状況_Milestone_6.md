# v10 実装状況 Milestone 6

作成日: 2026-09-08

## 完了

- BattleScreenをBattleCommandPortへ接続し、Controllerの具体型への依存を除去。
- BattleRendererでStage、Unit、移動可能cell、候補経路、Preview位置、通常攻撃対象を描画。
- BattleEffectManagerでdata-only PresentationRequestの表示とAbort可能な演出待機を実装。
- Intro DialogueをDialogueControllerで順次表示し、終了後にPlayer操作へ復帰。
- PlayerのREADY Unit選択、最大3候補経路の切替、移動後位置からの通常攻撃を実装。
- 待機は最終Facing選択後だけcommitし、Facing選択前のClearでPreviewへ戻せるようにした。
- Player phase終了からEnemy AI実行、次turnのPlayer phase開始まで画面から接続。
- 開発用StageにElimination victory / defeatを追加し、最小戦闘を終了可能にした。
- command中、Dialogue中、Battle終了後、FAULTED時の入力lockを実装。
- 二重tapによる二重commit防止、dispose時のDialogue中断、演出待機のAbortを実装。
- HTMLの全selectorとbootstrap参照の一致を自動検査。
- スマートフォン幅ではstatus、toolbar、Dialogueを縦配置し、横長Mapはscroll可能にした。

## 操作できる最小経路

```text
Intro Dialogue
→ Player Unit選択
→ 移動cell選択とPreview
→ 通常攻撃対象を選択、またはWaitと最終Facing選択
→ Player phase終了
→ Enemy AI
→ 次turn、またはVictory / Defeat
```

## 境界

- Preview中はBattleMap、Unit、Army、BattleRandomを変更しない。
- RendererとEffectManagerはDomainを変更しない。
- BattleScreenは位置・所属・勝敗を独自に保持せず、StageとBattleCommandPortから読む。
- PresentationRequestにはDOM、callback、音源名を含めない。
- InteractionModeはSaveしない。TACTIC_COMMITTEDだけはDomainから方向選択状態を再構成する。
- 現在のStageと人物は英語の開発用fixtureであり、正式データではない。

## 検証結果

- Node自動test: 99件成功。
- Intro終了から移動Preview、通常攻撃、VictoryまでのDOM統合経路: 成功。
- WaitがFacing選択前にcommitされず、選択後だけFINISHEDになること: 成功。
- 同一対象への二重tapでActionとBattleRandomが一度だけ進むこと: 成功。
- Dialogue中disposeとEffect待機中Abort: 成功。
- Renderer前後のDomain digest一致: 成功。
- bootstrapの全DOM selectorがHTMLに存在すること: 成功。
- 全JavaScript構文、公開module import、静的HTTP配信、ZIP整合性: 成功。

この実行環境にはPlaywright packageはあるがChromium実行ファイルがないため、実ブラウザの
起動検査は実施できなかった。DOM実行test、selector検査、module import、静的HTTP配信で
代替している。

## 次の実装候補

弓撃、投擲、突撃、撹乱、幻術、広域幻術、火計、水計の選択・対象指定UIを接続する。
その後、SaveCodec / SaveRepository / SaveService / SaveMigratorとtransactional Loadへ進む。
正式人物・正式Stage・画像・音声は正本とv9実素材を照合できる段階まで仮定しない。
