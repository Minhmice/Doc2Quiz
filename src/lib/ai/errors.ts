/**
 * User-facing parse errors that must abort the whole job (e.g. 401/429).
 * Do not log API keys when handling these.
 */

export class FatalParseError extends Error {
  readonly name = "FatalParseError";

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function isFatalParseError(e: unknown): e is FatalParseError {
  return e instanceof FatalParseError;
}

export function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") {
    return true;
  }
  if (e instanceof Error && e.name === "AbortError") {
    return true;
  }
  return false;
}
