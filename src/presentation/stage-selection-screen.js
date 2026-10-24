import { invariant } from "../core/domain-error.js";

/** Owns the chapter menu only. Battle creation and saved-game loading belong to Game. */
export class StageSelectionScreen {
  #root; #bindings = []; #disposed = false;
  constructor({ root, list, loadButton, stages, onSelect, onLoad }) {
    invariant(root && list && loadButton, "STAGE_SELECTION_ELEMENTS_REQUIRED");
    invariant(typeof onSelect === "function" && typeof onLoad === "function", "STAGE_SELECTION_HANDLERS_REQUIRED");
    this.#root = root;
    list.replaceChildren();
    for (const stage of stages) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "stage-btn"; button.dataset.stageId = stage.id;
      const title = document.createElement("strong"), description = document.createElement("small");
      title.textContent = stage.title; description.textContent = stage.description;
      button.append(title, description); list.append(button);
      this.#listen(button, () => { if (!this.#disposed && !this.#root.hidden) onSelect(stage.id); });
    }
    this.#listen(loadButton, () => { if (!this.#disposed && !this.#root.hidden) onLoad(); });
  }
  #listen(element, handler) { element.addEventListener("click", handler); this.#bindings.push({ element, handler }); }
  show() { if (!this.#disposed) { this.#root.hidden = false; this.#root.setAttribute("aria-hidden", "false"); } }
  hide() { this.#root.hidden = true; this.#root.setAttribute("aria-hidden", "true"); }
  dispose() {
    this.hide(); this.#disposed = true;
    for (const { element, handler } of this.#bindings) element.removeEventListener("click", handler);
    this.#bindings = [];
  }
}
