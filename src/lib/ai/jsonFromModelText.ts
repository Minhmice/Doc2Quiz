/**
 * Extract JSON from model assistant text (fences, embedded object).
 * Shared by chunk parse, vision parsers, and validator pass (Phase 32).
 */

export function parseJsonFromModelText(text: string): unknown {
  const trimmed = text.trim();
  const fenceStripped = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  try {
    return JSON.parse(fenceStripped);
  } catch {
    const start = fenceStripped.indexOf("{");
    if (start === -1) {
      throw new Error("No JSON object in model output");
    }
    let depth = 0;
    for (let i = start; i < fenceStripped.length; i++) {
      const c = fenceStripped[i];
      if (c === "{") {
        depth++;
      } else if (c === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(fenceStripped.slice(start, i + 1));
        }
      }
    }
    throw new Error("Unbalanced JSON object in model output");
  }
}
