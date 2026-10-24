import { V9_PORTRAIT_ASSET_MANIFEST } from "./portrait-asset-manifest.js";

export { V9_PORTRAIT_ASSET_MANIFEST };
const portraitsByKey = new Map(V9_PORTRAIT_ASSET_MANIFEST.map((asset) => [
  asset.id,
  Object.freeze({ ...asset, url: new URL(`../../assets/portraits/${asset.fileName}`, import.meta.url).href })
]));

// A portrait key is an explicit presentation reference, never a guessed Character ID.
export function getPortraitAsset(portraitKey) {
  return portraitsByKey.get(portraitKey) ?? null;
}
