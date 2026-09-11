# v10 実装状況 Milestone 1

作成日: 2026-09-06

## 完了

- v9とは別の静的Web projectを作成。
- v9.7.75 commit `3e3fb85ca8279e5351668562dea677df777a1ddc`をread-onlyで直接照合。
- v10 save format `6`と専用prefixを定数化。
- Character、Unit、Terrainを実装。
- BattleMapを唯一の位置管理者として実装。
- ArmyManagerを唯一の所属管理者として実装。
- 敗走UnitはArmyに残し、Mapからだけ除去できる構造を実装。
- Stage runtimeとStageFactoryの最小縦切りを実装。
- StageEventの二段階ref解決と依存循環検査を実装。
- MovementServiceをread-only queryとして実装。
- 候補経路を最大3本、`cost → step数 → (y,x)座標列`で決定的に取得。
- ActionQueryContextとUI内だけのPreviewを実装。
- GitHub Pagesでそのまま開けるスマートフォン対応previewを実装。
- GitHub Actions用CIを追加。

## 検証結果

- Node自動test: Domain・Factory・Movement・DOM entryを検証し、全件成功。
- 全entry moduleの構文検査: 成功。
- module graph import: 成功。
- HTTP serverから`index.html`、entry module、CSS取得: 成功。
- v9参照cloneの作業後差分: 0件。

## 意図的に保留

- 人物本番data: 正本`水滸伝_人物能力データ_第4.7版.xlsx`が今回の添付にない。
- Combat / Tactic: v9の計算式と特殊ruleを機能単位で再照合してから移植する。
- 具体Objective / StageEvent / Trap: 次のDomain milestone。
- Status / AI / BattleController / Presentation / Save: 依存順に後続実装する。
- 正式Stageとasset: 中核処理成立後に章単位で移植する。

## 次の実装候補

設計上の次順はCombatServiceとTacticService。ただし人物能力の正本がなくても、
計算式・validation・atomic commitの枠とv9固定fixtureによる回帰testまでは進められる。
正本人物dataの取り込みだけはExcel入手後に行う。
