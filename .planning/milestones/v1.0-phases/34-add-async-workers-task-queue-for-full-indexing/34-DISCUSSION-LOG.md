# Phase 34: Add async workers / task queue for full indexing — Discussion log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in `34-CONTEXT.md`.

**Date:** 2026-04-18  
**Phase:** 34 — Add async workers / task queue for full indexing  
**Areas discussed:** execution plane, triggers, UX/progress, failure/resume (all areas)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Execution plane | Browser vs server `parse-jobs` vs hybrid | ✓ (via “all”) |
| Trigger | Manual vs auto vs upload vs deferred mix | ✓ |
| UX / progress | RAG panel vs parse progress vs minimal | ✓ |
| Failure / resume | Standard vs strict vs invalidate-only option | ✓ |
| Discuss all | Recommended bundle for TBD roadmap | ✓ |

**User's choice:** Discuss **all** gray areas.

---

## 1. Execution plane

| Option | Description | Selected |
|--------|-------------|----------|
| Browser-only | Web Workers + IDB; `/api/ai/embed` same-origin; no `parse-jobs` required for v1 | ✓ |
| Wire server queue | `parse-jobs` + server workers; sync vectors to client IDB or revise Phase 33 | |
| Hybrid | Browser default; optional server offload later | |

**User's choice:** Browser-only (recommended option).

**Notes:** Preserves Phase 33 browser-local vector store without opening server-stored vectors in this phase.

---

## 2. When full indexing runs

| Option | Description | Selected |
|--------|-------------|----------|
| Manual only | User clicks build index | |
| Auto after extract | Auto-start after extracted text persisted | ✓ |
| After upload | When background upload+extract completes | |
| Deferred mix | Manual v1; auto as follow-up | |

**User's choice:** Auto-start after extracted text is persisted.

---

## 3. Progress & visibility

| Option | Description | Selected |
|--------|-------------|----------|
| RAG panel | Progress, cancel, error in semantic/RAG surface | ✓ |
| Reuse parse progress | Same workbench patterns as parse | |
| Minimal | Toasts / spinner only | |

**User's choice:** RAG panel as primary surface.

---

## 4. Failure, cancel, invalidation

| Option | Description | Selected |
|--------|-------------|----------|
| Standard | Abort cancel; bounded retries; partial index OK; last error | ✓ |
| Strict | Fail whole job on first error; clear partial | |
| Invalidate model | (standalone option in form) | Not selected alone |

**User's choice:** Standard resilience.

**Notes:** `34-CONTEXT.md` also locks **invalidation on model/schema change** (D-05) to align Phase 33 D-04 — complementary to “standard” runtime behavior, not contradictory.

---

## Deferred ideas captured

- Server `parse-jobs` as primary plane — deferred.
- Global jobs dashboard — deferred unless product demands.
