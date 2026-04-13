# STRUCTURE — Doc2Quiz (`src/`)

**Analysis date:** 2026-04-13  
**Focus:** Architecture (`arch`)

## 1) Current Layout

```txt
src/
├─ app/
│  ├─ layout.tsx
│  ├─ page.tsx
│  ├─ globals.css
│  ├─ (app)/
│  │  ├─ layout.tsx
│  │  ├─ template.tsx
│  │  ├─ dashboard/page.tsx
│  │  ├─ settings/page.tsx
│  │  ├─ develop/page.tsx
│  │  ├─ dev/ocr/
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx
│  │  │  └─ [id]/page.tsx
│  │  ├─ new/
│  │  │  ├─ page.tsx
│  │  │  ├─ quiz/page.tsx
│  │  │  └─ flashcards/page.tsx
│  │  ├─ sets/
│  │  │  ├─ new/
│  │  │  │  ├─ page.tsx
│  │  │  │  ├─ NewStudySetPdfImportFlow.tsx
│  │  │  │  ├─ quiz/page.tsx
│  │  │  │  └─ flashcards/page.tsx
│  │  │  └─ [id]/
│  │  │     ├─ layout.tsx
│  │  │     ├─ source/page.tsx
│  │  │     ├─ parse/page.tsx
│  │  │     └─ practice/page.tsx
│  │  ├─ quiz/
│  │  │  └─ [id]/
│  │  │     ├─ layout.tsx
│  │  │     ├─ page.tsx
│  │  │     └─ done/page.tsx
│  │  ├─ flashcards/
│  │  │  └─ [id]/
│  │  │     ├─ layout.tsx
│  │  │     ├─ page.tsx
│  │  │     └─ done/page.tsx
│  │  └─ edit/
│  │     ├─ quiz/[id]/(layout.tsx,page.tsx)
│  │     └─ flashcards/[id]/(layout.tsx,page.tsx)
│  └─ api/
│     ├─ ai/
│     │  ├─ forward/route.ts
│     │  ├─ vision-test-image/route.ts
│     │  └─ vision-staging/
│     │     ├─ route.ts
│     │     └─ [id]/route.ts
│     ├─ parse-jobs/(route.ts,[id]/route.ts)
│     └─ develop/mock/[slug]/route.ts
│
├─ components/
│  ├─ ai/
│  ├─ animate-ui/
│  ├─ dashboard/
│  ├─ develop/
│  ├─ flashcards/
│  ├─ layout/
│  ├─ math/
│  ├─ media/
│  ├─ play/
│  ├─ profile/
│  ├─ providers/
│  ├─ review/
│  ├─ sets/
│  │  └─ new/
│  │     ├─ format-selection/
│  │     ├─ import/
│  │     ├─ quiz/
│  │     └─ flashcards/
│  ├─ settings/
│  ├─ ui/
│  ├─ upload/
│  └─ viewer/
│
├─ lib/
│  ├─ ai/
│  │  └─ prompts/
│  ├─ dashboard/
│  ├─ db/
│  ├─ develop/
│  ├─ ids/
│  ├─ learning/
│  ├─ logging/
│  ├─ math/
│  ├─ observability/
│  ├─ pdf/
│  ├─ profile/
│  ├─ review/
│  ├─ routes/
│  ├─ serverParse/
│  ├─ studySet/
│  ├─ validations/
│  ├─ appEvents.ts
│  └─ utils.ts
│
├─ hooks/
│  ├─ useDashboardHome.ts
│  └─ use-is-in-view.tsx
│
└─ types/
   ├─ flashcardSession.ts
   ├─ ocr.ts
   ├─ parseJob.ts
   ├─ parseScore.ts
   ├─ question.ts
   ├─ studySet.ts
   └─ visionParse.ts
```

### Quick check vs requested component buckets

- Present: `dashboard`, `layout`, `review`, `sets`, `ui`, `upload`, `viewer`.
- Equivalent-but-different naming: `practice` appears as `play/`; `quiz` is mostly route-driven under `app/(app)/quiz/*` + `components/review/*`.
- Not a top-level component bucket today: `source/` (source flow is routed in `app/(app)/sets/[id]/source/page.tsx` and backed by `components/ai/*`).

### Quick check vs requested `lib/` buckets

- Present: `ai`, `db`, `pdf`.
- Equivalent naming today: `studySet/` (acts like `sets/` domain), `review/` + `learning/` + `routes/` hold quiz/set behavior.
- Not present as named buckets: `quiz/`, `sets/`, `source/`, `storage/` (storage concerns are split across `db/`, `studySet/`, `ai/storage.ts`, `ai/ocrStorage.ts`).

---

## 2) Analysis

### A. Colocation vs separation

- **Current style is mostly centralized by concern** (`src/components/*`, `src/lib/*`) rather than route-local.
- App Router pages under `src/app/(app)` import from centralized feature folders.
- Pros:
  - Easy cross-route reuse.
  - Predictable top-level feature folders.
- Cons:
  - Route ownership is less explicit (page + UI + domain logic spread across `app/`, `components/`, `lib/`).
  - Flows like `sets/[id]/source` rely on `components/ai/*`, which is semantically broad and not obviously route-bounded.

### B. Naming consistency

- Mixed naming exists:
  - `studySet/` (singular in folder name, plural in route path `sets`).
  - `play/` (UI feature) vs route path `practice`.
  - `review` exists in both route concepts and reusable component domain.
- `source` exists as route segment, while implementation is grouped under `ai` (not `source`).
- Overall: understandable, but not fully normalized around one taxonomy.

### C. UI component split

- `components/ui/*` is correctly used for primitives and reusable controls (shadcn-like base + custom primitives).
- Feature UI is mostly outside `ui/` (good), inside domain folders (`dashboard`, `sets/new/*`, `review`, `ai`).
- Some route-heavy flows (especially set-creation/import and quiz runtime) would benefit from `_components/` colocation to reduce global component surface area.

### D. Lib organization and feature mirroring

- Partial mirroring exists:
  - `components/dashboard` ↔ `lib/dashboard` (good).
  - `components/profile` ↔ `lib/profile` (good).
- But quiz/set/source flows are spread:
  - UI: `components/play`, `components/review`, `components/sets/new`, `components/ai`.
  - Logic: `lib/studySet`, `lib/review`, `lib/ai`, `lib/routes`.
- No single `lib/quiz` or `lib/sets` verticals; this increases cognitive load for feature work.

### E. Type definitions strategy

- `src/types` is centralized and clean for cross-cutting models (`studySet`, `question`, `parseJob`, etc.).
- Good for shared contracts and DB model consistency.
- Missing complement: route/feature-local view-model types are often implicit in components rather than colocated with feature modules.

---

## 3) Proposed Restructure

> Goal: improve route ownership clarity while preserving reuse and current `@/` alias style.

### A. Route colocation (App Router private folders)

For route-specific, non-reusable components, colocate to `app/.../_components/`:

- `app/(app)/quiz/[id]/_components/*`
- `app/(app)/flashcards/[id]/_components/*`
- `app/(app)/sets/new/_components/*`
- `app/(app)/sets/[id]/source/_components/*`

Keep truly reusable features in `src/components/*` and primitives in `src/components/ui/*`.

### B. Naming normalization

Pick one consistent feature taxonomy. Recommended:

- **Plural for route/domain buckets**: `sets`, `quizzes`, `sources` (or keep route `quiz` if product language prefers singular, but make internal folder naming consistent).
- Align runtime naming: either rename `play` → `practice` or rename route segment to `play`; avoid split vocabulary.

Pragmatic recommendation (minimal URL churn):

- Keep URLs as-is for product stability.
- Normalize internal folder names:
  - `components/play` → `components/practice`
  - `lib/studySet` → `lib/sets`
  - optional: `lib/routes/studySetPaths.ts` → `lib/routes/setPaths.ts`

### C. Lib/component alignment

Create mirrored verticals for major features:

- `components/sets` ↔ `lib/sets`
- `components/quiz`/`components/practice` ↔ `lib/quiz`
- `components/source` (or route-local source components) ↔ `lib/source`/`lib/sources`

If `ai` remains cross-cutting infra, keep `lib/ai/*` as platform layer and expose feature-level orchestration modules:

- `lib/quiz/parseQuizFromSource.ts`
- `lib/sets/importSetFromPdf.ts`

### D. Type strategy

Recommended hybrid strategy:

1. Keep canonical domain models centralized in `src/types/*` (current strong point).
2. Add feature-local types next to feature modules for view/model adapters:
   - `app/(app)/quiz/[id]/_components/quiz.types.ts`
   - `components/sets/new/import/import.types.ts`
3. Optionally add `src/types/index.ts` barrel for stable imports.

### E. Hooks extraction and placement

Current hooks are minimal and centralized (`src/hooks`).

- Keep cross-feature hooks in `src/hooks`.
- Move route-specific hooks to route-local `_hooks` or `_components` folder:
  - `app/(app)/dashboard/_hooks/useDashboardHome.ts` if only dashboard uses it.
- Keep naming convention consistent: `useXxx.ts` (avoid mixed kebab + camel where possible).

---

## 4) Rename Map (analysis only, no execution)

| FROM | TO |
|---|---|
| `src/components/play/` | `src/components/practice/` |
| `src/lib/studySet/` | `src/lib/sets/` |
| `src/components/sets/new/*` (route-bound pieces) | `src/app/(app)/sets/new/_components/*` |
| `src/components/ai/*` used only by set source route | `src/app/(app)/sets/[id]/source/_components/*` |
| `src/components/review/*` used only by quiz runtime | `src/app/(app)/quiz/[id]/_components/*` |
| `src/components/flashcards/review/*` used only by flashcard route | `src/app/(app)/flashcards/[id]/_components/*` |
| `src/lib/routes/studySetPaths.ts` | `src/lib/routes/setPaths.ts` (optional normalization) |
| `src/hooks/useDashboardHome.ts` | `src/app/(app)/dashboard/_hooks/useDashboardHome.ts` (if non-reusable) |

> Note: `src/lib/source/ → src/lib/sources/` is **not applied** because `lib/source` does not currently exist; if introduced later, choose one normalized convention at creation.

---

## 5) Migration Steps (safe refactor checklist)

1. **Freeze target taxonomy first**
   - Confirm naming decisions (`play` vs `practice`, `studySet` vs `sets`, singular/plural standard).

2. **Create destination folders with App Router convention**
   - Add `_components/` (and optional `_hooks/`) under target route segments.

3. **Move files with git-aware renames**
   - Use `git mv` in small batches by feature (dashboard, sets-new, quiz runtime, flashcards runtime).

4. **Update imports incrementally**
   - Keep `@/` alias style.
   - Prefer feature-local relative imports inside each colocated route folder to reduce long alias chains.

5. **Stabilize public/shared boundaries**
   - Keep reusable primitives in `src/components/ui` unchanged.
   - Keep cross-feature infra in `src/lib/ai` unless clearly route/domain-specific.

6. **Normalize naming and paths**
   - Rename folders/modules agreed in Step 1.
   - Update `studySetPaths` references if renamed.

7. **Type pass**
   - Keep domain contracts in `src/types`.
   - Introduce local `*.types.ts` only where route complexity justifies it.

8. **Verification pass after each batch**
   - `npm run lint`
   - `npm run build`
   - Smoke-test key routes: dashboard, sets/new, sets/[id]/source, quiz/[id], flashcards/[id], settings.

9. **Cleanup and guardrails**
   - Remove dead exports and stale barrels.
   - Ensure no broken `@/` alias paths remain.

---

## Tóm tắt cấu trúc đề xuất

Cấu trúc hiện tại của Doc2Quiz khá rõ ràng theo kiểu tách lớp (`app`, `components`, `lib`, `types`), nhưng còn hơi phân tán theo luồng tính năng (đặc biệt là quiz/sets/source). Đề xuất chính là **colocate component theo route** bằng `_components/` cho các phần chỉ dùng nội bộ route, giữ `components/ui` làm primitive chung, và chuẩn hóa tên miền tính năng (ưu tiên nhất quán giữa `play/practice`, `studySet/sets`).

Về `lib`, nên tiến tới mô hình mirror với `components` theo feature để giảm chi phí tìm kiếm code. Về `types`, nên giữ `src/types` cho model domain dùng chung và bổ sung `*.types.ts` cục bộ cho các route phức tạp. Cách làm này giữ nguyên conventions của Next.js App Router, không phá alias `@/`, và phù hợp định hướng hiện có trong `CLAUDE.md` / `AGENTS.md`.