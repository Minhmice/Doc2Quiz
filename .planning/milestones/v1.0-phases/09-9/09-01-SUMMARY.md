# Phase 09 — Plan 01 Summary

**Date:** 2026-04-11  
**Status:** Complete

## What shipped

- **Dependency:** `mathjax@^3.2.2` in `dependencies`.
- **Copy pipeline:** `scripts/copy-mathjax-assets.mjs` copies `node_modules/mathjax/es5` → `public/mathjax/es5`; `npm run copy-mathjax`; `postinstall` chains after existing pdf worker copy.
- **Gitignore:** `/public/mathjax/es5/` ignored (generated; CI/local must run `postinstall` or `copy-mathjax` before `next build`).
- **`splitMathSegments`:** `src/lib/math/splitMathSegments.ts` — `$$` display blocks first, then `$…$` inline; lone `$` stays text.
- **`MathText`:** `src/components/math/MathText.tsx` + barrel `src/components/math/index.ts` — loads `/mathjax/es5/tex-chtml.js` with `loader.paths.mathjax = "/mathjax/es5"`, `typesetPromise` + optional `typesetClear`, debounced source, error line per UI-SPEC.

## `splitMathSegments` examples (observed)

```text
{"input":"hello","out":[{"kind":"text","value":"hello"}]}
{"input":"a $x^2$ b","out":[{"kind":"text","value":"a "},{"kind":"math","value":"x^2","display":false},{"kind":"text","value":" b"}]}
{"input":"pre $$\\frac12$$ post","out":[{"kind":"text","value":"pre "},{"kind":"math","value":"\\frac12","display":true},{"kind":"text","value":" post"}]}
```

## Verification

- `npm run lint` — pass  
- `npx tsc --noEmit` — pass  
- `npm run build` — pass (MathJax `legacy` Node warning only)
