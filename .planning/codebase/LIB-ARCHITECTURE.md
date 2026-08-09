# `src/lib` architecture map

Scope: import/dependency review only. No source changes.

## Runtime zones

- **Client-safe:** `src/lib/client/*`, `src/lib/ai/ping.ts`, UI/locale/learning/routing/IDs/provenance pure helpers. Client modules call API routes with `fetch`; browser Supabase entry is `client/supabase.ts` → `supabase/browser.ts`.
- **Server-only:** `src/lib/server/*`; `src/lib/api/requireApiUser.ts`; `src/lib/supabase/server.ts` and `auth-guard.ts`; server pipeline entrypoints that import `SupabaseClient`, `User`, server config, filesystem, or direct AI transport.
- **Mixed-risk pipeline:** `src/lib/pipeline/*` contains pure schemas/mappers/dedupe/heuristics beside server orchestration. `canonicalPrompt.ts`, `quizPrompt.ts`, `flashcardPrompt.ts` read prompt files with `node:fs/promises`; `ingest.ts` and `markitdown.ts` use Node filesystem/process execution; `canonicalize.ts`, `quizGenerate.ts`, `flashcardGenerate.ts` persist through Supabase and call AI.

## Active import graph

- API routes import server orchestration: legacy `/api/study-sets/*` → `ingest.ts`, `canonicalize.ts`, `quizGenerate.ts`, `flashcardGenerate.ts`; workspace output routes → `multiSourceGenerate.ts` / `flashcardMultiSourceGenerate.ts`; workspace ingest → `createWorkspaceIngest.ts` and canonical version flow.
- AI shared spine: `canonicalize.ts`, `canonicalVersion.ts`, `quizGenerate.ts`, `flashcardGenerate.ts`, `sourceQuestionResolver.ts`, `ai-agent-ping.ts` → `server/ai-processing-config.ts` + `server/openAiChatCompletion.ts`; most also use `resolveUserAiTier.ts` and `formatUpstreamAiError.ts`.
- Shared pure output mechanics: `faithfulness.ts` (`checkCanonical`, `checkQuiz`, `checkFlashcard`), schemas, `stripJsonFence`, raw-markdown limits, Zod error summaries, dedupe/cap, row mappers, and `provenance/outputSnapshot.ts`.
- Workspace-native output path reuses legacy generator mechanics: multi-source quiz calls `callQuizGenerator`, `buildQuestionCandidates`, `resolveSourceQuestions`; multi-source flashcards calls `callFlashcardGenerator`, section coverage helpers, dedupe, faithfulness, and row mapping.
- Client duplication is intentional adapter layering: `client/quizGenerateStudySet.ts` and `client/flashcardGenerateStudySet.ts` expose both workspace-native API calls and legacy study-set API calls. `client/ingestStudySet.ts` is explicitly legacy; `client/ingestWorkspace.ts` is native.

## Legacy/native duplicate flows

| Concern | Legacy flow | Native flow | Shared core |
|---|---|---|---|
| Ingest | `client/ingestStudySet.ts` → `/api/study-sets/:id/ingest` → `pipeline/ingest.ts` | `client/ingestWorkspace.ts` → `/api/workspaces/ingest` → `workspaces/createWorkspaceIngest.ts` | MarkItDown conversion, validation, raw markdown limits, Supabase storage/retry patterns |
| Canonicalize | `pipeline/canonicalize.ts` on `study_sets` / `canonical_documents` | `pipeline/canonicalVersion.ts` on document versions | AI/heuristic canonical builder, prompt, schemas, faithfulness, AI config |
| Quiz | `client.postQuizGenerate` → `/api/study-sets/:id/quiz/generate` → `runQuizGenerate` | `postWorkspaceQuizGenerate` → workspace outputs route → `runMultiSourceQuizGenerate` | `callQuizGenerator`, candidate resolution, row mapping, faithfulness |
| Flashcards | legacy study-set route → `runFlashcardGenerate` | workspace outputs route → `runMultiSourceFlashcardGenerate` | `callFlashcardGenerator`, dedupe, row mapping, faithfulness |
| Compatibility | `workspaces/legacyBridge.ts`, bridge IDs in summaries/routes | native output snapshots and bridge output records | provenance and output routing |

## Server-only boundaries

Hard boundary candidates: direct AI transport (`server/openAiChatCompletion.ts`), tier/config (`server/ai-processing-config.ts`, `resolveUserAiTier.ts`), Supabase server/auth, filesystem-backed prompt/conversion modules, and all persistence orchestration. Do not import these from client bundles. `src/lib/server/quizAttempts/importAnonymousQuizAttempts.ts` currently imports a type from `client/anonymousQuizAttempts.ts`; type-only edge, low runtime risk.

## Migration risks

1. **Behavior drift:** legacy and native paths share generators but differ in persistence, IDs, provenance, quota, and error classes.
2. **Fallback semantics:** canonical AI failure intentionally falls back to heuristic output; extraction/generation modes (`source`, `source_ai`, `ai`, `deterministic`, `hybrid`) are persisted and surfaced.
3. **Prompt contract:** prompt loaders are filesystem-backed and versioned; moving them can break test mocks, deployment packaging, or prompt versions.
4. **Supabase retry/idempotency:** ingest and output writers retry network failures and use bridge/RPC records; extraction must preserve write ordering and retry limits.
5. **Browser compatibility:** legacy client adapters and localStorage selection helpers must remain browser-safe while shared types move.
6. **Duplicate logic:** ingest filename sanitization, temp-file lifecycle, storage upload, and retry code appear in both ingest implementations; careless merge can change path/security rules.
7. **Sensitive provenance:** AI config/API key values must stay server-only; provenance tests show secret-like values and should not cross client boundary.

## Exact next safe extraction seam

Extract **pure AI request/result mechanics** from `callQuizGenerator` and `callFlashcardGenerator` only after first adding characterization tests around current behavior. Seam: a server-only `src/lib/server/aiGeneration.ts` (or `server/ai/`) containing the shared `postChatCompletionAssistantText` call, JSON-fence parsing, one repair request, Zod validation, timeout/abort handling, and upstream error mapping. Keep prompt construction, output schemas, faithfulness, candidate resolution, and Supabase persistence in current modules. Migrate quiz first, then flashcards; native multi-source flows inherit reuse through existing `call*Generator` imports. Do not extract ingest yet: legacy/native path differences and filesystem/storage lifecycle are larger and security-sensitive.

## Suggested dependency direction

`client → API routes → server orchestration → pure pipeline mechanics`; pure pipeline modules may depend on schemas/helpers only. Server transport/config may not be imported by client modules. Native orchestration may reuse legacy generator core, but legacy adapters should depend on stable server/API contracts rather than native persistence internals.
