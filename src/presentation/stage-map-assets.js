import { V9_STAGE_MAP_ASSET_MANIFEST } from "./stage-map-asset-manifest.js";

export { V9_STAGE_MAP_ASSET_MANIFEST };
const mapsByKey = new Map(V9_STAGE_MAP_ASSET_MANIFEST.map((asset) => [
  asset.id,
  Object.freeze({ ...asset, url: new URL(`../../assets/maps/${asset.fileName}`, import.meta.url).href })
]));

// BattleMapView resolves the key only after verifying the complete terrain grid.
// Do not attach a map to the development fixture based on its chapterNumber.
export function getStageMapAsset(mapKey) {
  return mapsByKey.get(mapKey) ?? null;
}
