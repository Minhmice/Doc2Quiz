# Phase 6: Pipeline Hardening & Observability — Context

**Gathered:** 2026-04-08  
**Status:** Ready for planning / incremental implementation (much of scope already landed in codebase)

<domain>
## Phase Boundary

Stabilize the **local PDF → OCR → vision → IndexedDB → study set** path: **reliable IDs**, **debuggable failures** (without misleading “PDF broken” copy), **structured logging**, and **safe dependency posture**. Improve **inspector / review UX** where it blocks trust (e.g. Select state, OCR vs full-page imagery).

This phase does **not** redefine v1 roadmap Phases 1–5; it **hardens** the implementation that spans ingestion, AI parse, and storage. Optional follow-up: **per-question media crops** from OCR geometry (explicitly deferred below).

</domain>

<decisions>
## Implementation Decisions

### Study set & media IDs (browser)
- **D-01:** Do not rely on `crypto.randomUUID()` alone in client/shared code; use a shared helper (`createRandomUuid` in `src/lib/ids/createRandomUuid.ts`) that prefers `randomUUID`, then UUIDv4 via `getRandomValues`, then a UUID-shaped weak fallback; log once when falling back (`[STUDY_SET][id]`).
- **D-02:** Apply the same helper everywhere client code generated IDs for IndexedDB: study set creation, media blobs, quiz sessions, JSON question import, legacy migration — **except** server-only code that already uses `node:crypto` (e.g. vision staging API).

### New study set import — errors and logging
- **D-03:** Track **phase** `idb` | `pdf` | `persist` in the handler; map user-facing strings so **save/IDB failures** are not shown as **“could not open PDF”** when the PDF was already read.
- **D-04:** Keep friendly copy; add **structured `pipelineLog`** for: file handling start, `getPdfPageCount` start/success, `extractPdfText` start/finish (char count), `createStudySet` start, final catch (include `phase`, `userFacingBucket`, normalized error + `raw`).

### Pipeline logging standard
- **D-05:** Central logger: `pipelineLog(domain, stage, level, message, context?)` in `src/lib/logging/pipelineLogger.ts`; prefixes `[PDF]`, `[OCR]`, `[VISION]`, `[IDB]`, `[STUDY_SET]`; **`info` only in development or when `NEXT_PUBLIC_D2Q_PIPELINE_DEBUG === "1"`**; **warn/error always**.
- **D-06:** Normalize unknown errors for logs (`message`, `stack`, `name`, `cause`, pdf.js-style `name`); on pdf.js failures log **raw** object where useful.
- **D-07:** Remember: most PDF code runs in the **browser** — logs appear in **DevTools console**, not the Node terminal from `npm run dev`, unless code runs on the server.

### Dependency upgrades
- **D-08:** **Do not** jump to **Next 16 + pdfjs 5** without a **project-wide** plan to keep `pdfjs-dist` off the **SSR/prerender** graph (observed: `DOMMatrix is not defined` during static generation on routes that transitively import pdf.js). Prior stack (Next 15.x, pdfjs 4.x) remains the baseline until isolation is designed.
- **D-09:** pdfjs 5 **render API** may require `canvas` on `render()` parameters — track when upgrading.

### OCR inspector (Base UI Select)
- **D-10:** Avoid **uncontrolled → controlled** `Select`: when OCR `run` is loaded, update **`selectedPage` in the same async completion as `setRun`** (e.g. in `reload` after `getOcrResult`), not only in a later `useEffect`, so the first paint with pages already has a string `value`.

### the agent's Discretion
- Exact wording of user-facing strings (keep tone consistent with app).
- Whether to add more `pipelineLog` sites after this phase.
- Minor/patch dependency bumps within the locked major lines.

</decisions>

<specifics>
## Specific Ideas (from chat / screenshots)

- User saw **Q9** with a **full-page thumbnail** attached and noted (VN) that the app still uses the **whole page** rather than **OCR-then-crop** to the **exact figure** for that question — product expectation for a later slice of work.
- Debug session for Select: hypothesis was **first render** with `run.pages` populated but `selectedPage === null` → `value={undefined}` → then effect sets page → controlled switch; fix aligned with **D-10**.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing this phase.**

### Logging & IDs
- `src/lib/logging/pipelineLogger.ts` — verbosity gate, `normalizeUnknownError`, `fileSummary`
- `src/lib/ids/createRandomUuid.ts` — client ID generation contract
- `src/app/(app)/sets/new/page.tsx` — import phases + user messages + orchestration logs
- `src/lib/db/studySetDb.ts` — `createStudySet`, `newStudySetId`, `putMediaBlob`, IDB logs

### PDF / OCR / vision touchpoints
- `src/lib/pdf/getPdfPageCount.ts`, `extractPdfText.ts`, `renderPagesToImages.ts`, `pdfWorker.ts`, `validatePdfFile.ts`
- `src/lib/ai/runOcrSequential.ts`, `ocrAdapter.ts`, `ocrDb.ts`
- `src/components/ai/AiParseSection.tsx`, `OcrInspector.tsx`

### Planning baseline (milestones)
- `.planning/ROADMAP.md` — v1 phases 1–5 scope (this phase extends reliability, not replacing them)
- `.planning/REQUIREMENTS.md` — PDF/AI/review/practice requirements IDs where relevant

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- `pipelineLog` + domains — extend consistently; avoid ad-hoc `console.log`.
- `createRandomUuid` — single place for new client-side opaque IDs.

### Established patterns
- Study sets keyed by string IDs in IndexedDB; UUID-shaped strings preserve existing behavior.
- Vision flow attaches **page-level** images from rasterized PDF pages unless/until crop pipeline exists.

### Integration points
- `ensureStudySetDb` / `createStudySet` on new import; `OcrInspector` + `QuestionPreviewList` / review UIs for perceived quality.

</code_context>

<deferred>
## Deferred Ideas

- **Per-question image crops** using OCR block bbox/polygon (or vision ROI) instead of full-page images in question cards — **not in this phase’s delivered scope** unless explicitly pulled in; user expectation captured in Specifics.
- **Full-stack “latest” upgrade** (Next 16, pdfjs 5, etc.) — deferred until SSR/pdf.js boundary is solved repo-wide.
- Expanding pipeline logs to **server-only** routes (if needed for API debugging) — optional.

</deferred>

---

*Phase: 06-pipeline-hardening*  
*Context gathered: 2026-04-08*
