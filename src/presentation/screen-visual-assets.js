import { invariant } from "../core/domain-error.js";

export const ScreenVisualAssetId = Object.freeze({
  TITLE_BACKGROUND: "TITLE_BACKGROUND",
  TITLE_LOGO: "TITLE_LOGO",
  VICTORY_ARMY: "VICTORY_ARMY",
  VICTORY_TITLE: "VICTORY_TITLE",
  VICTORY_RAYS: "VICTORY_RAYS",
  DEFEAT_ARMY: "DEFEAT_ARMY",
  DEFEAT_TITLE: "DEFEAT_TITLE"
});

function freezeAssetDefinition(id, fileName, mimeType, byteLength, sha256) {
  return Object.freeze({ id, fileName, mimeType, byteLength, sha256 });
}

export const V9_SCREEN_VISUAL_ASSET_MANIFEST = Object.freeze([
  freezeAssetDefinition(
    ScreenVisualAssetId.TITLE_BACKGROUND,
    "title-background.jpg",
    "image/jpeg",
    305586,
    "45d4fdddc244657946cf16ea8dadf4164c98640a3ba3fd60ad70bf7e54bbc17a"
  ),
  freezeAssetDefinition(
    ScreenVisualAssetId.TITLE_LOGO,
    "title-logo.png",
    "image/png",
    1747961,
    "05fa2b37084eb4d5d87252af4aeabb08d2583131d41c7b4c1fc88f74927a781d"
  ),
  freezeAssetDefinition(
    ScreenVisualAssetId.VICTORY_ARMY,
    "victory-army.png",
    "image/png",
    2711943,
    "1a1d6d40e7ec81e4bf0306415b95bcae5b8b3e6f1570b3ae37906e8b70e78d89"
  ),
  freezeAssetDefinition(
    ScreenVisualAssetId.VICTORY_TITLE,
    "victory-title.png",
    "image/png",
    1735933,
    "b834c66bd14d3a158df48001a5d4e051e9da1ae1f1336ccb382f0cddbf8864ab"
  ),
  freezeAssetDefinition(
    ScreenVisualAssetId.VICTORY_RAYS,
    "victory-rays.png",
    "image/png",
    1630974,
    "4f087518b41e863041719e517ff2233edac46fe4e170c7ecb53f15d5220f79e0"
  ),
  freezeAssetDefinition(
    ScreenVisualAssetId.DEFEAT_ARMY,
    "defeat-army.png",
    "image/png",
    2384918,
    "11377935d2f543d0c884be1360f4d60c7430f35845d159e68907f6826aedddc1"
  ),
  freezeAssetDefinition(
    ScreenVisualAssetId.DEFEAT_TITLE,
    "defeat-title.png",
    "image/png",
    1772665,
    "03f79356dc5f0e852072d5c540e56d792dbac2ef558f49c613dc51df847cd231"
  )
]);

export const DEFAULT_SCREEN_VISUAL_ASSET_URLS = Object.freeze(
  Object.fromEntries(V9_SCREEN_VISUAL_ASSET_MANIFEST.map((asset) => [
    asset.id,
    new URL(`../../assets/screens/${asset.fileName}`, import.meta.url).href
  ]))
);

export function requireScreenVisualAssetCatalog(assetUrls) {
  invariant(
    assetUrls !== null && typeof assetUrls === "object" && !Array.isArray(assetUrls),
    "SCREEN_VISUAL_ASSET_CATALOG_INVALID"
  );
  const resolved = {};
  for (const assetId of Object.values(ScreenVisualAssetId)) {
    const url = assetUrls[assetId];
    invariant(
      typeof url === "string" && url.length > 0,
      "SCREEN_VISUAL_ASSET_URL_INVALID",
      { assetId }
    );
    resolved[assetId] = url;
  }
  return Object.freeze(resolved);
}
