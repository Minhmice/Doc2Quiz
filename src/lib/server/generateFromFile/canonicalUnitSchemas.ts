import { z } from "zod";

import type { CanonicalSourceUnit } from "@/types/canonicalSource";

const difficultySchema = z.enum(["easy", "medium", "hard"]);

export const canonicalSourceUnitRawSchema = z.object({
  id: z.string().optional(),
  pageRefs: z.array(z.number().int().positive()),
  sourceText: z.string().min(1),
  concept: z.string().min(1),
  facts: z.array(z.string().min(1)).min(1),
  formulas: z.array(z.string()).optional(),
  terms: z.array(z.string()).optional(),
  difficulty: difficultySchema,
  confidence: z.number().min(0).max(1),
});

export const canonicalExtractionPayloadSchema = z.object({
  units: z.array(canonicalSourceUnitRawSchema).min(1).max(200),
});

export function sortAndAssignCanonicalIds(
  contentSha256: string,
  raw: z.infer<typeof canonicalExtractionPayloadSchema>["units"],
): CanonicalSourceUnit[] {
  const sorted = [...raw].sort((a, b) => {
    const ap = a.pageRefs[0] ?? 1;
    const bp = b.pageRefs[0] ?? 1;
    if (ap !== bp) {
      return ap - bp;
    }
    return a.concept.localeCompare(b.concept, undefined, { sensitivity: "base" });
  });
  const prefix = contentSha256.slice(0, 16);
  return sorted.map((u, i) => ({
    id: `csu_${prefix}_${String(i).padStart(3, "0")}`,
    pageRefs: u.pageRefs,
    sourceText: u.sourceText.trim(),
    concept: u.concept.trim(),
    facts: u.facts.map((f) => f.trim()).filter(Boolean),
    formulas: u.formulas?.map((f) => f.trim()).filter(Boolean),
    terms: u.terms?.map((t) => t.trim()).filter(Boolean),
    difficulty: u.difficulty,
    confidence: u.confidence,
  }));
}
