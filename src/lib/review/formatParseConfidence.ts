/** Human-readable line for model parse confidence (0..1). */
export function formatParseConfidence(
  value: number | undefined,
): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  const label = pct >= 80 ? "High" : pct >= 50 ? "Medium" : "Low";
  return `AI confidence: ${label} (${pct}%)`;
}
