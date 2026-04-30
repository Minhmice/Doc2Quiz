/** Bump when CanonicalSourceUnit schema or extraction prompt contract changes. */
export const EXTRACTION_SCHEMA_VERSION = 1;

/** Bump when quiz/flashcard JSON schema from canonical units changes. */
export const GENERATION_SCHEMA_VERSION = 1;

/** Max units returned from extraction (prompt + validation). */
export const MAX_CANONICAL_UNITS = 96;

/** Default cap for generation item count (matches runGenerateItemsFromCanonicalUnits). */
export const DEFAULT_GENERATION_TARGET_ITEMS = 48;

/** Truncate very long extracted text before LLM extraction (chars). */
export const EXTRACTION_TEXT_BUDGET_CHARS = 120_000;
