import { invariant } from "../core/domain-error.js";

export const BattleVisualAssetId = Object.freeze({
  CHARGE_DUST: "CHARGE_DUST",
  CONFUSION_ALERT: "CONFUSION_ALERT",
  CONFUSION_QUESTION: "CONFUSION_QUESTION",
  FIRE_TACTIC_BURST: "FIRE_TACTIC_BURST",
  NORMAL_ILLUSION_SKULL: "NORMAL_ILLUSION_SKULL",
  WATER_TACTIC_BURST: "WATER_TACTIC_BURST",
  WIDE_ILLUSION_MIST: "WIDE_ILLUSION_MIST",
  WIDE_ILLUSION_SKELETON: "WIDE_ILLUSION_SKELETON"
});

function freezeAssetDefinition(id, fileName, byteLength, sha256) {
  return Object.freeze({
    id,
    fileName,
    mimeType: "image/webp",
    byteLength,
    sha256
  });
}

/**
 * v9.7.75のbattle-effect-assets.jsからBase64を復号した同一バイト列の監査表。
 */
export const V9_BATTLE_VISUAL_ASSET_MANIFEST = Object.freeze([
  freezeAssetDefinition(BattleVisualAssetId.CHARGE_DUST, "charge-dust.webp", 77056, "3963c0aef9324da8c2c2efb2e3a246b3559ed7484a304169215deaef422c88b4"),
  freezeAssetDefinition(BattleVisualAssetId.CONFUSION_ALERT, "confusion-alert.webp", 97778, "cf67bf5ecfa60b2cac180f1cfe15998521817609dbf7f4b2b06d95f1cf8d19d4"),
  freezeAssetDefinition(BattleVisualAssetId.CONFUSION_QUESTION, "confusion-question.webp", 261108, "63d30d9bbd7d7776a67345629fde73417818b8b6ae5c55e289142f4d0d65c0bf"),
  freezeAssetDefinition(BattleVisualAssetId.FIRE_TACTIC_BURST, "fire-tactic-burst.webp", 5930002, "f6d6acb1eed0e93c7462df549712214e6ec7ddb178de93cd927d5d64b73b72ab"),
  freezeAssetDefinition(BattleVisualAssetId.NORMAL_ILLUSION_SKULL, "normal-illusion-skull.webp", 376252, "1f92e3c29e085fb7e786d29b621acf525c7946b2b192df9719ff64c38fe64556"),
  freezeAssetDefinition(BattleVisualAssetId.WATER_TACTIC_BURST, "water-tactic-burst.webp", 850734, "0ac50d8d704cbd71dd0bef8ec2ab7871f6958016c73dfca2ce82602dce40e5e1"),
  freezeAssetDefinition(BattleVisualAssetId.WIDE_ILLUSION_MIST, "wide-illusion-mist.webp", 4645828, "fdac15bb291b6f5b3852a749294b43b6088b9aced701f55786aff4ae43306095"),
  freezeAssetDefinition(BattleVisualAssetId.WIDE_ILLUSION_SKELETON, "wide-illusion-skeleton.webp", 4302022, "2e9d293b33747f09f2046d7b1ea2f25306029e4139c630f9b02848841fb8a56c")
]);

export const DEFAULT_BATTLE_VISUAL_ASSET_URLS = Object.freeze(Object.fromEntries(
  V9_BATTLE_VISUAL_ASSET_MANIFEST.map((definition) => [
    definition.id,
    new URL(`../../assets/effects/${definition.fileName}`, import.meta.url).href
  ])
));

export function requireBattleVisualAssetCatalog(catalog) {
  invariant(
    catalog !== null && typeof catalog === "object" && !Array.isArray(catalog),
    "BATTLE_VISUAL_ASSET_CATALOG_INVALID"
  );
  for (const assetId of Object.values(BattleVisualAssetId)) {
    invariant(
      typeof catalog[assetId] === "string" && catalog[assetId].length > 0,
      "BATTLE_VISUAL_ASSET_URL_MISSING",
      { assetId }
    );
  }
  return Object.freeze({ ...catalog });
}
