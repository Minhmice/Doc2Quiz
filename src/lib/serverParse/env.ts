/**
 * Server-side parse-queue feature flag.
 * Use only from Route Handlers / server modules — do not import from client components.
 * No NEXT_PUBLIC_ variant in 15-01: toggling this must remain a server operator decision.
 */

const TRUEISH = new Set(["1", "true"]);

export function isServerParseQueueEnabled(): boolean {
  const raw = process.env.D2Q_SERVER_PARSE_ENABLED?.trim() ?? "";
  if (!raw) {
    return false;
  }
  return TRUEISH.has(raw.toLowerCase());
}
