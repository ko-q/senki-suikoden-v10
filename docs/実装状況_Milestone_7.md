# v10 実装状況 Milestone 7

作成日: 2026-09-09

## 完了

- BattleScreenへ弓撃／投擲、突撃、撹乱Lv1〜3、幻術、広域幻術、火計、水計を接続。
- BattleRendererへAction command、使用回数、計略選択panel、対象highlightを追加。
- 弓撃能力と投擲能力から表示名と固有射程を既存Serviceの規則どおり判定。
- `CONFUSION_LEVEL_SELECT`を全計略の選択panelとして使用し、各Actionを専用target modeへ遷移。
- 広域幻術はtarget選択なしで実行し、他の計略と同じく実行後に最終Facingを要求。
- Preview先を`ActionQueryContext.originPosition`へ渡し、移動後位置からActionと対象を照会。
- Action確定時だけ選択経路をBattleControllerへ渡し、Preview時はDomainとRNGを変更しない。
- 無効targetをtapしても選択modeとhighlightを維持し、再選択またはClearを可能にした。
- Tactic選択中とtarget選択中は主commandを隠し、誤ったAction切替を画面側で防止。
- 開発用Unitへ全能力と使用回数を付与し、正式人物データとは明確に分離。
- スマートフォン幅ではActionを2列、計略を1列にしてtap領域を確保。

## 操作できる経路

```text
Unit選択
→ 必要なら移動Previewと候補経路選択
→ 通常攻撃 / 弓撃・投擲 / 突撃 / 計略 / 待機
→ 対象指定（広域幻術を除く）
→ Action commit
→ 計略または待機では最終Facing指定
→ 次UnitまたはPlayer phase終了
```

## InteractionMode

- `UNIT_SELECT / UNIT_SELECTED / MOVE_PREVIEW`
- `BOW_TARGET_SELECT / CHARGE_TARGET_SELECT`
- `CONFUSION_LEVEL_SELECT`
- `CONFUSION_LV1_TARGET_SELECT / CONFUSION_LV2_TARGET_SELECT / CONFUSION_LV3_TARGET_SELECT`
- `ILLUSION_TARGET_SELECT / FIRE_TARGET_SELECT / WATER_TARGET_SELECT`
- `WAIT_FACING_SELECT / TACTIC_FACING_SELECT / LOCKED`

通常攻撃は設計どおり専用target modeを持たず、基本選択modeで隣接敵を直接tapする。
広域幻術は中心targetを持たないため専用target modeを追加しない。

## 境界

- Preview位置は画面状態であり、Action実行までBattleMap上のUnit位置を変更しない。
- 対象照会、Action menu遷移、無効target tapではBattleRandomを消費しない。
- 使用回数、damage、status、Facing、UnitActionStateの変更はServiceとControllerだけが行う。
- BattleScreenはActionの数値式、射程式、成功率を再実装しない。
- 計略commit後のFacing選択は取消不能であり、Domainの`TACTIC_COMMITTED`から再構成する。
- 開発fixtureの全能力構成はUI境界試験専用で、正式人物能力ではない。

## 検証結果

- Node自動test: 106件成功。
- Preview先からの弓撃候補、経路commit、使用回数減算: 成功。
- 突撃の隣接target限定と無効cellでのmode保持: 成功。
- 全target型計略のInteractionMode、highlight、ActionType mapping: 成功。
- target選択中に別のREADY Player Unitをtapした場合の選択切替: 成功。
- 計略menu操作前後のDomain digestとBattleRandom一致: 成功。
- 撹乱Lv2の2回消費、status反映、`TACTIC_COMMITTED`、Facing確定: 成功。
- 広域幻術のtargetなしcommit、使用回数非消費、Facing確定: 成功。
- RendererのBow／Throw表示、Action可否、button event mapping: 成功。
- bootstrap DOMでPreview位置のCharge／Tactic command有効化: 成功。

実ブラウザ実行ファイルがないため、最終的な端末描画は未確認である。DOM実行test、全selector
検査、全JavaScript構文、公開module import、静的HTTP配信で代替検証する。

## 次の実装候補

Save format 6を扱うSaveCodec / SaveRepository / SaveService / SaveMigratorと、旧Battleを
変更せずに検証完了後だけ差し替えるtransactional Loadへ進む。正式人物・正式Stage・画像・
音声は、正本とv9実素材を照合できる段階まで仮定しない。
