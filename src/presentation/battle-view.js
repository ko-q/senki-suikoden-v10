import { invariant } from "../core/domain-error.js";

export const BATTLE_VIEW_ELEMENT_IDS = Object.freeze({
  actionPanel: "actionPanel",
  board: "board",
  bowButton: "bowButton",
  chargeButton: "chargeButton",
  confusionLv1Button: "confusionLv1Button",
  confusionLv2Button: "confusionLv2Button",
  confusionLv3Button: "confusionLv3Button",
  dialogueNextButton: "dialogueNextButton",
  dialogueOverlay: "dialogueOverlay",
  dialogueSpeaker: "dialogueSpeaker",
  dialogueText: "dialogueText",
  domainValue: "domainValue",
  endTurnButton: "endTurnButton",
  eventText: "eventText",
  fireButton: "fireButton",
  facingEastButton: "facingEastButton",
  facingNorthButton: "facingNorthButton",
  facingPanel: "facingPanel",
  facingSouthButton: "facingSouthButton",
  facingWestButton: "facingWestButton",
  instructionText: "instructionText",
  illusionButton: "illusionButton",
  modeValue: "modeValue",
  pathButton: "pathButton",
  pathSummary: "pathSummary",
  phaseValue: "phaseValue",
  resetButton: "resetButton",
  selectedUnitText: "selectedUnitText",
  tacticButton: "tacticButton",
  tacticPanel: "tacticPanel",
  turnValue: "turnValue",
  versionValue: "versionValue",
  waitButton: "waitButton",
  waterButton: "waterButton",
  wideIllusionButton: "wideIllusionButton"
});

function requireDomMethod(target, methodName, code) {
  invariant(target !== null && typeof target === "object", code);
  invariant(typeof target[methodName] === "function", code, { methodName });
}

function resolveElements(root) {
  const elements = {};
  for (const [key, id] of Object.entries(BATTLE_VIEW_ELEMENT_IDS)) {
    const element = root.querySelector(`#${id}`);
    invariant(element !== null, "BATTLE_VIEW_ELEMENT_MISSING", { key, id });
    elements[key] = element;
  }
  return Object.freeze(elements);
}

/**
 * 一つのBattle画面DOMを、非表示構築から表示rootへの交換まで所有する。
 */
export class BattleView {
  #host;
  #root;
  #active;
  #disposed;

  constructor({ host, root, elements }) {
    requireDomMethod(host, "replaceChildren", "BATTLE_VIEW_HOST_INVALID");
    requireDomMethod(root, "querySelector", "BATTLE_VIEW_ROOT_INVALID");
    invariant(elements !== null && typeof elements === "object", "BATTLE_VIEW_ELEMENTS_REQUIRED");
    this.#host = host;
    this.#root = root;
    this.elements = elements;
    this.#active = false;
    this.#disposed = false;
  }

  get root() {
    return this.#root;
  }

  get isActive() {
    return this.#active;
  }

  get isDisposed() {
    return this.#disposed;
  }

  activate() {
    invariant(!this.#disposed, "BATTLE_VIEW_DISPOSED");
    invariant(!this.#active, "BATTLE_VIEW_ALREADY_ACTIVE");
    this.#host.replaceChildren(this.#root);
    this.#active = true;
  }

  dispose() {
    if (this.#disposed) {
      return;
    }
    this.#disposed = true;
    if (typeof this.#root.remove === "function") {
      this.#root.remove();
    }
    this.#active = false;
  }
}

/**
 * templateを複製し、旧画面へ触れずにcandidate画面を組み立てる。
 */
export class BattleViewFactory {
  #host;
  #template;

  constructor({ host, template }) {
    requireDomMethod(host, "replaceChildren", "BATTLE_VIEW_HOST_INVALID");
    invariant(
      template !== null
        && typeof template === "object"
        && template.content !== null
        && typeof template.content === "object"
        && typeof template.content.cloneNode === "function",
      "BATTLE_VIEW_TEMPLATE_INVALID"
    );
    this.#host = host;
    this.#template = template;
  }

  create() {
    const fragment = this.#template.content.cloneNode(true);
    requireDomMethod(fragment, "querySelector", "BATTLE_VIEW_FRAGMENT_INVALID");
    const root = fragment.querySelector("[data-battle-view-root]");
    invariant(root !== null, "BATTLE_VIEW_ROOT_MISSING");
    const elements = resolveElements(root);
    return new BattleView({ host: this.#host, root, elements });
  }
}
