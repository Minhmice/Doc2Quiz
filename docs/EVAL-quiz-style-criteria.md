# Evaluation criteria — quiz style (Phase 38)

Use when reviewing model outputs or training exports (JSONL).

## Structure

- **JSON validity:** Parsed MCQ payloads must match `Question` / schema validators without repair.
- **Stem clarity:** Single clear ask; no double negatives unless source material requires it.
- **Distractors:** Plausible, mutually exclusive where possible; avoid “all of the above” unless source uses it.

## Scoring (manual)

- **2** — Ready for bank without edit.
- **1** — Usable with minor edit.
- **0** — Reject or heavy rewrite.

## Automation (spike)

- `scripts/eval-export-smoke.mjs` validates **line-level JSON** shape only — not semantic quality.
