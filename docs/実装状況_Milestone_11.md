# v10 実装状況 Milestone 11

作成日: 2026-09-10

## 完了

- v9.7.75の`audio-assets.js`から既存音声20点を個別fileへ復号。
- 全音声fileのbyte数とSHA-256をmanifestおよび自動testで固定。
- AudioControllerでWeb Audio graph、decode cache、BGM、SEを一元管理。
- `BattleAudioSession`でBattle固有の一時音を所有し、session破棄時に停止。
- decode待ち中にBattleが破棄された場合も、完了後の再生を拒否。
- PresentationRequestの意味情報から音声cueへ写像し、Domainへasset IDを持ち込まない。
- 通常攻撃、味方／敵弓撃、突撃、撹乱、幻術、広域幻術、火計、水計、罠、phase音を接続。
- 章番号に応じた戦闘BGM三種の周期選択を接続。
- 勝利／敗北BGMを接続し、敗北はv9と同じ3.3秒offsetから一回再生。
- browserの初回user gestureで音声を解錠し、画面右上でON／OFFを切替。
- `visibilitychange`でAudioContextを停止・再開。
- Game、BattleSessionFactory、BattleEffectManager、BattleScreenのdispose経路へ音声を統合。
- Save format、content revision、storage prefix、戦闘式、AI、人物値、Domain RNGは変更なし。

## 責務境界

```text
BattleController
  → assetを知らないPresentationRequest
BattleEffectManager
  → BattleAudioSession.present(request, signal)
BattleAudioSession
  → Battle固有のsourceと遅延decodeをcancel
AudioController
  → 共有Web Audio graph、asset cache、BGM lifecycle
Game
  → 章BGM、unlock、toggle、visibility、全体dispose
```

BGMはGame単位、一時SEはBattle単位で所有する。Loadによるsession交換では、candidate接続成功後に
旧BattleAudioSessionを破棄するため、旧画面の音が新Battleへ残らない。

## v9素材の同一性

- 対象asset数: 20。
- 復号後の総byte数: 6,121,296 bytes。
- 各fileは`src/audio/audio-assets.js`のSHA-256で個別検証する。
- 音源の再生成、加工、差替えは行っていない。

## 互換境界

- 実装版は`10.0.0-dev.11`。
- Save formatは6のまま変更しない。
- content revisionは`v10-save-transactional-load-8`を維持する。
- storage prefixは`senki_suikoden_v10_test_save_v1:`のまま変更しない。
- v9.7.75のRepositoryと保存領域には変更を加えない。
- 音声／UIの乱数はDomainのBattleRandomを消費しない。

## 検証結果

- 音声assetのbyte数・SHA-256照合: 20点成功。
- 音声cueとBGM mapping: 成功。
- 初回unlock、toggle、visibility suspend／resume: 成功。
- 敗北BGMの3.3秒offset: 成功。
- session破棄後の再生停止: 成功。
- 遅延decode完了後の旧Battle音声拒否: 成功。
- BattleEffectManagerとGame lifecycle統合: 成功。
- Node自動test: 172件成功。
- 全JavaScript構文、公開module import、静的HTTP配信: 成功。

## まだ正式化していないもの

- 正式人物データ。
- 正式Stage。
- 既存画像と画像演出のmapping・音声との厳密な時間同期。

正式人物と正式Stageは正本Excel第4.7版を確認できるまで仮定しない。次はv9実画像と表示順を
直接照合し、Presentation層だけへ移植する。
