import { invariant } from "../core/domain-error.js";
import { getPortraitAsset } from "./portrait-assets.js";

/** Owns a single portrait slot and its loading-error listener, with no Domain writes. */
export class CharacterPortraitView {
  #host;
  #image = null;
  #errorHandler = null;
  #character = undefined;
  #disposed = false;

  constructor(host) {
    invariant(host !== null && typeof host?.replaceChildren === "function",
      "CHARACTER_PORTRAIT_HOST_REQUIRED");
    this.#host = host;
    this.clear();
  }

  render(character) {
    if (this.#disposed || character === this.#character) return;
    this.clear();
    this.#character = character;
    const asset = getPortraitAsset(character?.portraitKey);
    if (asset === null) return;
    const image = document.createElement("img");
    image.className = "character-portrait-image";
    image.alt = character.name;
    image.decoding = "async";
    this.#errorHandler = () => {
      // A removed portrait must never hide the replacement speaker's image.
      if (this.#image === image) this.clear();
    };
    this.#image = image;
    image.addEventListener("error", this.#errorHandler, { once: true });
    this.#host.append(image);
    this.#host.hidden = false;
    image.src = asset.url;
  }

  clear() {
    if (this.#image !== null) {
      this.#image.removeEventListener("error", this.#errorHandler);
    }
    this.#image = null;
    this.#errorHandler = null;
    this.#character = undefined;
    this.#host.replaceChildren();
    this.#host.hidden = true;
  }

  dispose() {
    if (this.#disposed) return;
    this.clear();
    this.#disposed = true;
  }
}
