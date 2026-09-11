# v10 実装状況 Milestone 2

作成日: 2026-09-07

## 完了

- v9.7.75 commit `3e3fb85ca8279e5351668562dea677df777a1ddc`を再照合。
- ActionTypeと最小ActionRequestを実装。
- Unit能力IDとv9互換の使用回数IDを定数化。
- BattleRandomをv9と同じxorshift32で実装。
- CombatServiceのread-only queryとatomic実行を分離。
- 通常攻撃、弓撃/投擲、突撃を実装。
- 盾牌、方向、地形、湿地、水系適性、連環馬の補正順を移植。
- TacticServiceのread-only queryとatomic実行を分離。
- 撹乱Lv1-3、幻術、広域幻術、火計、水計を実装。
- 複数対象はStage.unitOrderで計算し、全計算後に同期一括反映。
- CombatResult / TacticResultへUnit参照、兵力・状態前後、敗走、Position snapshotを格納。
- validation失敗時にUnit、使用回数、BattleRandomが変化しないことを自動test化。

## v10仕様としての差分

v9には、ILLUSIONの残りturnがCONFUSED以上ならCONFUSEDを削除する処理がある。
v10では承認済み仕様に従い、この削除処理を移植していない。両statusは独立して残る。
これに伴い、ILLUSIONが2turn残る対象にもCONFUSEDを独立付与できる。

## 検証結果

- Node自動test: 34件成功。
- BattleRandom既知sequenceとstate復元: 成功。
- 通常攻撃の固定計算値: 成功。
- 弓/投擲射程、城壁射線、盾牌補正: 成功。
- 突撃のdamage・撹乱・使用回数: 成功。
- 湿地と連環馬の補正順: 成功。
- 撹乱範囲、Definition順、成功turn、Facing乱数順: 成功。
- 火計の敵味方巻き込み、地形補正、0.75倍、敗走結果: 成功。
- 水計の道と水利補正の加算: 成功。
- Preview/read-only query前後のDomain不変: 成功。

## 境界

- CombatService / TacticServiceはBattleMap、Army、phase、Objective、Event、UIを変更しない。
- 敗走Unitは結果へ含めるがMapから除去しない。BattleControllerが最初のawait前に除去する。
- actionState遷移、BattleLog、演出要求、勝敗・Event解決はBattleControllerの責務として保留。
- 高廉の広域幻術を許可するStage固有条件はAI/Stage側で判定する。
- 正式人物能力・技能・使用回数mappingは正本Excel第4.7版入手まで行わない。

## 次の実装候補

設計順では具体Objective、StageEvent、Trap解決を先に実装し、その後StatusService、
AIService、BattleControllerへ進む。
