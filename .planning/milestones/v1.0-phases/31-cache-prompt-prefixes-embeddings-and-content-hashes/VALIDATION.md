# Phase 31 — Validation (Nyquist / UAT notes)

**Phase:** `31-cache-prompt-prefixes-embeddings-and-content-hashes`  
**Purpose:** Gate Phase 31 execution when **`npm test`** is not available; complements **`npm run lint`** and **`npm run build`**.

## 1. Scope sanity (CACHE-31-08)

- [ ] Repo diff contains **no** new `embedding` / vector-store routes or UI.
- [ ] Parse cache is **browser-only** (IndexedDB + optional memory); no server-side shared cache.

## 2. Key safety (CACHE-31-02, CACHE-31-04)

- [ ] Change **model id** or **openai vs custom** → **cache miss** (no stale hit).
- [ ] Bump **`mcq-extraction.prompts.json` `version`** or edit system prompt text → **cache miss** for text lanes.
- [ ] Vision: change **system message text** passed to the API for a batch → **cache miss**.

## 3. LRU / caps (CACHE-31-07) — manual

**Pre:** Clear site data for origin or delete `doc2quiz-parse-cache` in DevTools → Application → IndexedDB.

1. Run a parse that fills the cache until **> 400 entries** in one store (e.g. repeat same flow with distinct chunk texts, or temporarily lower cap in dev — if executor lowers cap for dev only, document it).
2. Open DevTools → Application → IndexedDB → `doc2quiz-parse-cache` → object store (`vision_batch` or `text_chunk`).
3. **Expect:** entry count stays **≤ max entries** constant from `parseCacheDb.ts`; oldest/lowest-`lastAccessedAt` rows are removed after inserts.
4. **Expect:** repeated **read** of same key refreshes `lastAccessedAt` (entry survives longer under pressure).

*If full 401-insert exercise is impractical, accept: code review of `enforceLruAfterSet` + index/cursor logic, plus spot-check count after ~20 inserts.*

## 4. Durability (CACHE-31-05, CACHE-31-06)

- [ ] Cache hit on **vision batch**: reload page, re-run same parse → **still hits** (IDB path).
- [ ] Cache hit on **sequential text** parse: reload, re-run same chunks → **still hits**.

## 5. Regression

- [ ] With IndexedDB **unavailable** (simulate private mode block or throw in dev) → parse **still completes** uncached without hard failure.

## 6. Automated gates (always)

- `npm run lint`
- `npm run build`
