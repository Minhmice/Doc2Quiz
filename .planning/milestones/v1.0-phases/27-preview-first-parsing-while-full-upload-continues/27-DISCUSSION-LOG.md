# Phase 27: Preview-first parsing while full upload continues - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in `27-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-16  
**Phase:** 27-preview-first-parsing-while-full-upload-continues  
**Areas discussed:** Start trigger & preview definition, UX progress & controls, Persistence & ordering, Failure policy

---

## Start trigger & preview definition

| Option | Description | Selected |
|--------|-------------|----------|
| Immediately after file select | Start parse in parallel with background upload + local ingest | ✓ |
| After meta created | Wait for `studySetId` + meta before starting parse |  |
| After local ingest done | Only parse after pageCount/extractText/createStudySet completes |  |
| After preview pages ready | Wait until 3–5 pages rendered before starting |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Stream incremental | Show questions/cards as soon as they exist | ✓ |
| Milestone first batch | Only show after first batch threshold |  |
| Preview-only then full | Quick preview pass then full parse |  |
| No special preview | Just reduce time-to-first-result; UI unchanged |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Both Quiz + Flashcards | Preview-first applies to both content kinds | ✓ |
| Quiz only | Flashcards unchanged |  |
| Flashcards only | Quiz unchanged |  |

| Option | Description | Selected |
|--------|-------------|----------|
| First 3–5 pages | Align with Phase 25 sampling | ✓ |
| First 10 pages | Fixed cap |  |
| Time-boxed | e.g. first 10–15s |  |
| Target count | e.g. 8 questions / 12 cards |  |

---

## UX progress & controls

| Option | Description | Selected |
|--------|-------------|----------|
| Single status card | Combine into `UnifiedImportStatusCard` |  |
| Top strip | Sticky strip shows upload bytes + parse progress | ✓ |
| Keep current columns | Add upload row into right rail |  |
| Minimal upload | Upload is tiny line; parse is primary |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Separate cancel | Cancel Upload and Cancel Parse separately |  |
| Cancel-all default | Primary cancel cancels upload+parse, start over | ✓ |
| Cancel upload only | Only allow cancel upload |  |
| Cancel parse only | Upload always background; no parse cancel focus |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Allow study (no block) | Parse usable output can navigate to play immediately |  |
| Allow with confirm | Light confirmation if upload still running |  |
| Block until upload done | Navigation to play is blocked until upload completes | ✓ |
| Depends on config | Local-only immediate; direct-upload blocks |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Quiet chip | No toast |  |
| Light toast | “Upload complete” toast | ✓ |
| No signal | Auto-hide |  |
| Show link | “View upload details” |  |

---

## Persistence & ordering

| Option | Description | Selected |
|--------|-------------|----------|
| Meta only first | Create `studySetId` + meta first; bytes later/background | ✓ |
| Keep createStudySet full | No ordering change |  |
| Two-phase doc write | Explicit `putDocument(pdfArrayBuffer)` later |  |
| Claude decides | Any approach acceptable |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Local always first | Local persist prioritized; upload best-effort | ✓ |
| Start upload first | Upload first, local may delay |  |
| Upload gates parse | Must init upload before parse |  |
| Parse independent | Upload is pure side-effect |  |

| Option | Description | Selected |
|--------|-------------|----------|
| No resume | Refresh/close returns to upload step | ✓ |
| Resume parse only | Try resume parse from IDB |  |
| Resume upload only | Contradicts Phase 26 |  |
| Claude decides | Any consistent approach |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Local render always | Preview pages rendered from local File; no network dependency | ✓ |
| Prefer uploaded URL | Parse via URL if available |  |
| Text-first if strong | Prefer text-first when strong text-layer |  |

---

## Failure policy

| Option | Description | Selected |
|--------|-------------|----------|
| Hide upload completely | Local-only behaves like today; no cloud mention | ✓ |
| Subtle local-only | Show “Local-only” line |  |
| Prompt enable | Suggest enabling storage |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Block until upload fixed | Require re-upload success before study |  |
| Allow study but warn | Study can proceed if parse ok |  |
| Cancel everything | Start over if upload finalize fails | ✓ |
| Ignore upload fail | Not aligned |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Retry parse default | Retry/adjust parse while upload continues/finished | ✓ |
| Force reupload then parse | Reupload required before parsing again |  |
| Cancel all | Delete set on parse failure |  |

| Option | Description | Selected |
|--------|-------------|----------|
| Delete set on cancel | Cancel-all deletes study set (avoid trash) | ✓ |
| Keep set draft | Keep set for later |  |
| Ask each time | Confirmation each cancel |  |

---

## Deferred Ideas
- Resume across refresh/reopen — deferred (Phase 26 constraint).
- Per-page routing (text vs bitmap vs rich layout) — Phase 29.

