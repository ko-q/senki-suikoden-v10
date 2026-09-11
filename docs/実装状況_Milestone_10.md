# v10 実装状況 Milestone 10

作成日: 2026-09-10

## 完了

- 手動保存枠を`manual_01`〜`manual_20`の固定20枠へ正式化。
- 20枠をスマートフォン幅でも操作できる内部scroll一覧へ変更。
- temporary／backup候補にだけRepair操作を表示。
- Repair前にSaveCodec、SaveMigrator、content revision、Stage runtimeを再検証。
- 選択時のprimary／temporary／backup実データをguardとして再照合。
- stale guard、別tab更新、storage lock競合では全世代を変更せずRepairを拒否。
- temporaryはprimary書込みとread-back検証後にtemporaryだけを削除。
- backupはtemporaryへ退避・検証してからprimaryへ昇格し、backup自体を残す。
- 昇格途中の書込み失敗でも、正常なtemporaryまたはbackupを最低1世代保持。
- より優先度の高い非対応世代がある場合はRepairを表示・実行せず、rawを保持。
- Repair成功後は同じBattleSessionと表示DOMを維持し、slot表示だけを再検査。
- Save format、content revision、BattleSaveData shape、RNG、ゲームルールは変更なし。

## Repairの処理順

### temporaryからの修復

```text
三世代guard照合
→ temporaryの正常性を再検証
→ slot lock取得
→ primaryへ同じrawを書込
→ primaryとtemporaryの一致をread-back検証
→ temporaryを削除
→ primary／backup／temporary最終状態を検証
```

primary書込みが失敗した場合はtemporaryを削除しない。

### backupからの修復

```text
三世代guard照合
→ backupの正常性を再検証
→ slot lock取得
→ backup rawをtemporaryへ書込・検証
→ primaryへ同じrawを書込・検証
→ temporaryを削除
→ primaryとbackupが同じ正常rawであることを検証
```

primary書込みが失敗した場合もtemporaryとbackupに正常rawが残る。

## Save画面の状態

| 状態 | Save | Load | Repair | Delete |
|---|---:|---:|---:|---:|
| empty | 可 | 不可 | 不可 | 不可 |
| occupied | 可 | 可 | 不要 | 可 |
| temporary | 可 | 可 | 可 | 可 |
| backup | 可 | 可 | 可 | 可 |
| corrupt | 可 | 不可 | 不可 | 可 |
| incompatible | 不可 | 不可 | 不可 | 可 |

temporary／backupでも、手前に将来版の非対応世代がある場合はRepair不可とする。Loadは候補を
変更しないため可能。Save／Deleteは従来どおり明示確認を必要とする。

## 互換境界

- 公開版は`10.0.0-dev.10`。
- Save formatは6のまま変更しない。
- Battle content／Save shapeを変更していないため、content revisionは
  `v10-save-transactional-load-8`を維持する。
- Milestone 8／9で作成した同revisionのsaveをLoad可能。
- storage prefixは`senki_suikoden_v10_test_save_v1:`のまま変更しない。
- 現行v9.7.75とv9保存領域には変更を加えない。

## 検証結果

- Node自動test: 160件成功。
- 20枠のID、件数、順序、重複なし: 成功。
- actual bootstrap経路のSave→temporary化→Repair→Load→DOM交換: 成功。
- temporary／backup両方のprimary昇格: 成功。
- backup Repair後のBattleSession／DOM維持: 成功。
- stale selection guardで全世代不変: 成功。
- promotion途中失敗時の正常fallback保持: 成功。
- 非対応世代を越えるRepair拒否とraw保持: 成功。
- storage不可時の20枠操作無効化: 成功。
- v9 key byte不変: 成功。
- 全JavaScript構文、公開module import、静的HTTP配信: 成功。
- ZIP整合性と展開後成果物の160 test再実行: 成功。
- 実ブラウザ自動確認はbrowser executableがないため未実施。DOM、20枠生成、button操作、
  listener、session交換はNode統合testで検証する。

## まだ正式化していないもの

- 正式人物データ。
- 正式Stage。
- 正式な画像、演出、SE、BGM、AudioController。

正式人物と正式Stageは正本Excel第4.7版およびv9実素材を照合できるまで仮定しない。
