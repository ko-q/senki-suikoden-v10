# v10 実装状況 Milestone 13

作成日: 2026-09-12

## 完了

- v9.7.75の`screen-assets.js`からtitle／勝利／敗北素材7点を個別fileへ復号。
- 全画像のbyte数とSHA-256をmanifestおよび自動testで固定。
- `TitleScreen`へ初回tap、雷鳴、白転、logo表示、title BGM、ready、二回目tapを接続。
- title opening中はBattleSessionとrecovery選択を生成せず、exit完了後にだけ`Game.start()`を実行。
- `BattleResultEffectSession`へ勝利／敗北の全画面layer、段階fade、tap待機を実装。
- ready前のtapとrepeat keyを拒否し、ready後のtap／Enter／Spaceだけを受理。
- `BattleEffectManager`が結果音声と結果画像を同じAbortSignalで開始。
- `BattleController`の終了順を結果演出→結果Dialogue→BattleResult Promiseへ固定。
- `GameResultPanel`をGame所有とし、Promise完了後だけ結果概要と新規Battle操作を表示。
- 戦闘終了時のrecovery clearを先行checkpointの後へ直列化。
- title／結果待機中のdisposeでtimer、listener、DOMを一括破棄。
- Save format、content revision、storage prefix、戦闘式、AI、人物値、Domain RNGは変更なし。

## v9画面素材の同一性

| Asset | MIME | Bytes | SHA-256 |
|---|---|---:|---|
| title-background.jpg | image/jpeg | 305,586 | `45d4fdddc244657946cf16ea8dadf4164c98640a3ba3fd60ad70bf7e54bbc17a` |
| title-logo.png | image/png | 1,747,961 | `05fa2b37084eb4d5d87252af4aeabb08d2583131d41c7b4c1fc88f74927a781d` |
| victory-army.png | image/png | 2,711,943 | `1a1d6d40e7ec81e4bf0306415b95bcae5b8b3e6f1570b3ae37906e8b70e78d89` |
| victory-title.png | image/png | 1,735,933 | `b834c66bd14d3a158df48001a5d4e051e9da1ae1f1336ccb382f0cddbf8864ab` |
| victory-rays.png | image/png | 1,630,974 | `4f087518b41e863041719e517ff2233edac46fe4e170c7ecb53f15d5220f79e0` |
| defeat-army.png | image/png | 2,384,918 | `11377935d2f543d0c884be1360f4d60c7430f35845d159e68907f6826aedddc1` |
| defeat-title.png | image/png | 1,772,665 | `03f79356dc5f0e852072d5c540e56d792dbac2ef558f49c613dc51df847cd231` |

総byte数は12,289,980 bytes。画像の再生成、加工、差替えは行っていない。

## v9同期時間

### Title

| 起点 | 時刻 |
|---|---:|
| 雷鳴／opening開始 | 0ms |
| 白転音／白転開始 | 2,900ms |
| logo表示開始 | 5,800ms |
| title BGM開始 | 6,620ms |
| 二回目の入力受付開始 | 6,770ms |
| exit | 460ms |

### Battle result

| 演出 | 時間 |
|---|---:|
| 勝利将兵fade | 5,000ms |
| 勝利文字fade | 5,000ms |
| 勝利光線fade | 3,000ms |
| 敗残将兵fade | 5,000ms |
| 敗北文字fade | 5,000ms |
| 共通exit | 420ms |

## 終了sequence

```text
Domain結果latch
→ recovery clear通知
→ 勝敗BGM + 全画面結果演出
→ 表示完了後の明示tap
→ 結果Dialogue（定義がある場合）
→ BattleResult Promise resolve
→ GameResultPanel
```

recovery clearは非blockingで通知するが、SaveService内では既にqueueされたcheckpointより後に実行する。
別tabとの競合がある場合は安全側で削除せず、Controller診断へ記録する。

## 互換境界

- 実装版は`10.0.0-dev.13`。
- Save formatは6のまま変更しない。
- content revisionは`v10-save-transactional-load-8`を維持する。
- storage prefixは`senki_suikoden_v10_test_save_v1:`のまま変更しない。
- v9.7.75 Repositoryとv9保存領域には変更を加えない。
- title／画面演出の乱数はDomainのBattleRandomを消費しない。

## 検証結果

- 画面assetのbyte数・SHA-256照合: 7点成功。
- titleの二段階入力、時機callback、dispose cancel: 成功。
- 勝利／敗北layer順、ready前入力拒否、tap／keyboard進行: 成功。
- 結果演出→Dialogue順とGame結果画面: 成功。
- recovery save→clearのqueue順と三世代削除: 成功。
- Node自動test: 191件成功。
- 全JavaScript構文、公開module import、静的HTTP配信: 成功。

## 次の実装条件

残る大項目は正式人物データ、portrait／Action cut-in、正式Stage、Stage mapである。
正式人物能力とStage定義は正本Excel第4.7版が未提供のため推測しない。
