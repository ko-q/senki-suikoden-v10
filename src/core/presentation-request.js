import {
  invariant,
  requireEnumValue,
  requireNonEmptyString
} from "./domain-error.js";
import { Dialogue } from "../domain/dialogue.js";

export const PresentationRequestType = Object.freeze({
  DIALOGUE: "DIALOGUE",
  NOTICE: "NOTICE",
  MOVE: "MOVE",
  ACTION: "ACTION",
  DAMAGE: "DAMAGE",
  STATUS: "STATUS",
  TRAP: "TRAP",
  PHASE: "PHASE",
  CONFIRM: "CONFIRM",
  BATTLE_RESULT: "BATTLE_RESULT"
});

function normalizeSnapshotValue(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    invariant(Number.isFinite(value), "PRESENTATION_NOTICE_PARAMETER_INVALID");
    return value;
  }
  if (Array.isArray(value)) {
    return Object.freeze(value.map((item) => normalizeSnapshotValue(item)));
  }
  invariant(
    typeof value === "object"
      && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
    "PRESENTATION_NOTICE_PARAMETER_INVALID"
  );
  return Object.freeze(Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeSnapshotValue(item)])
  ));
}

function normalizeParameters(parameters) {
  invariant(
    parameters !== null && typeof parameters === "object" && !Array.isArray(parameters),
    "PRESENTATION_NOTICE_PARAMETERS_INVALID"
  );
  return normalizeSnapshotValue(parameters);
}

/**
 * EventからUIへ渡せる意味的要求だけを生成する。
 */
export function createDialoguePresentationRequest(dialogue) {
  invariant(dialogue instanceof Dialogue, "PRESENTATION_DIALOGUE_REQUIRED");
  return Object.freeze({
    type: PresentationRequestType.DIALOGUE,
    dialogue
  });
}

export function createNoticePresentationRequest(messageKey, parameters = {}) {
  return Object.freeze({
    type: PresentationRequestType.NOTICE,
    messageKey: requireNonEmptyString(messageKey, "PRESENTATION_NOTICE_KEY_INVALID"),
    parameters: normalizeParameters(parameters)
  });
}

/**
 * Controllerから画面へ渡す意味的要求をdata-only snapshotとして生成する。
 */
export function createSemanticPresentationRequest(type, payload = {}) {
  requireEnumValue(type, PresentationRequestType, "PRESENTATION_REQUEST_TYPE_INVALID");
  invariant(
    type !== PresentationRequestType.DIALOGUE && type !== PresentationRequestType.NOTICE,
    "PRESENTATION_SEMANTIC_TYPE_INVALID"
  );
  return Object.freeze({
    type,
    payload: normalizeParameters(payload)
  });
}

export function validatePresentationRequest(request) {
  invariant(
    request !== null && typeof request === "object" && !Array.isArray(request),
    "PRESENTATION_REQUEST_INVALID"
  );
  const type = requireEnumValue(
    request.type,
    PresentationRequestType,
    "PRESENTATION_REQUEST_TYPE_INVALID"
  );
  if (type === PresentationRequestType.DIALOGUE) {
    invariant(request.dialogue instanceof Dialogue, "PRESENTATION_DIALOGUE_REQUIRED");
  }
  if (type === PresentationRequestType.NOTICE) {
    requireNonEmptyString(request.messageKey, "PRESENTATION_NOTICE_KEY_INVALID");
    normalizeParameters(request.parameters ?? {});
  }
  if (type !== PresentationRequestType.DIALOGUE && type !== PresentationRequestType.NOTICE) {
    normalizeParameters(request.payload ?? {});
  }
  return request;
}

export function normalizePresentationRequests(requests = []) {
  invariant(Array.isArray(requests), "PRESENTATION_REQUESTS_ARRAY_REQUIRED");
  return Object.freeze(requests.map((request) => {
    validatePresentationRequest(request);
    if (request.type === PresentationRequestType.DIALOGUE) {
      return createDialoguePresentationRequest(request.dialogue);
    }
    if (request.type === PresentationRequestType.NOTICE) {
      return createNoticePresentationRequest(request.messageKey, request.parameters ?? {});
    }
    return createSemanticPresentationRequest(request.type, request.payload ?? {});
  }));
}
