import { invariant } from "../core/domain-error.js";
import { CharacterPortraitView } from "./character-portrait-view.js";
import { ContinueDialog } from "./continue-dialog.js";

/** One battle's V9 dialogue card; sequence position belongs to DialogueController. */
export class DialogueView {
  #elements; #portrait; #dialog; #disposed = false;
  constructor(elements, onContinue) {
    this.#elements = elements;
    this.#portrait = new CharacterPortraitView(elements.dialoguePortrait);
    this.#dialog = new ContinueDialog({ root: elements.dialogueOverlay,
      button: elements.dialogueNextButton, onContinue });
  }
  render(speech) {
    if (this.#disposed) return;
    invariant(speech !== null && typeof speech === "object", "BATTLE_SPEECH_REQUIRED");
    const e = this.#elements;
    e.dialogueSpeaker.textContent = speech.speaker?.name ?? speech.narratorLabel;
    e.dialogueAction.textContent = speech.actionLabel ?? "";
    e.dialogueAction.hidden = !speech.actionLabel;
    this.#portrait.render(speech.speaker);
    e.dialogueText.textContent = speech.text;
    e.dialogueNextButton.textContent = "進む";
    const card = e.dialogueOverlay.querySelector?.(".dialogue-card");
    if (card) card.scrollTop = 0;
    this.#dialog.show();
  }
  hide(options) {
    this.#dialog.hide(options);
    this.#portrait.clear();
    this.#elements.dialogueSpeaker.textContent = "";
    this.#elements.dialogueAction.textContent = "";
    this.#elements.dialogueAction.hidden = true;
    this.#elements.dialogueText.textContent = "";
  }
  refreshFocus() { this.#dialog.refreshFocus(); }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    this.hide({ restoreFocus: false });
    this.#dialog.dispose(); this.#portrait.dispose();
  }
}
