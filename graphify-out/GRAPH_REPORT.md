# Graph Report - src  (2026-04-12)

## Corpus Check
- Large corpus: 212 files · ~70,365 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder, or use --no-semantic to run AST-only.

## Summary
- 718 nodes · 1378 edges · 43 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## God Nodes (most connected - your core abstractions)
1. `react` - 61 edges
2. `ensureStudySetDb()` - 19 edges
3. `next/navigation` - 11 edges
4. `txDone()` - 8 edges
5. `runOcrPage()` - 7 edges
6. `testAiVisionConnection()` - 7 edges
7. `GET()` - 5 edges
8. `readForwardSettings()` - 5 edges
9. `chunkPage()` - 5 edges
10. `testAiConnection()` - 5 edges

## Surprising Connections (you probably didn't know these)
- `GET()` --calls--> `isDevelopMocksEnabled()`  [EXTRACTED]
  src\app\api\parse-jobs\[id]\route.ts → src\app\api\develop\mock\[slug]\route.ts
- `GET()` --calls--> `notFound()`  [EXTRACTED]
  src\app\api\parse-jobs\[id]\route.ts → src\app\api\develop\mock\[slug]\route.ts
- `GET()` --calls--> `slugLooksUnsafe()`  [EXTRACTED]
  src\app\api\parse-jobs\[id]\route.ts → src\app\api\develop\mock\[slug]\route.ts
- `POST()` --calls--> `isAllowedTargetUrl()`  [EXTRACTED]
  src\app\api\parse-jobs\route.ts → src\app\api\ai\forward\route.ts
- `POST()` --calls--> `json()`  [EXTRACTED]
  src\app\api\parse-jobs\route.ts → src\app\api\ai\vision-staging\route.ts

## Hyperedges (group relationships)
- **Vision image staging upload and fetch by id** — src_app_api_ai_vision_staging_route, src_app_api_ai_vision_staging_id_route, visionstagingstore [INFERRED 0.85]
- **Server parse job queue API stub behind feature flag** — src_app_api_parse_jobs_route, src_app_api_parse_jobs_id_route, env [EXTRACTED 0.95]
- **MathText used across preview, play, flashcards, and review** — src_components_math_mathtext, src_components_ai_questionpreviewlist, src_components_play_playsession [INFERRED 0.75]
- **OCR and vision paths surface errors via reportPipelineError** — file_runOcrSequential, file_runVisionSequential, file_reportPipelineError [EXTRACTED 0.92]
- **Server parse queue flag and job types shape operator-facing API** — file_serverParseEnv, file_parseJob, file_pipelineLogger [INFERRED 0.62]

## Communities

### Community 0 - "AI parse UI and progress"
Cohesion: 0.04
Nodes (13): loadMathJaxFromPublic(), run(), collectTopQuestionIssues(), describeQuestionIssues(), formatTimeAgo(), PdfInfoCard(), @/components/ui/radio-group, react (+5 more)

### Community 1 - "PDF upload and extract"
Cohesion: 0.03
Nodes (20): dedupeQuestionsByStem(), questionStemKey(), FatalParseError, cappedPageCount(), estimateParseRun(), msToSecondsCeil(), visionStepsFullRun(), extractPdfText() (+12 more)

### Community 2 - "Parse and AI test"
Cohesion: 0.07
Nodes (30): generateStudySetTitle(), openAiStyleTitle(), parseTitleJson(), normalizeSingleChunkModelJson(), parseChunkOnce(), parseChunkSingleMcqOnce(), parseJsonFromModelText(), questionsFromAssistantContent() (+22 more)

### Community 3 - "AI parse UI and progress 3"
Cohesion: 0.05
Nodes (3): next/navigation, estimateRangeSeconds(), formatEtaPrimary()

### Community 4 - "Misc"
Cohesion: 0.07
Nodes (17): extractQuestionsArray(), parseVisionQuizResponse(), estimateBatchTokens(), postVisionBatchCompletion(), readChatCompletionContent(), runVisionBatchSequential(), extractCardsArray(), validateVisionFlashcardItems() (+9 more)

### Community 5 - "AI storage and reachability"
Cohesion: 0.06
Nodes (3): logSnapshot(), runAiReachabilityCheck(), writeReachabilityToStorage()

### Community 6 - "Dashboard widgets"
Cohesion: 0.06
Nodes (2): gradientFor(), hashId()

### Community 7 - "Play and flashcards"
Cohesion: 0.06
Nodes (0): 

### Community 8 - "API routes and staging"
Cohesion: 0.08
Nodes (15): @vercel/blob, node:buffer, node:crypto, contentLengthBytes(), GET(), isAllowedTargetUrl(), isDevelopMocksEnabled(), json() (+7 more)

### Community 9 - "AI storage and reachability 9"
Cohesion: 0.09
Nodes (11): clearForwardSettings(), getForwardOpenAiCompatKind(), lsGet(), lsSet(), migrateForwardSettingsFromLegacy(), readForwardSettings(), writeForwardSettings(), getSurfaceAvailability() (+3 more)

### Community 10 - "Misc 10"
Cohesion: 0.16
Nodes (23): clearOcrMetaFields(), createStudySet(), deleteMedia(), deleteStudySet(), ensureStudySetDb(), getApprovedBank(), getDocument(), getDraftFlashcardVisionItems() (+15 more)

### Community 11 - "Review bank"
Cohesion: 0.14
Nodes (10): isApprovedBankShape(), loadApprovedBank(), createRandomUuid(), uuidV4FromGetRandomValues(), weakLocalHexUuid(), migrateLegacyLocalStorage(), txDone(), extractQuestionsArray() (+2 more)

### Community 12 - "OCR and layout chunks"
Cohesion: 0.23
Nodes (13): buildOcrSystemPrompt(), buildOcrUserPrompt(), imageTransportUrls(), parseOcrContent(), readChatCompletionContent(), readPolygon(), resolveForwardProvider(), runOcrPage() (+5 more)

### Community 13 - "OCR and layout chunks 13"
Cohesion: 0.29
Nodes (12): bboxCenter(), blockStartsQuestion(), buildChunkUserContent(), buildLayoutChunksFromRun(), buildSpatialHintLine(), chunkPage(), expandChunkText(), firstLine() (+4 more)

### Community 14 - "Activity tracking"
Cohesion: 0.33
Nodes (10): computeStreak(), dispatchStatsChanged(), getActivityStats(), getAllQuizSessions(), getMistakeQuestionIds(), hasMistakesForStudySet(), localDateKey(), recordQuizCompletion() (+2 more)

### Community 15 - "Select UI"
Cohesion: 0.22
Nodes (0): 

### Community 16 - "Misc 16"
Cohesion: 0.36
Nodes (8): buildParseScoreReviewDto(), emptyParseRetryHistory(), ocrPageQualityFromOcrPageResult(), parseRetryHistoryFromProgress(), provenanceFromQuestion(), questionParseQualityFromQuestion(), rollupBlockConfidences(), structureFromQuestion()

### Community 17 - "OCR and layout chunks 17"
Cohesion: 0.22
Nodes (2): getOcrProvider(), isOcrProvider()

### Community 18 - "Text chunking"
Cohesion: 0.46
Nodes (7): applyChunkContextOverlap(), chunkText(), chunkTextWithoutOverlap(), hardSliceLongParagraph(), lastBreakableIndex(), splitParagraphs(), tailForOverlap()

### Community 19 - "Mapping quality"
Cohesion: 0.46
Nodes (6): appendUncertainMappingSummaryClause(), countUncertainMappings(), getMappingQualityTier(), isBlanketSinglePageVision(), isUncertainPageMapping(), isUnresolvedMapping()

### Community 20 - "Misc 20"
Cohesion: 0.36
Nodes (5): isOcrPageModelOutputRetryable(), isTransientNetworkish(), shouldRetryOcrPage(), sleepMs(), withRetries()

### Community 21 - "Misc 21"
Cohesion: 0.52
Nodes (6): applyQuestionPageMapping(), overlapScore(), pageVerification(), setProvenanceMapping(), tokenize(), tryOcrOverlapMapping()

### Community 22 - "AI storage and reachability 22"
Cohesion: 0.29
Nodes (0): 

### Community 23 - "Math rendering"
Cohesion: 1.0
Nodes (3): mergeTextChunks(), splitInlineSegment(), splitMathSegments()

### Community 24 - "Misc 24"
Cohesion: 1.0
Nodes (0): 

### Community 25 - "Math rendering 25"
Cohesion: 0.67
Nodes (3): parseJob types, serverParse env, splitMathSegments

### Community 26 - "Misc 26"
Cohesion: 1.0
Nodes (2): POST /api/ai/forward: provider-keyed upstream proxy, Upstream chat/completions HTTP endpoint (dynamic URL)

### Community 27 - "Misc 27"
Cohesion: 1.0
Nodes (2): reportPipelineError, runVisionSequential

### Community 28 - "Misc 28"
Cohesion: 1.0
Nodes (0): 

### Community 29 - "Misc 29"
Cohesion: 1.0
Nodes (0): 

### Community 30 - "Misc 30"
Cohesion: 1.0
Nodes (0): 

### Community 31 - "Misc 31"
Cohesion: 1.0
Nodes (1): Home page: redirect to dashboard

### Community 32 - "Misc 32"
Cohesion: 1.0
Nodes (1): (app) layout: AppProviders wrapper

### Community 33 - "Misc 33"
Cohesion: 1.0
Nodes (1): Study set layout: StepProgressBar

### Community 34 - "Misc 34"
Cohesion: 1.0
Nodes (1): /parse legacy redirect to source

### Community 35 - "Misc 35"
Cohesion: 1.0
Nodes (1): /practice redirect to play

### Community 36 - "Misc 36"
Cohesion: 1.0
Nodes (1): GET /api/ai/vision-test-image: static test PNG

### Community 37 - "OCR and layout chunks 37"
Cohesion: 1.0
Nodes (1): OcrInspector: IndexedDB OCR run viewer + chunk parse debug

### Community 38 - "AI parse UI and progress 38"
Cohesion: 1.0
Nodes (1): ParseProgressContext: live parse report state

### Community 39 - "Misc 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "OCR and layout chunks 40"
Cohesion: 1.0
Nodes (1): layoutChunksFromOcr: OCR blocks→layout chunks + user content for chunk parse

### Community 41 - "Misc 41"
Cohesion: 1.0
Nodes (1): visionStagingStore

### Community 42 - "Play and flashcards 42"
Cohesion: 1.0
Nodes (1): FlashcardSessionState: in-memory snapshot type

## Ambiguous Edges - Review These
- `splitMathSegments` → `parseJob types`  [AMBIGUOUS]
  src/lib/math/splitMathSegments.ts · relation: conceptually_related_to

## Knowledge Gaps
- **22 isolated node(s):** `Home page: redirect to dashboard`, `(app) layout: AppProviders wrapper`, `Study set layout: StepProgressBar`, `/parse legacy redirect to source`, `/practice redirect to play` (+17 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Misc 26`** (2 nodes): `POST /api/ai/forward: provider-keyed upstream proxy`, `Upstream chat/completions HTTP endpoint (dynamic URL)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 27`** (2 nodes): `reportPipelineError`, `runVisionSequential`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 28`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 29`** (1 nodes): `RawTextViewer.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 30`** (1 nodes): `parseJob.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 31`** (1 nodes): `Home page: redirect to dashboard`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 32`** (1 nodes): `(app) layout: AppProviders wrapper`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 33`** (1 nodes): `Study set layout: StepProgressBar`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 34`** (1 nodes): `/parse legacy redirect to source`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 35`** (1 nodes): `/practice redirect to play`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 36`** (1 nodes): `GET /api/ai/vision-test-image: static test PNG`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OCR and layout chunks 37`** (1 nodes): `OcrInspector: IndexedDB OCR run viewer + chunk parse debug`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `AI parse UI and progress 38`** (1 nodes): `ParseProgressContext: live parse report state`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 39`** (1 nodes): `index.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `OCR and layout chunks 40`** (1 nodes): `layoutChunksFromOcr: OCR blocks→layout chunks + user content for chunk parse`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Misc 41`** (1 nodes): `visionStagingStore`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Play and flashcards 42`** (1 nodes): `FlashcardSessionState: in-memory snapshot type`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `splitMathSegments` and `parseJob types`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `react` connect `AI parse UI and progress` to `PDF upload and extract`, `AI parse UI and progress 3`, `AI storage and reachability`, `Dashboard widgets`, `Play and flashcards`, `Select UI`?**
  _High betweenness centrality (0.187) - this node is a cross-community bridge._
- **What connects `Home page: redirect to dashboard`, `(app) layout: AppProviders wrapper`, `Study set layout: StepProgressBar` to the rest of the system?**
  _22 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AI parse UI and progress` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._
- **Should `PDF upload and extract` be split into smaller, more focused modules?**
  _Cohesion score 0.03 - nodes in this community are weakly interconnected._
- **Should `Parse and AI test` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `AI parse UI and progress 3` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._