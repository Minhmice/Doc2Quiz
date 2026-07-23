# Testing Patterns

**Analysis Date:** 2026-07-24

## Test Framework

**Runner:**
- **Not detected** — `package.json` has no Jest, Vitest, or Playwright dependency and no `test` script.
- Config: **N/A** (no `vitest.config.*`, `jest.config.*`, or `playwright.config.*` in the repo root).

**Assertion Library:**
- **Not applicable** for unit tests. Ad-hoc verification scripts use `throw new Error(...)` and `process.exit(1)` (see below).

**Run Commands:**
```bash
npm run lint                    # ESLint (flat config + eslint-config-next)
npm run build                   # Next.js production build (includes TS checking via Next)
npm run verify:import-validate  # Pure validation smoke (tsx)
npm run verify:redirects        # Route guard smoke (tsx)
node scripts/eval-export-smoke.mjs <export.jsonl>  # JSONL export shape check
```

There is **no** `npm test`, `npm run test:watch`, or coverage command.

## Test File Organization

**Location:**
- **No `*.test.ts`, `*.test.tsx`, `*.spec.ts`, or `__tests__/` directories** under `src/` today.
- Verification logic lives in **`scripts/`** at the repo root, importing production modules via relative paths (e.g. `../src/lib/...`).

**Naming:**
- Verification scripts: `verify-*.ts` or descriptive `*-smoke.mjs`.
- Future unit tests (if added): planning docs reference `src/lib/ai/__tests__/parseCapabilities.test.ts` as a possible Vitest location — **not implemented yet**.

**Structure:**
```
Doc2Quiz/
├── scripts/
│   ├── verify-import-validate.ts      # Throws on validation failure
│   ├── verify-study-set-redirects.ts
│   └── eval-export-smoke.mjs
├── src/
│   └── lib/                           # Pure functions tested indirectly via scripts
└── package.json                       # lint + build + verify:* only
```

## Test Structure

**Suite Organization:**

The repo uses **imperative smoke scripts**, not describe/it blocks:

```typescript
// scripts/verify-study-set-redirects.ts
function ok(
  surface: Parameters<typeof mismatchHrefForSurface>[1],
  contentKind: StudyContentKind | undefined,
  expected: string | null,
) {
  const got = mismatchHrefForSurface(id, surface, contentKind);
  if (got !== expected) {
    throw new Error(
      `mismatchHrefForSurface(...) → ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

ok("play-quiz", "quiz", null);
ok("play-quiz", "flashcards", `/flashcards/${id}`);

console.log("verify-study-set-redirects: ok");
```

```typescript
// scripts/verify-import-validate.ts
if (validateStrictQuizQuestions(goodQ).ok !== true) {
  throw new Error("expected good quiz ok");
}
if (validateStrictQuizQuestions(badQ).ok !== false) {
  throw new Error("expected bad options fail");
}
console.log("verify-import-validate: ok");
```

**Patterns:**
- **Setup:** Inline fixture data at top of script (typed arrays/objects).
- **Assertion:** `if (condition) throw new Error("...")` with descriptive message.
- **Teardown:** None — scripts exit on first failure.
- **Success signal:** `console.log("...: ok")` or `process.exit(0)` in `.mjs` scripts.

## Mocking

**Framework:** **Not used** — no test runner mocks in the repo.

**Patterns:**
- Verification scripts call **real pure functions** with no I/O — e.g. `validateStrictQuizQuestions` from `src/lib/server/generateFromFile/validateStrictGenerated.ts`, `mismatchHrefForSurface` from `src/lib/routing/studySetContentKindRedirects.ts`.
- No `vi.mock`, `jest.mock`, or MSW setup exists.

**What to Mock (when adding a runner):**
- Supabase clients (`src/lib/supabase/server.ts`, `browser.ts`) in API route tests.
- `fetch` for upstream AI proxies (`src/app/api/ai/embed/route.ts`, `forward/route.ts`).
- IndexedDB (`src/lib/db/studySetDb.ts`) in component integration tests.
- PDF.js and worker assets under `src/lib/pdf/`.

**What NOT to Mock:**
- Pure validators and routing helpers already covered by `scripts/verify-*.ts`.
- Zod schema parsing for stable schemas in `src/lib/validations/` and `src/lib/server/generateFromFile/schemas.ts`.

## Fixtures and Factories

**Test Data:**

Scripts embed minimal typed fixtures inline:

```typescript
// scripts/verify-import-validate.ts
const goodQ: Question[] = [
  {
    id: "1",
    question: "What is 2+2?",
    options: ["1", "2", "3", "4"],
    correctIndex: 3,
    parseConfidence: 0.9,
    sourceUnitIds: ["unit-a"],
  },
];
```

```javascript
// scripts/eval-export-smoke.mjs — expects each JSONL line:
// { studySetId, question }
```

**Location:**
- Fixtures live **inside** `scripts/` files today.
- No shared `tests/fixtures/` or `__fixtures__/` directory.

**Recommendation when adding Vitest:** Co-locate fixtures next to tests or add `src/lib/**/__tests__/fixtures.ts` for pure-function modules under `src/lib/ai/` and `src/lib/pdf/`.

## Coverage

**Requirements:** **None enforced** — no coverage threshold or CI gate.

**View Coverage:**
```bash
# Not available until a test runner is added
```

## Test Types

**Unit Tests:**
- **Not present** in `src/`. Closest equivalent: `npm run verify:import-validate` and `npm run verify:redirects` exercise pure functions without a runner.
- High-value candidates for future unit tests: `src/lib/ai/layoutChunksFromOcr.ts`, `src/lib/routing/studySetContentKindRedirects.ts`, `src/lib/server/generateFromFile/validateStrictGenerated.ts`, `src/lib/ai/parseCapabilities.ts`.

**Integration Tests:**
- **Not present.** API routes under `src/app/api/` are validated manually and via production `npm run build` type-checking only.

**E2E Tests:**
- **Not used** in `package.json`. Historical Playwright captures exist under `.planning/ui-reviews/` (manual/ad-hoc, not wired to CI).
- Manual browser smoke is the current E2E strategy (see below).

## CI/CD Verification

**CI Pipeline:** **Not detected** — no `.github/workflows/` or other CI config in the repo.

**Pre-merge checklist (de facto):**
```bash
npm run lint
npm run build
npm run verify:redirects
npm run verify:import-validate
```

Then manual browser smoke on affected flows.

## Manual / Browser Smoke

Feature correctness and UX are validated by **human smoke** after lint and build succeed. Do not claim "tests pass" from lint/build alone for user-facing behavior.

### Anti-pattern: brittle DOM selectors

**Do not** target:
- Auto-generated ids such as `id="base-ui-_r_*"` (React/useId values that change between renders).
- Long positional CSS/DOM paths tied to internal component structure.

**Prefer:**
- Visible text mapped to accessibility (`getByRole`, accessible name).
- Explicit stable **`data-testid`** attributes the team owns.

### Stable automation hook (existing)

**File:** `src/components/layout/ApiStatusIndicator.tsx`

```typescript
// Primary
page.getByTestId("doc2quiz-api-status-trigger");

// Fallback — role + visible label
page.getByRole("button", { name: /API OK|API Down|Checking/ });
```

Only one `data-testid` exists in `src/` today (`doc2quiz-api-status-trigger`). Add new `data-testid` values when automating additional controls; do not scrape Base UI internal ids.

### Recommended manual smoke order

1. **Dashboard** — `/` redirects to `/dashboard`; library loads, navigation works.
2. **Create study set** — `/edit/new` → quiz or flashcards import path; complete PDF import until a set exists.
3. **Source** — `/sets/{id}/source` — document attachment and viewer.
4. **Parse (optional)** — `/sets/{id}/parse` when AI parsing is enabled for the set.
5. **Review** — `/edit/quiz/{id}` or `/edit/flashcards/{id}` — list, edit, approve.
6. **Practice** — `/quiz/{id}` or `/flashcards/{id}`; quiz keyboard shortcuts **1–4** for choices A–D in `src/components/quiz/QuizSession.tsx`.
7. **Done / summary** — `/quiz/{id}/done`, `/flashcards/{id}/done`.

Legacy routes (`/sets/new`, `/sets/{id}/play`, etc.) redirect via `next.config.ts` — smoke both old bookmarks and canonical `/edit/*` and `/quiz/*` paths when touching routing.

### Dev-only surfaces

- `/dev/ocr` — gated in `src/app/(app)/dev/ocr/layout.tsx` (production restrictions).
- Dev engine panel API — `src/app/api/ai/dev-engine-panel/route.ts` returns 404 in production unless explicitly enabled.

## Common Patterns

**Async Testing:**
- Not applicable in automated tests. In scripts, no async — all targeted functions are synchronous.
- For future Vitest async tests, follow Node's native `async` test functions once a runner is added.

**Error Testing:**
- Current pattern: assert failure path returns `{ ok: false }` or throws:

```typescript
if (validateStrictQuizQuestions(badQ).ok !== false) {
  throw new Error("expected bad options fail");
}
```

**CLI smoke exit codes (`scripts/eval-export-smoke.mjs`):**
- Missing file arg → `process.exit(2)`
- Invalid JSON or shape → `process.exit(1)`
- Success → `process.exit(0)`

## Adding Tests (prescriptive guidance)

When introducing automated tests to this repo:

1. **Prefer Vitest** — aligns with ESM, `tsx`, and Next 16; planning milestones already reference it.
2. Add `"test": "vitest"` and `"test:watch": "vitest"` to `package.json`.
3. Place pure `src/lib/**` tests co-located: `src/lib/ai/foo.test.ts` or `src/lib/ai/__tests__/foo.test.ts`.
4. Keep **`scripts/verify-*.ts`** as fast smoke entry points or migrate their cases into Vitest and call `vitest run` from CI.
5. For E2E, add `@playwright/test` explicitly to `devDependencies` and commit `playwright.config.ts` — do not assume Playwright is installed (it is only a transitive optional peer of Next today).
6. Extend `data-testid` on critical flows before writing browser automation.

---

*Testing analysis: 2026-07-24*
