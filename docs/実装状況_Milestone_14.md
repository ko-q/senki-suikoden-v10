# v10 実装状況 Milestone 14

作成日: 2026-09-13

追記: Milestone 15で第9章の盤面寸法を8×20へ訂正し、全地形を照合する背景表示を実装した。以下は当時の記録。

## 完了した実装

- `portrait-assets.js` の人物・兵種・護送車画像166点を個別ファイルへ復号。計13,555,180 bytes。
- `stage-map-assets.css` の全9章画像を復号。計14,909,430 bytes。
- 全175点の元キー・byte数・SHA-256・MIMEをimmutable manifestへ固定。
- 宣言MIMEがPNGでも実体がJPEGである画像はJPEG拡張子で配信する。画像のbyte列は変更しない。
- マップの元の表示寸法とcropを保存。第1章は112.5%／50% 25%、第6・7章は8×20、それ以外は8×16。
- `CharacterPortraitView` が明示的portraitKeyから選択人物と会話話者を描画。
- キーなし・未知キーでは人物画像を推測しない。従来の人物名と本文は表示を継続。
- 表示交換・非表示・Battle破棄で画像エラーlistenerを解除。旧画像の遅延失敗が新しい画像を隠さない。
- `ActionCutInSession` をBattleSessionFactory／BattleEffectManagerへ接続。
- v9の固有台詞9人分と既定台詞、弓撃／投擲・突撃・撹乱・幻術・火計・水計のラベルを移植。
- カットインは680ms。後続間隔は原則80ms、敵弓撃は70ms、敵突撃は0ms。
- カットイン→間隔→SEと戦闘演出の順序を維持。通常攻撃にはカットインを追加しない。
- Abort／disposeは待機timer、listener、portrait、overlayを破棄し、その後のSE開始を抑止。
- Save format 6、content revision、storage prefix、人物能力、戦闘式、AI、Domain RNGは変更なし。

## 実ファイルからの再現

参照元は `ko-q/senki-suikoden` commit `3e3fb85ca8279e5351668562dea677df777a1ddc`。

```sh
node scripts/import-v9-visual-assets.mjs ../v9-reference
```

スクリプトは入力sourceをSHA-256で検証し、JavaScriptを実行せずデータ行だけを復号する。
入力テキストのCRLFをLFに正規化するためWindows／Linuxで同じsourceを受理する。
画像は再圧縮・リサイズ・再生成しない。

## 検証

- Node自動テスト: 201件成功、失敗0。
- 175画像の実byte数・SHA-256・画像signature照合: 成功。
- 既存20音源・戦闘画像8点・画面画像7点の同一性テストも成功。
- カットインと音声順序、Abort／dispose、旧portrait listener解除: 成功。
- 既存bootstrap、Save／Load／Repair、BattleSession交換、戦闘ルールの回帰: 成功。
- 全JavaScript構文検査、公開module import、git diff --check: 成功。
- 実ブラウザの表示・操作検証は今回未完了。自動DOMテストを実施済み。

## 未完了・次の実装

- マップ画像catalogは準備済みだが正式Stageへまだ接続していない。
- 正式人物能力とStage定義、portraitKey mappingの正本照合が必要。
- 開発画面は引き続きfixtureであり、正式章のテストプレイ開始とは扱わない。
- ユーザー方針: テストプレイを急ぐより正しい実装を優先。実装の結果として遊べる段階で通知する。

## 人物能力表の所在調査

ユーザーによれば正本ExcelはChatGPTで生成した成果物である。
「戦旗水滸伝 開発申し送り」の冒頭申し送りで、次の参照を確認した。

- 正式名: `水滸伝_人物能力データ_第4.7版.xlsx`
- file ID: `file_0000000018a08211a5326868e8814fb7`
- file ID: `file_00000000580c8206970c5b5e68cbfcf1`
- 会話ID: `6a7fe1d1-1050-83ee-ac00-e66e41409cd7`
- 参照発言ID: `bbb2111c-79bd-4def-97e1-f010341ce541`

現在参照できる会話添付一覧ではExcel本体は取得できず、Documents/ChatGPTとDownloadsにもなし。
ブラウザ側ChatGPTは未ログイン。生成済みファイル本体の回収は未完了であり、
v9の数値を正本Excelと同一であると推測して正式採用しない。
