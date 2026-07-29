# Phase 25: Skip rasterization for born-digital PDFs; extract text layer first - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.  
> Decisions are captured in `25-CONTEXT.md` — this log preserves alternatives considered.

**Date:** 2026-04-16  
**Phase:** 25 — Skip rasterization for born-digital PDFs; extract text layer first  
**Areas discussed:** Text-layer signal, Default policy & overrides, Mixed PDFs, UX + logs

---

## Text-layer signal

| Option | Description | Selected |
|--------|-------------|----------|
| chars/page | Use `extractedTextCharCount / pageCount` | |
| nonempty-page-ratio | Use ratio of pages with any text | |
| both | Combine chars/page + nonempty-page-ratio | ✓ |

**Choice:** Combine both signals.  
**Notes:** Keep chars/page threshold at **40**; when uncertain, default to **vision**. Always do **first-page sampling (3–5 pages)** even if extracted text already exists.

---

## Default policy & overrides

| Option | Description | Selected |
|--------|-------------|----------|
| auto-text-first | Strong text → auto text-first, avoid rasterization | ✓ |
| suggest-only | Only suggest; keep vision unless user switches | |
| always-vision | Keep vision-first; Phase 25 is insight only | |

**Override location:** Parse Strategy panel (`AiParseParseStrategyPanel`).  
**Accurate behavior:** Accurate stays vision-first.  
**Fallback trigger:** Quality gate (low output/low confidence) → **auto fallback to vision** (no confirmation prompt).

---

## Mixed PDFs

| Option | Description | Selected |
|--------|-------------|----------|
| strong-wins | Strong signal → still text-first; allow fallback | ✓ |
| any-missing-forces-vision | Any missing pages → force vision for whole doc | |

**Coverage expectation (Phase 25):** OK if text-first misses some scanned pages; user can rerun Vision.  
**Quality gate:** combine min question count + confidence/validity.  
**Default threshold:** < **5 questions** → fallback to vision.

---

## UX + logs

| Option | Description | Selected |
|--------|-------------|----------|
| short | Short one-liner messages | ✓ |
| detailed | Include thresholds and full rationale in UI | |

**Fallback messaging:** show a lightweight **toast**.  
**Where to show:** overlay log/progress in `AiParseSection`.  
**Telemetry:** include reason codes + short rationale (e.g. `text_layer_strong`).

---

## Claude's Discretion

- Sampling size (3–5 pages) and confidence aggregation details for the quality gate.
- Exact copywriting as long as it remains short and student-friendly.

## Deferred Ideas

- True per-page routing (avoid rasterizing only text pages) deferred to Phase 29.

