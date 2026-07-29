# Phase 38 — Fine-tuning / distillation research

**Date:** 2026-04-18  
**Verdict:** **No-go for in-app hosted model** in v1; **go** for optional **export + offline eval** (see `38-02` deliverables).

## Options

| Approach | Fit for Doc2Quiz | Notes |
|----------|------------------|--------|
| Prompt-only + validator (Phase 32) | **High** — already shipped | Best ROI; no training cost. |
| LoRA / fine-tune on user exports | Medium | Requires GPU, data governance, BYO endpoint. |
| Distillation from larger model | Medium | Pairs need curated export; offline pipeline. |

## Recommendation

- Keep **BYOK** and **generic** models as the product default.
- Use **explicit JSONL export** from approved bank for users who want external training.
- Revisit a **Phase 39** only if export-driven eval shows clear gains on **JSON validity** + **distractor quality** metrics (`docs/EVAL-quiz-style-criteria.md`).

## Risks

- Training on user documents without consent — **mitigated** by explicit export action only (`FT-38-01`).
