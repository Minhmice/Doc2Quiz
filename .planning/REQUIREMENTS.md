# Requirements: Doc2Quiz

**Milestone:** v2.1 — MVP Pipeline  
**Status:** Planning  
**Source:** [docs/pipeline.md](../docs/pipeline.md)

## Overview

Multi-format ingestion → MarkItDown → Canonical Knowledge (Supabase) → Quiz or Flashcards generation → immediate save → practice. No draft/publish/sharing/quality-validation stage.

## Study Together (SOCIAL)

| ID | Requirement |
|----|-------------|
| SOCIAL-01 | An accepted friend can receive an asynchronous study challenge created from a creator-owned ready, non-deleted quiz with at least one question. |
| SOCIAL-02 | Challenge creation authorizes source access server-side and stores an immutable quiz snapshot; source edits, deletion, and ownership changes cannot alter active sessions. |
| SOCIAL-03 | A challenge stores session and participant lifecycle state, one-attempt policy, optional deadline, attempts, completion metrics, and configured result reveal policy. |
| SOCIAL-04 | Recipient can accept and immediately start through an idempotent action that creates or reopens exactly one attempt. |
| SOCIAL-05 | Recipient can decline; either participant can resume eligible in-progress work; expired/cancelled work gives an actionable unavailable state. |
| SOCIAL-06 | Recipients view score comparison only when configured reveal policy permits it; default is after both participants complete. |
| SOCIAL-07 | Study challenge and result notifications persist before realtime broadcast; unread badge is server-derived and reconcileable after reconnect. |
| SOCIAL-08 | Friends UI provides clear separate actions to remove friend, block, report, message, view profile, and study together. |
| SOCIAL-09 | `/friends` provides scalable Friends, Requests, Invites, Messages, and Blocked users destinations; topbar menu remains a compact launcher. |
| SOCIAL-10 | Chat works on mobile and desktop, can resume durable conversation history, and safely receives realtime updates. |

## Friends, Messaging & Reactions (FRIEND / MSG / SAFE / REACT)

| ID | Requirement |
|----|-------------|
| FRIEND-01 | Accepted friends can list each other through server-authorized contracts without exposing non-friends. |
| FRIEND-02 | Friend presence exposes only coarse recent-activity status to accepted, non-blocked friends. |
| FRIEND-03 | Authenticated friend routes preserve generic authorization failures and bounded safe DTOs. |
| FRIEND-04 | Navbar friend UI exposes requests, accepted friends, presence ordering, profile actions, and messaging. |
| FRIEND-05 | Friend controls remain keyboard accessible and responsive across supported layouts. |
| MSG-01 | Only accepted, non-blocked friends can create, read, or write a durable private 1:1 conversation. |
| MSG-02 | Message APIs validate bounded plain text, opaque conversation IDs, cursor pagination, and authenticated membership. |
| MSG-03 | Chat UI loads durable history, sends safe plain text, reconciles realtime updates, and cleans up subscriptions. |
| SAFE-01 | Blocks override friendship, messaging, presence, and reactions; direct social-table access remains denied. |
| SAFE-02 | Social API errors do not reveal friendship, profile, preference, or username existence to unauthorized callers. |
| REACT-01 | Reactions use a fixed server-validated allowlist with no arbitrary text, HTML, persistence, or offline replay. |
| REACT-02 | Recipients can disable or mute reactions; animation is short-lived, recipient-only, and reduced-motion safe. |


**v1.0 archive:** [`.planning/milestones/v1.0-REQUIREMENTS.md`](./milestones/v1.0-REQUIREMENTS.md)  
**v2.0 archive:** Frontend shell strip + phase 1 purge (`.planning/milestones/v2.0-phases/`)

---

## Social Scaling (SCALE)

| ID | Requirement |
|----|-------------|
| SCALE-01 | Presence heartbeats use Redis ephemeral session keys with a 60-second TTL and do not write to PostgreSQL on every heartbeat. |
| SCALE-02 | Presence heartbeats run through stateless Next.js Route Handlers at a bounded cadence near 20 seconds; multiple sessions aggregate into one user status. |
| SCALE-03 | Presence snapshots expose coarse buckets (`online`, `active_15m`, `active_today`, `offline`) and return `unknown` during stale or Redis-unavailable periods instead of falsely reporting offline. |
| SCALE-04 | Presence and current activity are returned only to authenticated accepted friends; blocked users receive no presence data. |
| SCALE-05 | Typing indicators use conversation-scoped Redis keys with a five-second TTL, refresh no more than once every two seconds, and are visible only to conversation participants. |
| SCALE-06 | Meaningful social activity is queued for batched durable upserts to `private.social_activity` every 10–30 seconds; Next.js request handlers do not own worker timers or in-process queue state. |
| SCALE-07 | Presence and typing endpoints enforce per-user/IP rate limits and return structured `429` responses with `Retry-After` when limits are exceeded. |
| SCALE-08 | Redis failures do not block durable messaging; social UI keeps last-known presence briefly, then shows `unknown`, and never increases PostgreSQL write frequency as a fallback. |
| SCALE-09 | Realtime events only invalidate or accelerate authenticated HTTP reconciliation; Redis event payloads never become direct client truth. |
| SCALE-10 | Presence friend snapshots use bounded batched Redis reads and avoid unbounded key scans such as `KEYS` in request paths. |

---

## IDE-Inspired Themes (THEME)

| ID | Requirement |
|----|-------------|
| THEME-01 | Account theme preference accepts only `system`, `vscode-dark`, `vscode-light`, `monokai`, or `high-contrast` and persists through authenticated profile authority. |
| THEME-02 | Server-known preference applies before first paint; `system` resolves to VS Code Light or Dark from OS scheme without hydration mismatch. |
| THEME-03 | Theme selection applies immediately and converges account state, document theme, optional storage, and server persistence on the latest choice across account and tab boundaries. |
| THEME-04 | Four named IDE-inspired palettes provide coherent, WCAG AA-readable semantic shell, quiz, and flashcard surfaces. |
| THEME-05 | Settings provides an accessible account-backed appearance selector with wrapped arrow-key navigation, visible state, and safe persistence feedback. |

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

## Learning Streak (STREAK)

| ID | Requirement |
|----|-------------|
| STREAK-01 | Completing at least one quiz maintains or starts a user's daily learning streak, using the client's local calendar date. |
| STREAK-02 | If the user does not complete a quiz by the end of their local day, the active streak resets to 0 and its prior length is retained as recoverable history. |
| STREAK-03 | The top navigation shows a streak icon and current streak count, positioned left of the friend icon. |
| STREAK-04 | Streak UI tiers scale in prominence: under 30 days uses a compact orange flame; 30–89 uses gold; 90–179 uses larger amber; 180–364 uses larger red-orange; 365+ uses largest purple-pink treatment. |
| STREAK-05 | During the 48 hours after a streak is lost, user can open the streak control and start recovery by completing two quizzes. |
| STREAK-06 | Completing the two recovery quizzes within the recovery window restores the exact streak length before loss. |
| STREAK-07 | A user may complete at most two streak recoveries per calendar month, measured in their client timezone. |

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
| FRIEND-01–05, MSG-01–03, SAFE-01–02, REACT-01–02 | 11 |
| SOCIAL-01–10 | 12 |
| SCALE-01–10 | 15 |
| THEME-01–05 | 16 |
| STREAK-01–07 | Unscheduled |

---

*Last updated: 2026-08-09 — reconciled Phase 11 social primitives, Phase 12 Study Together, Phase 15 scaling, and Phase 16 IDE Themes traceability*
