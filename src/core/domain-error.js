/**
 * Domain不変条件の違反を機械判定できる形で表す。
 */
export class DomainError extends Error {
  constructor(code, details = undefined) {
    super(code);
    this.name = "DomainError";
    this.code = code;
    this.details = details;
  }
}

/**
 * 不変条件を検査し、失敗時は安定したerror codeを返す。
 */
export function invariant(condition, code, details = undefined) {
  if (!condition) {
    throw new DomainError(code, details);
  }
}

export function requireIdentifier(value, code = "IDENTIFIER_INVALID") {
  invariant(
    typeof value === "string" && /^[a-z0-9][a-z0-9_-]*$/.test(value),
    code,
    { value }
  );
  return value;
}

export function requireNonEmptyString(value, code = "STRING_INVALID") {
  invariant(typeof value === "string" && value.length > 0, code, { value });
  return value;
}

export function requireIntegerInRange(value, minimum, maximum, code) {
  invariant(
    Number.isInteger(value) && value >= minimum && value <= maximum,
    code,
    { value, minimum, maximum }
  );
  return value;
}

export function requireEnumValue(value, enumObject, code) {
  invariant(Object.values(enumObject).includes(value), code, { value });
  return value;
}

export function copyFrozenArray(values) {
  invariant(Array.isArray(values), "ARRAY_REQUIRED");
  return Object.freeze([...values]);
}
