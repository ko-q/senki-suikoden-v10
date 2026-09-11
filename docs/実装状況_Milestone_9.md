# v10 実装状況 Milestone 9

作成日: 2026-09-10

## 完了

- `Game`を追加し、新規開始、起動時recovery選択、手動Load、disposeを一つのlifecycleへ統合。
- `BattleViewFactory`でHTML templateからBattle画面をdetached DOMとして複製。
- `BattleSessionFactory`でController、Screen、Renderer、Effect、Domain Service、Viewをsession単位に生成。
- session生成途中の例外ではdetached Viewと生成済みScreen／Controllerを破棄。
- `BattleSession`へconnect／activate／startNewBattle／resumeLoadedBattle／disposeの順序制約を追加。
- `BattleSessionHost`をcurrent sessionなしの起動にも対応させ、新規BattleとLoadの交換経路を共通化。
- candidateのStage／RNG／Screen接続とView activate成功後だけ旧sessionをdispose。
- `BattleRenderer.unbindHandlers()`で固定buttonと旧盤面cellのlistenerを完全解除。
- `BattleScreen.dispose()`からRendererのlistener解除を実行。
- 起動時に正常なprimary／temporary／backup recoveryがある場合だけResume選択を表示。
- Resumeを選ぶまでStage、Controller、Screenを生成しない。
- corrupt／incompatible recoveryでは保存内容を実行せず、新規開発Battleを開始。
- recovery選択後に別tab更新を検出した場合はstale guardを拒否し、summaryとguardを再取得。
- 手動Save／Load／削除UIを3枠の開発用縦切りとして接続。
- empty／occupied／temporary／backup／corrupt／incompatibleを画面で区別。
- 上書き、Load、三世代削除を確認後だけ実行。
- storage不可時もBattleを開始し、保存操作だけを無効化。
- storage eventで観測済みslotの競合を通知し、明示Refreshまでstale操作を拒否。
- v9 keyを読取り・更新・削除しないbootstrap回帰testを維持。

## Session交換順

```text
Save候補を検査してPreparedBattleLoadを生成
→ templateからdetached BattleViewを生成
→ 新Controller / Screen / Serviceを生成
→ Stage runtimeとRNG一致を検査
→ detached ScreenをCommandPortへ接続して初回render
→ BattleViewを表示hostへactivate
→ current session参照を交換
→ 旧Screen listener解除 / 旧Controller Abort / 旧View破棄
→ resumeLoadedBattle
```

candidate生成、接続、activateまでに失敗した場合はcandidateだけをdisposeし、旧sessionと表示rootを
維持する。交換後の旧async処理はBattleControllerのAbort境界で停止する。

## Save画面の状態

| 状態 | Save | Load | Delete |
|---|---:|---:|---:|
| empty | 可 | 不可 | 不可 |
| occupied | 可 | 可 | 可 |
| temporary | 可 | 可 | 可 |
| backup | 可 | 可 | 可 |
| corrupt | 可 | 不可 | 可 |
| incompatible | 不可 | 不可 | 可 |

SaveはBattleControllerがstableな場合だけ可能。UI表示が古い場合もGameがcommit直前に再検査する。
LoadとDeleteはinspection時の三世代rawを含むselection guardを使用し、別tab更新後のstale操作を
拒否する。

## 互換境界

- 公開版は`10.0.0-dev.9`。
- Save formatは6のまま変更しない。
- battle content／Save shapeを変更していないため、content revisionは
  `v10-save-transactional-load-8`を維持し、Milestone 8 saveをLoad可能とする。
- storage prefixは`senki_suikoden_v10_test_save_v1:`のまま変更しない。
- 現行v9.7.75とv9保存領域には変更を加えない。

## 検証結果

- Node自動test: 150件成功。
- 起動時recovery選択までBattle未生成: 成功。
- recoveryを破棄せずStart new battleを選ぶ経路: 成功。
- temporary recovery候補の表示と再開: 成功。
- recovery再開時のintro／phase開始再実行なし: 成功。
- corrupt recoveryからの安全な新規開始: 成功。
- stale recovery guard再取得後の再選択: 成功。
- 手動Save→Load→表示root交換: 成功。
- Load競合時の旧session／旧DOM維持: 成功。
- candidate接続／activate失敗時の旧session維持: 成功。
- candidate生成途中のdetached View cleanup: 成功。
- 旧固定button／盤面cell listener解除: 成功。
- storage不可時のBattle継続と保存button無効化: 成功。
- 起動時storage read失敗からのno-save継続: 成功。
- v9 key byte不変: 成功。
- 全JavaScript構文、公開module import、静的HTTP配信: 最終成果物作成時に再検証する。
- 実ブラウザ自動確認: 作業環境にPlaywright本体はあるがbrowser executableがないため未実施。
  DOM entry、template clone、listener、session交換はNode統合testで代替検証済み。

## まだ正式化していないもの

- v9と同じ手動20枠の正式画面。現在の3枠はlifecycle検証用。
- temporary／backupを手動slotのprimaryへ明示的に昇格するRepair操作。
- 正式人物データ、正式Stage、画像、演出、SE、BGM、AudioController。

正式人物と正式Stageは正本Excel第4.7版およびv9実素材を照合できるまで仮定しない。
