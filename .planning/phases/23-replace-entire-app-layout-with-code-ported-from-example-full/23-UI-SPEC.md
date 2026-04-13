# Phase 23 — UI-SPEC (layout lab + example wrapper)

**Scope:** `/develop` debug lab + pattern for wrapping `example/*/code.html`; later waves port production routes.

## §1 `/develop` — structure

- **Route:** `GET /develop` under `(app)` → inherits `AppShell` (top bar, search, theme).
- **Above-the-fold:** Page title **Develop** + short helper text (`text-muted-foreground`): mocks are for **visual/debug** only; production routes unchanged until explicitly ported.
- **Chrome (shadcn):**
  - **Tabs** — group mocks: `Dashboard`, `Settings`, `Study flows`, `Play`, `Other` (exact tab list = static config array mirroring folders in §3).
  - **Card** — each preview: header row (mock display name + optional badge `example`), body = preview surface.
  - **Select** (desktop) or **Sheet** + list (mobile) — pick mock inside the tab when a tab has 2+ mocks.
  - **ScrollArea** — optional for long tab lists; **Separator** between controls and preview.
  - **Button** — `Open in new tab` → same iframe URL in `_blank` (helps compare DevTools).
- **Preview surface:** **iframe** full width, `min-h-[480px]` (or `h-[70vh]`), `rounded-md border border-border bg-background`, `title` = mock id for a11y.
- **Empty / error:** **Alert** variant destructive if slug missing or API 404; retry button.

## §2 Example wrapper — data & security

- **Source files:** Only files under `example/<slug>/code.html` where `<slug>` is in **allowlist** (§3). Reject unknown slugs → 404.
- **Delivery:** Next **Route Handler** serves HTML with `Content-Type: text/html; charset=utf-8`. No directory traversal (`..` rejected).
- **Gate:** Handler returns **404** in production **unless** `process.env.ALLOW_DEVELOP_MOCKS === '1'` (document in plan acceptance). Default `NODE_ENV === 'development'` allows read.
- **iframe:** `sandbox="allow-scripts allow-same-origin"` — document tradeoff (mock scripts run); `referrerPolicy="no-referrer"` optional.

## §3 Mock allowlist (initial)

| slug | Tab group |
|------|-----------|
| `doc2quiz_action_focused_dashboard` | Dashboard |
| `doc2quiz_ai_connection_settings` | Settings |
| `doc2quiz_refined_selection` | Study flows |
| `refined_ai_processing_workspace` | Study flows |
| `doc2quiz_professional_review_workspace` | Study flows |
| `doc2quiz_flashcard_review_workspace` | Study flows |
| `doc2quiz_immersive_quiz_play_mode` | Play |
| `doc2quiz_advanced_results_recovery_workspace` | Other |

## §4 Production port (wave 2+)

- Not part of `/develop` page: **incremental** replacement of real route layouts using tokens + patterns proven in iframe side-by-side.
- Keyboard practice routes: **must not** remove `1`–`4` answer bindings when adjusting chrome.

## §5 Verification (manual)

- `/develop` loads in `npm run dev`; at least **3** mocks render without console errors from our app shell.
- With `NODE_ENV=production` and no env override, mock API returns **404** (smoke via `npm run build` + start or unit test on handler guard).
