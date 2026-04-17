# Phase 38: Full fine-tuning or distillation for quiz style — Context

**Gathered:** 2026-04-18  
**Status:** Ready for planning  
**Mode:** Smart discuss — auto-accepted (recommended defaults)

<domain>
## Phase boundary

Explore whether **domain-specific fine-tuning** or **distillation** can improve **quiz stem style**, **distractor quality**, or **JSON reliability** for Doc2Quiz’s parsers — as an **optional** research and tooling track. **v1 deliverable** is **not** a shipped fine-tuned model inside the app; it is **decision + export path** for training data and evaluation harness.

**In scope**

- **Export** of anonymized / user-approved **question payloads** (approved bank) in a **machine-readable** format suitable for training or eval (user consent / local only).
- **Evaluation criteria** doc: what “better quiz style” means for this product (clarity, distractor independence, JSON validity).
- Spike: one **small** experiment script (optional, repo `scripts/` or `docs/`) — **not** production inference.

**Out of scope**

- Hosting a proprietary model API inside Doc2Quiz.
- Training on user data without explicit **export** workflow and **local** control.

</domain>

<decisions>
## Implementation decisions

### Default model strategy
- **D-38-01:** Product continues to use **user BYOK** and **generic** models; any fine-tuned model is **bring-your-own-endpoint** or local inference **outside** core app until explicitly planned.

### Data governance
- **D-38-02:** Training exports are **explicit user action** from Settings or dev tool; **no** silent upload.

### Deliverable shape
- **D-38-03:** Phase 38 ends with **RESEARCH.md + decision** (go/no-go) and, if go, a **Phase 39**-sized implementation plan — not full training infra in one phase.

### Claude’s discretion
- Format (JSONL vs Parquet), minimal PII stripping hooks, and eval prompts — align with `PROJECT.md` ethics.

</decisions>

<code_context>
## Existing code insights

### Reusable assets
- Approved **question bank** types and export from IndexedDB.
- Validator / draft prompts in Phase **32** as quality baseline for eval.

### Integration points
- Optional CLI or **developer-only** page gated by env.

</code_context>

<specifics>
## Specific ideas

- Auto-discuss: **research-first**, **explicit export**, **no** bundled proprietary model.

</specifics>

<deferred>
## Deferred ideas

- Hosted “Doc2Quiz model” as a paid tier — product decision, not this phase.

</deferred>
