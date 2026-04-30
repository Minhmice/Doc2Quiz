/**
 * Shared intermediate representation for quiz + flashcard generation from the same PDF.
 * Stored server-side only; never expose raw model payloads to public UI.
 */

export type CanonicalDifficulty = "easy" | "medium" | "hard";

export type CanonicalSourceUnit = {
  id: string;
  pageRefs: number[];
  sourceText: string;
  concept: string;
  facts: string[];
  formulas?: string[];
  terms?: string[];
  difficulty: CanonicalDifficulty;
  confidence: number;
};

/** Persisted with draft generation for QA / dev diagnostics (not shown in learner UI). */
export type GenerationCoverageReport = {
  totalUnits: number;
  usedUnits: number;
  coverageRatio: number;
  unusedUnitIds: string[];
  lowConfidenceCount: number;
  /** How many quiz/flashcard rows were written in the last generation pass. */
  itemsGenerated?: number;
};
