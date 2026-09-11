class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...names) {
    for (const name of names) {
      this.values.add(name);
    }
  }

  remove(...names) {
    for (const name of names) {
      this.values.delete(name);
    }
  }

  contains(name) {
    return this.values.has(name);
  }

  has(name) {
    return this.values.has(name);
  }
}

export class FakeElement {
  constructor({ selectorMap = null } = {}) {
    this.attributes = new Map();
    this.children = [];
    this.classList = new FakeClassList();
    this.className = "";
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
    this.parentNode = null;
    this.removeCount = 0;
    this.selectorMap = selectorMap;
    this.style = {};
    this.textContent = "";
    this.type = "";
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type);
    if (listeners === undefined) {
      return;
    }
    listeners.delete(listener);
    if (listeners.size === 0) {
      this.listeners.delete(type);
    }
  }

  append(...children) {
    for (const child of children) {
      if (child !== null && typeof child === "object") {
        child.parentNode = this;
      }
    }
    this.children.push(...children);
  }

  replaceChildren(...children) {
    for (const child of this.children) {
      if (child !== null && typeof child === "object" && child.parentNode === this) {
        child.parentNode = null;
      }
    }
    for (const child of children) {
      if (child !== null && typeof child === "object") {
        child.parentNode = this;
      }
    }
    this.children = [...children];
  }

  remove() {
    this.removeCount += 1;
    if (this.parentNode === null) {
      return;
    }
    const parent = this.parentNode;
    parent.children = parent.children.filter((child) => child !== this);
    this.parentNode = null;
  }

  querySelector(selector) {
    return this.selectorMap?.get(selector) ?? null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  dispatch(type) {
    if (this.disabled) {
      return;
    }
    const listeners = this.listeners.get(type);
    if (listeners !== undefined) {
      for (const listener of [...listeners]) {
        listener({ type, target: this });
      }
    }
  }
}

export function createFakeBattleElements() {
  const elements = {
    actionPanel: new FakeElement(),
    board: new FakeElement(),
    bowButton: new FakeElement(),
    chargeButton: new FakeElement(),
    confusionLv1Button: new FakeElement(),
    confusionLv2Button: new FakeElement(),
    confusionLv3Button: new FakeElement(),
    dialogueNextButton: new FakeElement(),
    dialogueOverlay: new FakeElement(),
    dialogueSpeaker: new FakeElement(),
    dialogueText: new FakeElement(),
    domainValue: new FakeElement(),
    endTurnButton: new FakeElement(),
    eventText: new FakeElement(),
    fireButton: new FakeElement(),
    facingEastButton: new FakeElement(),
    facingNorthButton: new FakeElement(),
    facingPanel: new FakeElement(),
    facingSouthButton: new FakeElement(),
    facingWestButton: new FakeElement(),
    instructionText: new FakeElement(),
    illusionButton: new FakeElement(),
    modeValue: new FakeElement(),
    pathButton: new FakeElement(),
    pathSummary: new FakeElement(),
    phaseValue: new FakeElement(),
    resetButton: new FakeElement(),
    selectedUnitText: new FakeElement(),
    tacticButton: new FakeElement(),
    tacticPanel: new FakeElement(),
    turnValue: new FakeElement(),
    versionValue: new FakeElement(),
    waitButton: new FakeElement(),
    waterButton: new FakeElement(),
    wideIllusionButton: new FakeElement()
  };
  elements.actionPanel.hidden = true;
  elements.dialogueOverlay.hidden = true;
  elements.facingPanel.hidden = true;
  elements.tacticPanel.hidden = true;
  return elements;
}

export function createFakeBattleViewTemplate() {
  const createdViews = [];
  const template = {
    content: {
      cloneNode() {
        const elements = createFakeBattleElements();
        const rootSelectors = new Map(Object.entries(elements).map(([key, element]) => [
          `#${key}`,
          element
        ]));
        const root = new FakeElement({ selectorMap: rootSelectors });
        const fragment = new FakeElement({
          selectorMap: new Map([["[data-battle-view-root]", root]])
        });
        createdViews.push({ elements, root });
        return fragment;
      }
    }
  };
  return { template, createdViews };
}

export function createFakePersistenceElements() {
  const elements = {
    audioButton: new FakeElement(),
    manualSlotList: new FakeElement(),
    newBattleButton: new FakeElement(),
    persistenceStatus: new FakeElement(),
    persistenceUnavailable: new FakeElement(),
    recoveryOverlay: new FakeElement(),
    recoverySummary: new FakeElement(),
    refreshSlotsButton: new FakeElement(),
    resumeRecoveryButton: new FakeElement(),
    startNewFromRecoveryButton: new FakeElement()
  };
  elements.persistenceUnavailable.hidden = true;
  elements.recoveryOverlay.hidden = true;
  return elements;
}

export function installFakeDocument(elements = null) {
  const previousDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return new FakeElement();
    },
    querySelector(selector) {
      if (elements === null) {
        return null;
      }
      return elements[selector.slice(1)] ?? null;
    }
  };
  return () => {
    globalThis.document = previousDocument;
  };
}
