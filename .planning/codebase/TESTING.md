# Testing — Doc2Quiz

> Last updated: 2026-07-26

## Test Framework

| Tool | Version | Config File | Purpose |
|---|---|---|---|
| **Vitest** | v3 (latest) | `vitest.config.ts` (root) | Unit & integration tests |
| **Playwright** | v1.52 | `playwright.config.ts` | E2E browser tests |
| **ESLint** | v9 | `eslint.config.mjs` | Static analysis / type-aware lint |

### Vitest Configuration (`vitest.config.ts`)

- Environment: `node` (not jsdom — no DOM-dependent component tests yet).
- Path alias: `@` → `./src` (mirrors `tsconfig.json`).
- No `@testing-library/react` or jsdom setup — React component tests are a known gap.

### Running Tests

```bash
npm test          # Run all tests (vitest)
npm run lint      # ESLint v9
npm run typecheck # tsc --noEmit
```

## Test Files

30 `.test.ts` files across 6 directories under `src/lib/`.

### AI (`src/lib/ai/`)

| File | What It Tests |
|---|---|
| `ping.test.ts` | AI agent health check / ping endpoint — `pingAiAgent()`, `isAiAgentHealthy()`, `formatAiAgentPingMessage()` |
| `ai-agent-ping.test.ts` | Server-side AI agent ping route handler |

### Client (`src/lib/client/`)

| File | What It Tests |
|---|---|
| `activityTracking.test.ts` | `recordQuizCompletion()`, `getLatestQuizSession()`, `getMistakeQuestionIds()`, `hasMistakesForStudySet()` — Supabase client calls mocked |
| `appDataCache.test.ts` | IndexedDB-based app data caching operations |
| `flashcardGenerateStudySet.test.ts` | `postFlashcardGenerate()` — API caller for flashcard generation endpoint, fetch mocked |
| `quizGenerateStudySet.test.ts` | `postQuizGenerate()` — API caller for quiz generation endpoint, fetch mocked |
| `studySetDb.test.ts` | IndexedDB study set CRUD operations |

### Locale (`src/lib/locale/`)

| File | What It Tests |
|---|---|
| `messages.test.ts` | English/Vietnamese message catalog key parity, domain coverage, typed dynamic copy functions |
| `coverage.test.ts` | Phase-wide locale coverage — all domains complete in both locales, safe slang slot uniqueness, banned content checks |
| `localeStorage.test.ts` | Locale preference read/write to localStorage |
| `selectSlang.test.ts` | Slang selection logic (context-aware random pick) |
| `slang.test.ts` | Slang catalog integrity — all contexts populated, no duplicates |

### Pipeline (`src/lib/pipeline/`) — 17 files

The most extensively tested area.

| File | What It Tests |
|---|---|
| `canonicalize.test.ts` | `runCanonicalize()` — AI canonical document extraction, mock OpenAI + Supabase |
| `canonicalPrompt.test.ts` | Canonical prompt building — message construction, prompt structure |
| `canonicalSchemas.test.ts` | Zod schema validation for canonical output |
| `dedupeAndCapFlashcards.test.ts` | `dedupeAndCapFlashcards()`, `resolveDominantFormat()` — flashcard dedup and count capping |
| `dedupeAndCapQuestions.test.ts` | `dedupeAndCapQuestions()` — quiz question dedup and count capping |
| `faithfulness.test.ts` | `checkCanonical()`, `checkQuiz()`, `checkFlashcard()` — faithfulness / hallucination detection |
| `flashcardGenerate.test.ts` | `runFlashcardGenerate()` — end-to-end flashcard generation, mock OpenAI |
| `flashcardPrompt.test.ts` | Flashcard prompt building — message construction, prompt versioning |
| `flashcardSchemas.test.ts` | Zod schema validation for flashcard generator output |
| `ingest.test.ts` | `runIngest()` — document ingestion pipeline step |
| `mapFlashcardOutputToRows.test.ts` | Mapper: LLM flashcard output → database rows |
| `mapQuizOutputToRows.test.ts` | Mapper: LLM quiz output → database rows |
| `markitdown.test.ts` | MarkItDown conversion — PDF/document to markdown |
| `quizGenerate.test.ts` | `runQuizGenerate()` — end-to-end quiz generation, mock OpenAI |
| `quizPrompt.test.ts` | Quiz prompt building — message construction, prompt versioning |
| `quizSchemas.test.ts` | Zod schema validation for quiz generator output |
| `validation.test.ts` | Input validation — file upload limits, MIME types, paste input, YouTube URL |

### Server (`src/lib/server/`)

| File | What It Tests |
|---|---|
| `ai-agent-ping.test.ts` | Server-side API route for AI agent health ping |

### Supabase (`src/lib/supabase/`)

| File | What It Tests |
|---|---|
| `env.test.ts` | `normalizeSupabaseUrl()` — URL normalization (https prepend, localhost http, trailing slash trim, whitespace) |

## Testing Patterns

### Unit Tests for Pure Functions

The simplest pattern — no mocking needed:

```typescript
// src/lib/supabase/env.test.ts
import { describe, expect, it } from "vitest";
import { normalizeSupabaseUrl } from "./env";

describe("normalizeSupabaseUrl", () => {
  it("prepends https:// to host-only URLs", () => {
    expect(normalizeSupabaseUrl("abcd.supabase.co")).toBe("https://abcd.supabase.co");
  });
});
```

### Mocking External Dependencies

AI pipeline tests use `vi.mock()` at module scope to replace OpenAI/Supabase/fetch calls:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCanonicalize } from "@/lib/pipeline/canonicalize";

const postChatCompletionAssistantTextMock = vi.fn();
vi.mock("@/lib/server/openAiChatCompletion", () => ({
  postChatCompletionAssistantText: (...args: unknown[]) =>
    postChatCompletionAssistantTextMock(...args),
}));
```

Client API callers mock `fetch` with `vi.stubGlobal`:

```typescript
vi.stubGlobal(
  "fetch",
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, ... }),
  }),
);
```

Supabase client tests mock the query chain with a builder pattern:

```typescript
function createQueryChain(result: MockResult) {
  const chain = {};
  for (const method of ["select", "eq", "order", "limit", "insert"]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.maybeSingle = vi.fn().mockResolvedValue(result);
  return chain;
}
```

### Describe/It Organization

- `describe` groups by function or logical concern.
- Nested `describe` for sub-behaviors (e.g. `describe("checkCanonical")` with inner tests for valid input, invented title, bad filename, non-sequential IDs, orphan questions).
- Factory functions (`makeCard()`, `makeOutput()`, `baseInput()`) for DRY test data.

## Coverage Areas

| Area | Test Files | Depth |
|---|---|---|
| **AI Pipeline** | 17 files | Canonicalization → ingestion → flashcard gen → quiz gen → prompt building → schema validation → dedup → faithfulness → output mapping |
| **Client / DB** | 5 files | IndexedDB (study sets, app cache), API callers (flashcard/quiz generate), activity tracking |
| **Locale / i18n** | 5 files | English/Vietnamese parity, slang catalog integrity, storage persistence |
| **AI Health** | 2 files | Ping endpoint, server-side route handler |
| **Supabase Env** | 1 file | URL normalization utility |

## What's NOT Tested (Known Gaps)

### Component-Level Tests (Missing)

No React Testing Library or vitest-browser-react tests exist. Components are not unit-tested in isolation. This includes:

- All dashboard components (`DashboardHomeClient`, `DashboardStudySetCard`, `DashboardLibraryClient`, etc.)
- Upload UI (`UploadBox`, `UnifiedInputZone`)
- Quiz/flashcard practice interfaces
- Layout components (`AppTopBar`, `PageTransition`)
- UI primitives (`button`, `dialog`, `dropdown-menu`, `select`, etc.)

### E2E Tests (Missing)

- Playwright config exists but no test files found.
- No full-flow tests for: upload PDF → process → review quiz → practice.
- No cross-browser or mobile viewport testing.

### Integration Tests (Missing)

- No tests for the full upload→pipeline→review→practice flow end-to-end.
- No tests for route handlers (API routes) beyond the AI ping endpoint.
- No Supabase integration tests (all Supabase interactions are unit-mocked).

## Recommendations for Future Test Coverage

1. **Add vitest-browser-react or @testing-library/react** for component unit tests — start with critical paths (upload flow, quiz answer submission, flashcard flip).
2. **Write Playwright E2E tests** for the core user journey: upload PDF → wait for processing → review quiz → answer questions → see score.
3. **Add API route integration tests** using `vi.mock` for the database layer — verify request validation, error responses, and success paths for key endpoints (`/api/study-sets/*`).
4. **Add accessibility smoke tests** with `@axe-core/playwright` in E2E suite.
