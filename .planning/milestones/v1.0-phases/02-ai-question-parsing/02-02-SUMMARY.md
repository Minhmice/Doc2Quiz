# Phase 02-02 Summary: Chunk text for AI parsing

## Self-Check: PASSED

## Delivered

- Added `src/lib/ai/chunkText.ts` with exported `CHUNK_SOFT_TARGET` (1000), `CHUNK_HARD_MAX` (1200), `CHUNK_SOFT_MIN` (800), and `chunkText(fullText: string): string[]`.
- Algorithm: trim input (empty → `[]`); split on `\n\n` into trimmed non-empty paragraphs; greedily merge paragraphs up to `CHUNK_HARD_MAX`; oversized paragraphs are split into segments ≤ `CHUNK_HARD_MAX`, preferring whitespace breaks when the break index is ≥ `CHUNK_SOFT_MIN` (D-09). File header notes sequential-only consumption (D-10). Input string is never mutated.

## Verification

- `npx tsc --noEmit` — pass
- `npm run build` — pass
- Spot check: `chunkText('a' + '\n\n' + 'b'.repeat(2000))` yields multiple chunks; each chunk length ≤ 1200.

## Files touched

- `src/lib/ai/chunkText.ts` (new)
- `.planning/phases/02-ai-question-parsing/02-02-SUMMARY.md` (this file)
