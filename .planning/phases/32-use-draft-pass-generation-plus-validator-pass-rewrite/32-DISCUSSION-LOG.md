# Phase 32: Draft + validator pass — Discussion log

> Audit trail only. Planning/execution agents consume `32-CONTEXT.md`, not this file.

**Date:** 2026-04-18  
**Phase:** 32  
**Language:** Prompts in Vietnamese; decisions recorded in English in CONTEXT.

---

## Placement (draft / validator chạy ở đâu)

**User answer (free text):** "bro draft, còn lại là theo chunk" — interpreted as **per-chunk** flow: draft then validate per chunk before merge.

**Locked in CONTEXT:** D-01

---

## Validator role

| Option | Selected |
|--------|----------|
| LLM rewrite only | |
| Local/schema only | |
| **Hybrid** | ✓ |

**Locked in CONTEXT:** D-02

---

## When second pass runs

| Option | Selected |
|--------|----------|
| **Always** | ✓ |
| On error only | |
| Heuristic | |

**Locked in CONTEXT:** D-03

---

## Quiz vs Flashcards

| Option | Selected |
|--------|----------|
| **Same contract (both)** | ✓ |
| Quiz first | |
| Discretion | |

**Locked in CONTEXT:** D-04

---

## Cost / UX

| Option | Selected |
|--------|----------|
| Silent | |
| **Light toast** | ✓ |
| User toggle | |

**Locked in CONTEXT:** D-05

---

## Deferred

- Eco mode / skip second pass — not chosen; noted in CONTEXT deferred section.
