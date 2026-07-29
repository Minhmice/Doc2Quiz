# Debug: MarkItDown PDF MissingDependencyException

**Status:** fix applied  
**Started:** 2026-07-25

## Symptom

```
PdfConverter threw MissingDependencyException … pip install markitdown[pdf]
```

## Root cause

Next.js spawned **system Python** (`python` on PATH) which had `markitdown 0.1.5` **without** PDF extras. Project requires `markitdown[all]==0.1.6` from `requirements.txt` in a project **`.venv`**.

## Fixes applied

- Created `.venv` with `pip install -r requirements.txt` (markitdown 0.1.6 + pdf deps)
- `markitdown.ts` auto-detects `.venv` Python when `MARKITDOWN_PYTHON` unset
- Clear error message when PDF extras missing
- `npm run setup:python` — one-command venv + install
- `.env.example` documents `MARKITDOWN_PYTHON`

## Verify

```bash
npm run setup:python
# Add to .env (optional if .venv exists — auto-detected):
# MARKITDOWN_PYTHON=.venv\Scripts\python.exe

.\.venv\Scripts\python.exe -m markitdown your-file.pdf -o out.md
```

Re-upload PDF in app — ingest should succeed.
