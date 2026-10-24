# v10 実装状況 Milestone 17

作成日: 2026-09-13

## 実装

- 第3章「生辰綱奪取」の初期16部隊・増援15部隊を固定v9.7.75から抽出し、Stage生成へ接続。
- 開始・増援到着・勝利会話を保持。増援話者の「官軍増援」ラベルも移植。
- 護送車は常時非行動。15増援は初期状態では未配置・無所属として管理。
- 初期敵8部隊の全滅をMissionTransitionEventに変換。護送車だけの撃破では完了しない。
- 任務完了後は晁蓋の北旗到達で勝利可能。増援出現前の敵全滅は勝利条件にしない。
- 第5自軍ターン開始時、または第5自軍ターン中の護送隊壊滅直後に追捕軍を出現させる。
- 敵ターン中の壊滅では次の自軍ターンまで増援を待つ。ReinforcementEventへphase条件を追加。
- 第6自軍ターン開始時に護送隊が残っていれば敗北。第5自軍ターン終了直後には敗北にしない。
- TurnLimitObjectiveへ評価境界を追加。既定の自軍ターン終了時評価は維持。
- Controllerは自軍開始時の期限を状態異常による行動の前に評価する。
- 任務完了で護送隊撃破期限を無効化。章全体の15ターン制限は維持。
- 増援は既存の固定順近傍探索を使用。再判定・Save／Loadで重複出現しない。
- 第1〜3章の参謀を既存AIの98％計略使用規則へ接続。Milestone 16の第1・2章の設定漏れも訂正。

## 参照・再生成

commit `3e3fb85ca8279e5351668562dea677df777a1ddc`のgame.jsを使用。
createStages、loadStage、checkResult、startPlayerTurn、activateRaidEscape、spawnRaidReinforcements、enemyStrategyUseRateを照合。

```sh
node scripts/import-v9-opening-stages.mjs ../v9-reference
```

入力SHA-256を照合し、旧コードを実行せずデータのみ抽出。第1〜3章合計52部隊。

## 検証

- 自動テスト224件成功、失敗0。
- 第3章の新規8件で初期／増援構成、任務切替、早期脱出、増援前の殲滅禁止、自軍phase限定、一度限りの出現、期限境界、出現位置の競合を検証。
- Controllerで第5敵ターンを経由し、第6自軍開始時に期限敗北することを確認。戦闘被害を止めたテストfixtureで境界を分離。
- 増援前の第4ターン・増援後の第5ターンの保存から復元し、任務状態と増援の一回性を検証。
- 公開module import、生成script構文検査、git diff --check成功。

## 未完了

正式人物能力表との照合と、アプリの正式章catalogへの登録は未完了。
テスト専用人物値はtests内のみ。正式人物の代用品として配布しない。
第4章以降のStage生成、実ブラウザの表示／操作検証が残る。
ユーザーによるプレイテストを前提にせず作業を継続する。

GAME_VERSIONは10.0.0-dev.17。現在のアプリcatalog、Save format 6、content revisionは維持。
正式章を登録する際はcontent revisionと保存互換性を再評価する。
