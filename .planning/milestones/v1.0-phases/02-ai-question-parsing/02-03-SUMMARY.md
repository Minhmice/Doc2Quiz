---
phase: 02-ai-question-parsing
plan: 03
requirements-completed: [AI-03, AI-04]
completed: 2026-04-05
---

# Phase 02 plan 03: AI parse core

Browser-only `fetch` to OpenAI Chat Completions and Anthropic Messages: chunk parsing, JSON validation into `Question[]`, sequential runner with one retry per chunk (no retry on 401/429), `AbortSignal` for cancel while preserving accumulated questions.

## Files

- `src/lib/ai/errors.ts` — `FatalParseError`, `isFatalParseError`, `isAbortError`
- `src/lib/ai/validateQuestions.ts` — `validateQuestionsFromJson`
- `src/lib/ai/parseChunk.ts` — `parseChunkOnce` (gpt-4o-mini, claude-3-5-haiku-20241022)
- `src/lib/ai/runSequentialParse.ts` — `runSequentialParse`, `ParseProgress`

## Verification

- `npm run build` — passed

## Self-Check: PASSED
