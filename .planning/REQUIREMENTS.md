# Requirements: Doc2Quiz

**Milestone:** v2.1 — MVP Pipeline  
**Status:** Planning  
**Source:** [docs/pipeline.md](../docs/pipeline.md)

## Overview

Multi-format ingestion → MarkItDown → Canonical Knowledge (Supabase) → Quiz or Flashcards generation → immediate save → practice. No draft/publish/sharing/quality-validation stage.

**v1.0 archive:** [`.planning/milestones/v1.0-REQUIREMENTS.md`](./milestones/v1.0-REQUIREMENTS.md)  
**v2.0 archive:** Frontend shell strip + phase 1 purge (`.planning/milestones/v2.0-phases/`)

---

## Input Zone (INPUT)

| ID | Requirement |
|----|-------------|
| INPUT-01 | User can upload PDF |
| INPUT-02 | User can upload DOCX |
| INPUT-03 | User can upload PPTX |
| INPUT-04 | User can upload XLSX/XLS |
| INPUT-05 | User can upload JPG/JPEG/PNG |
| INPUT-06 | User can upload WAV/MP3 |
| INPUT-07 | User can upload HTML |
| INPUT-08 | User can upload CSV |
| INPUT-09 | User can upload JSON |
| INPUT-10 | User can upload XML |
| INPUT-11 | User can paste plain text |
| INPUT-12 | User can submit a YouTube URL |
| INPUT-VAL-01 | System validates input type and size before conversion |

---

## Conversion (CONV)

| ID | Requirement |
|----|-------------|
| CONV-01 | Accepted inputs convert to raw Markdown via MarkItDown |
| CONV-02 | Original file (or source reference for paste/URL) is stored with the study set |

---

## Canonical Knowledge (CANON)

| ID | Requirement |
|----|-------------|
| CANON-01 | Builder cleans extraction noise and removes duplicates |
| CANON-02 | Builder preserves headings, tables, formulas, and examples |
| CANON-03 | Builder detects document language |
| CANON-04 | Builder detects content type: theory, exam, or mixed |
| CANON-05 | Builder extracts existing questions and answer keys when present |
| CANON-06 | Builder splits content into stable sections |
| CANON-07 | Builder generates title and clean filename (no invention) |
| CANON-08 | Builder never invents information not present in source |
| CANON-09 | System stores original file, raw Markdown, canonical Markdown, metadata, and sections in Supabase |

---

## Learning Mode (MODE)

| ID | Requirement |
|----|-------------|
| MODE-01 | After canonical knowledge is saved, user chooses Quiz or Flashcards |

---

## Quiz (QUIZ)

| ID | Requirement |
|----|-------------|
| QUIZ-01 | System detects testable concepts from canonical knowledge only |
| QUIZ-02 | System recommends question count based on content |
| QUIZ-03 | System generates MCQs with four options and exactly one correct answer |
| QUIZ-04 | System avoids duplicate concepts; generates fewer questions when content is insufficient |
| QUIZ-05 | Generated questions save to Supabase immediately (before review) |
| QUIZ-06 | User can review, edit, and delete generated questions |
| QUIZ-07 | User can start quiz practice from saved questions |

---

## Flashcards (FLASH)

| ID | Requirement |
|----|-------------|
| FLASH-01 | User selects learning goal: memorize, understand, or exam preparation |
| FLASH-02 | User selects coverage: entire document or selected sections |
| FLASH-03 | User selects amount: recommended or custom count |
| FLASH-04 | System auto-detects best card format |
| FLASH-05 | System generates flashcards from canonical knowledge only |
| FLASH-06 | Generated cards save to Supabase immediately |
| FLASH-07 | User can start flashcard learning from saved cards |

---

## Platform (CORE)

| ID | Requirement |
|----|-------------|
| CORE-AUTH-01 | User can log in and remain authenticated across sessions |
| CORE-AUTH-02 | User can log out from the app shell |
| CORE-DASH-01 | User can view a dashboard listing their study sets |
| CORE-DASH-02 | User can open a study set to practice or continue generation |
| CORE-PRAC-01 | User can answer quiz questions with keyboard 1/2/3/4 |
| CORE-PRAC-02 | User sees end-of-session score summary |
| CORE-MIST-01 | User can run mistakes-only drill from wrong answers |

---

## Localization (LOCALE)

| ID | Requirement |
|----|-------------|
| LOCALE-01 | User-visible product chrome supports complete English and Vietnamese catalogs for Phase 6 contexts |
| LOCALE-02 | User can explicitly choose EN or VI from account and Settings UI |
| LOCALE-03 | Locale preference persists in validated browser storage and synchronizes across tabs |
| LOCALE-04 | Locale applies without SSR hydration mismatch and updates document language after hydration |
| LOCALE-05 | Locale changes preserve routes, study content, keyboard behavior, accessibility, functionality, and layout |

---

## Contextual Slang (SLANG)

| ID | Requirement |
|----|-------------|
| SLANG-01 | Structured EN/VI slang catalogs cover loading, upload, conversion, quiz generation, flashcard generation, correct, wrong, retry, success, empty, warning, streak, score, navigation, toast, progress, result, badge, and secondary-label contexts |
| SLANG-02 | Contextual slang avoids immediate consecutive repeats and supports deterministic selection tests |
| SLANG-03 | Literal product copy remains primary and slang appears only as optional supporting copy where comprehension permits |
| SLANG-04 | Slang never appears in destructive, privacy, authentication, account recovery, accessibility, serious-error, hostile, shaming, or identity-targeting copy |

---

## Information Architecture (IA)

| ID | Requirement |
|----|-------------|
| IA-01 | App uses the singular, setId-based `/quiz/*` and `/flashcard/*` canonical route tree; legacy `/edit/*`, `/sets/*`, `/flashcards/*`, `/done`, and query-based mistake paths are removed without redirects |
| IA-02 | `/create` selects Quiz or Flashcard and each type-specific create route runs the shared Source → Convert → Generate → Review pipeline without duplicating conversion logic |
| IA-03 | Dashboard cards open type-specific set overviews with status-driven actions, metadata, and at most three safe compact preview items |
| IA-04 | `/dashboard` uses URL query parameters as the sole source of truth for type, search, sort, status, and practice filters, normalizing missing or invalid type to `all` |
| IA-05 | Authenticated desktop navigation uses a persistent, user-collapsible sidebar and slim contextual top bar; mobile uses bottom navigation only on top-level pages and contextual bars on nested workflows |
| IA-06 | Play and mistake-drill routes hide persistent navigation and provide Exit; results routes restore the normal shell and expose completion, retry, drill, edit, and dashboard actions |
| IA-07 | Quiz and flashcard review and edit remain distinct canonical pages while sharing existing editors and preserving generated study content |
| IA-08 | Unfinished quiz and flashcard session position persists server-side, survives reload/browser close, and drives exact smart resume with a multi-session picker when needed |
| IA-09 | Mistake practice filters the dashboard to unresolved mistakes ordered by mistake count then recency and links to type-specific `/drill-mistake` routes |
| IA-10 | In-app `/help` provides localized shortcuts, workflow guidance, and FAQ while Phase 6 locale/slang safety boundaries remain intact across all new chrome |

---

## Plans & Quota (PLAN)

| ID | Requirement |
|----|-------------|
| PLAN-01 | Free users may complete at most **10 successful study-set generations** (quiz or flashcards) per **calendar week** (Monday 00:00 UTC+7) |
| PLAN-02 | Quota is consumed on the **first successful generation per study set**; regenerating the same set does not consume again |
| PLAN-03 | Ingest and canonicalize are **not** quota-gated |
| PLAN-04 | Pro users (`resolveUserAiTier` → `pro`) have **unlimited** generations |
| PLAN-05 | Quota is enforced **server-side** in quiz and flashcard generate API routes before pipeline work runs |
| PLAN-06 | UI shows weekly usage, bonus credits, and next reset time in sidebar and Settings |
| PLAN-07 | When quota is exceeded, API returns structured `quota_exceeded` error for upgrade/redeem CTA |
| PLAN-08 | User can redeem a **coupon code** in Settings to add **bonus generation credits** |
| PLAN-09 | Each coupon code is redeemable **once per user**; a user may redeem **multiple different codes** |
| PLAN-10 | Coupon codes are case-insensitive; support optional global max redemptions and expiry |

---

## Workspaces & Canonical Provenance (WORK)

| ID | Requirement |
|----|-------------|
| WORK-01 | First uploaded source automatically creates a workspace; user may rename it later. |
| WORK-02 | Dashboard lists workspaces containing documents, canonical versions, quizzes, and flashcard sets. |
| WORK-03 | A document has immutable versions; replacing source file creates a new document version, while metadata edits do not. |
| WORK-04 | Canonical output belongs to a document version and persists its canonical version, model, prompt, parser, generator settings, and content checksum. |
| WORK-05 | Canonical content renders section-by-section with pagination or progressive loading; full documents are not mounted at once. |
| WORK-06 | Quiz and flashcard generation lets user select one or more completed canonical document versions. |
| WORK-07 | Every generated output stores frozen canonical-version snapshots and source provenance; later document changes cannot alter it. |
| WORK-08 | Documents and canonical versions soft-delete; existing outputs retain their frozen provenance and remain studyable. |
| WORK-09 | Workspace ownership is distinct from editor and viewer membership roles. |

---

## Collaboration & Sharing (COLLAB)

| ID | Requirement |
|----|-------------|
| COLLAB-01 | Workspace has owner, editor, and viewer roles; owner manages membership and sharing. |
| COLLAB-02 | Viewers can read canonical documents and study outputs; editors can add/replace source documents and create, edit, or delete outputs. |
| COLLAB-03 | Public links are permanently anonymous viewer/study access only; they never grant membership or edit access. |
| COLLAB-04 | Editor and viewer membership requires authenticated, explicit invitation; possession of a URL cannot claim membership. |
| COLLAB-05 | Users can share a workspace, individual quiz, or individual flashcard set. |
| COLLAB-06 | Anonymous quiz attempts save locally and import once after login with stable-ID deduplication; local copy clears only after confirmed import. |
| COLLAB-07 | Users send friend requests by normalized exact username; usernames are unique, requests are rate-limited, and users can block/report others. |

---

## Out of Scope (v2.1)

| ID | Excluded |
|----|----------|
| OOS-01 | Draft / publishing workflow |
| OOS-03 | Separate quality-validation stage before save (save is immediate) |
| OOS-04 | v1 client-only IndexedDB as primary store (Supabase is source of truth) |
| OOS-05 | Graphify / custom PDF rasterization pipelines (use MarkItDown) |
| OOS-06 | Stripe / paid Pro subscription (manual Pro grant via metadata in v1) |

---

## Traceability

| Requirement | Phase |
|-------------|-------|
| CORE-AUTH-01, CORE-AUTH-02 | 1 |
| CANON-09, INPUT-VAL-01 | 1 |
| INPUT-01–12, CONV-01, CONV-02 | 2 |
| CANON-01–08 | 3 |
| MODE-01, QUIZ-01–07, CORE-DASH-01–02, CORE-PRAC-* | 4 |
| FLASH-01–07, CORE-MIST-01 | 5 |
| LOCALE-01–05, SLANG-01–04 | 6 |
| IA-01–10 | 7 |
| PLAN-01–10 | 8 |
| WORK-01–09 | 9 |
| COLLAB-01–07 | 10 |

---

*Last updated: 2026-07-30 — added PLAN-01–10 (freemium + coupons)*
