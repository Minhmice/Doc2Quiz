# Phase 19 — Plan 01 summary (wave 1)

## Done

- **`src/types/question.ts`:** `LS_FORWARD_*` + migration sentinel keys.
- **`src/lib/ai/forwardSettings.ts`:** `ForwardClientSettings`, `migrateForwardSettingsFromLegacy`, `readForwardSettings`, `writeForwardSettings`, `clearForwardSettings`, `getForwardOpenAiCompatKind`, default URL constants.
- **`src/lib/ai/parseCapabilities.ts`:** `ParsePipelineSurface`, `getSurfaceAvailability`, `isSurfaceAllowed`, `surfaceBlockReason`, stable `reasonKey` exports.
- **`src/lib/ai/storage.ts`:** `getForwardClientForUi`; getters/setters delegate to forward triple; `getProvider()` returns `openai` | `custom` when forward API key present, else legacy `LS_PROVIDER`.
- **`docs/BYOK-forward-only.md`:** three-field BYOK + migration + pointer to `parseCapabilities` and `BYOK-parse-estimate.md`.

## Verification

- `npm run build` — pass
