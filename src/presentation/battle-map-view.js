import { invariant } from "../core/domain-error.js";
import { Stage } from "../domain/stage.js";
import { getV9StageMapDefinition } from "../definitions/v9-stage-maps.js";
import { getStageMapAsset } from "./stage-map-assets.js";

/** Verify the whole terrain grid, not merely the chapter number or board dimensions. */
export function resolveStageMapAsset(stage) {
  invariant(stage instanceof Stage, "BATTLE_MAP_VIEW_STAGE_REQUIRED");
  const definition = getV9StageMapDefinition(stage.id);
  if (definition === null) return null;
  invariant(stage.chapterNumber === definition.chapterNumber
    && stage.map.width === definition.columns && stage.map.height === definition.rows,
  "BATTLE_MAP_VIEW_DIMENSIONS_MISMATCH", { stageId: stage.id });
  for (let y = 0; y < definition.rows; y++) {
    for (let x = 0; x < definition.columns; x++) {
      invariant(stage.map.getCellAt(x, y).terrain.id === definition.map[y][x],
        "BATTLE_MAP_VIEW_TERRAIN_MISMATCH", { stageId: stage.id, x, y });
    }
  }
  return getStageMapAsset(definition.mapKey);
}

/** Owns background image loading independently of board cell redraws. */
export class BattleMapView {
  #board;
  #stage = null;
  #pending = null;

  constructor(board) {
    invariant(board?.style !== undefined && board?.dataset !== undefined, "BATTLE_MAP_VIEW_BOARD_REQUIRED");
    this.#board = board;
  }

  render(stage) {
    if (stage === this.#stage) return;
    // Reject mismatches before touching an existing view.
    const asset = resolveStageMapAsset(stage);
    this.clear();
    this.#stage = stage;
    if (asset === null) return;
    const image = document.createElement("img");
    const onLoad = () => {
      if (this.#pending?.image !== image) return;
      this.#detach();
      this.#board.style.backgroundImage = `url("${asset.url}")`;
      this.#board.style.backgroundSize = asset.backgroundSize;
      this.#board.style.backgroundPosition = asset.backgroundPosition;
      this.#board.dataset.mapKey = asset.id;
      this.#board.dataset.mapReady = "true";
    };
    const onError = () => {
      if (this.#pending?.image !== image) return;
      this.#detach();
      // Keep the terrain colors and controls usable if the image cannot be loaded.
      this.#board.dataset.mapReady = "false";
    };
    this.#pending = { image, onLoad, onError };
    image.addEventListener("load", onLoad, { once: true });
    image.addEventListener("error", onError, { once: true });
    image.src = asset.url;
  }

  #detach() {
    if (this.#pending === null) return;
    const { image, onLoad, onError } = this.#pending;
    image.removeEventListener("load", onLoad);
    image.removeEventListener("error", onError);
    this.#pending = null;
  }

  clear() {
    this.#detach();
    this.#stage = null;
    this.#board.style.backgroundImage = "";
    this.#board.style.backgroundSize = "";
    this.#board.style.backgroundPosition = "";
    this.#board.dataset.mapKey = "";
    this.#board.dataset.mapReady = "false";
  }
}
