# BYOK — forward-only (three fields)

Doc2Quiz sends AI traffic through **`POST /api/ai/forward`** (same-origin). Phase 19 stores a **single OpenAI-compatible** client configuration in `localStorage`:

| Field | `localStorage` key | Meaning |
|--------|--------------------|--------|
| **API base URL** | `doc2quiz:ai:forwardBaseUrl` | Full chat-completions URL (e.g. `https://api.openai.com/v1/chat/completions`) or another OpenAI-compatible endpoint. **Leave empty** to use the built-in default OpenAI host (still requires an API key). |
| **API key** | `doc2quiz:ai:forwardApiKey` | Bearer token forwarded to your provider. |
| **Model id** | `doc2quiz:ai:forwardModelId` | Model name for chat + vision requests. **Required** when a custom base URL is set; optional when using the default host (a built-in default model id applies). |

## Migration from older builds

On first read, legacy keys (`doc2quiz:ai:openaiKey`, `customUrl`, `anthropicKey`, …) are copied into the forward triple **once** (`doc2quiz:ai:forwardMigratedV1`). Old keys are left in place for safety; the app reads forward fields after migration.

Priority: **Custom URL** (if set) → **OpenAI** fields → **Anthropic** fields.

## Capability matrix (declarative v1)

`src/lib/ai/parseCapabilities.ts` exposes which **surfaces** (text MCQ, OCR forward, layout chunk LLM, vision multimodal / attach, IDB draft) are **allowed** vs **blocked** for the current triple (e.g. missing API key). The matrix is **code-defined** in v1 — not a live probe of model capabilities.

See also: [`BYOK-parse-estimate.md`](./BYOK-parse-estimate.md) for pre-run call/token **estimates** (unchanged conceptually; formulas use the same parse strategies).
