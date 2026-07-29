---
target: dashboard
total_score: 22
p0_count: 0
p1_count: 3
timestamp: 2026-07-25T11-28-46Z
slug: src-app-app-dashboard-page-tsx
---
# Doc2Quiz Dashboard — Design Critique

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Skeleton grid, `aria-busy`, load errors — solid. Count-ups delay true values ~1.6s. |
| 2 | Match System / Real World | 2 | "Total assets" is dev jargon; "Mastered" overstates quiz progress. |
| 3 | User Control and Freedom | 3 | Delete confirm, skip on name prompt. No undo; hash scroll one-way. |
| 4 | Consistency and Standards | 2 | "Assets" vs "sets"; gradient candy headers vs mint/oxblood elsewhere. |
| 5 | Error Prevention | 3 | Delete gated; empty name save disabled. |
| 6 | Recognition Rather Than Recall | 2 | Search in top bar, filters in library — invisible coupling. Mobile hash tabs never highlight. |
| 7 | Flexibility and Efficiency | 1 | No keyboard shortcuts, bulk actions, or command palette on dashboard. |
| 8 | Aesthetic and Minimalist Design | 1 | Hero + stats + library each compete with motion, micro-type, chrome. |
| 9 | Error Recovery | 2 | `loadError` surfaces Supabase migration filenames — accurate, not student-facing. |
| 10 | Help and Documentation | 1 | No help on filters ("In review"), streak ring meaning, or first-run orientation. |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**LLM assessment:** Borderline fail — reads as motion-forward AI dashboard template, not "precise instrument." Decorative blueprint grid, hero-metric row, orchestrated page entrance, rotating character-reveal headline, off-palette gradient card headers, ghost-card border+shadow pairings, and glass touches on mobile nav/badges all conflict with Doc2Quiz's "Precise. Calm. Instrument-like" brief. Pipeline-aware library cards and reduced-motion gating save it from full slop.

**Deterministic scan:** `detect.mjs` returned **0 findings** across 15 dashboard source files. The static detector did not flag hero-metric scaffolding, blueprint decor, or entrance choreography — these are compositional/pattern issues visible in review and browser snapshot, not regex hits.

**Visual inspection:** Browser accessibility snapshot confirmed live dashboard structure (hero h2, stats region, library filters). Screenshot capture failed (black frame). No detect.js overlay was injected.

## Overall Impression

The dashboard has real product intelligence in the library cards — pipeline stages, mistake drills, and setup continuation are thoughtful. But every visit opens with a landing-page performance: animated greeting, three stat tiles counting up from zero, and decorative grid lines. For a solo student who wants to resume practice in one click, the chrome is louder than the task.

## What's Working

1. **Pipeline-aware library cards** — `cardVariantFor()` routes users to edit vs play vs mistakes correctly; this is product logic, not template filler.
2. **Reduced-motion discipline** — `useReducedMotion()` gates stagger, count-up, flame animation, and empty-state reveal across most components.
3. **Empty and error states have intent** — dashed create CTA, skeleton grid with `role="status"`, delete confirmation with approved-item count.

## Priority Issues

### [P1] Decorative blueprint grid violates brand anti-references
- **Why:** `DashboardBlueprintDecor.tsx` fixed rule lines are exactly the decorative grid background the design system prohibits.
- **Fix:** Remove component and import from `DashboardHomeClient.tsx`. Use content structure, not ambient lines.
- **Suggested command:** `$impeccable quieter dashboard`

### [P1] Hero metrics row is generic SaaS scaffolding
- **Why:** `DashboardStatsRow.tsx` — big animated numbers + 10px uppercase labels + hover lift matches hero-metric template. "Total assets" is wrong vocabulary.
- **Fix:** Collapse to one inline status line in hero or hide stats when `totalSets === 0`. Rename to "Study sets." Remove count-up animation.
- **Suggested command:** `$impeccable distill dashboard stats`

### [P1] Orchestrated page-load choreography blocks the task
- **Why:** Section stagger (0.22s × 3), hero 0.75s slide, stats spring scale, library card stagger — product register says no orchestrated page-load sequences.
- **Fix:** Remove section-level `motion.div` wrappers; static paint on load. Reserve motion for hover feedback ≤200ms. Static hero headline, no `VerticalCutReveal` rotation.
- **Suggested command:** `$impeccable animate dashboard`

### [P2] Gradient card headers read "flashcard candy"
- **Why:** `DECK_GRADIENTS` uses `indigo-500`, `teal-500`, `emerald-600` — off-palette and decorative.
- **Fix:** Flat `bg-muted` or single forest tint; status badge + title carry identity. Drop `backdrop-blur-md` on badges.
- **Suggested command:** `$impeccable colorize dashboard cards`

### [P2] Micro-type stack hurts scanability and accessibility
- **Why:** 8–10px uppercase labels throughout; ring center text is 8px (`DashboardStatsRow.tsx:122`).
- **Fix:** Floor labels at 12px (`text-xs`), sentence case for filters. Drop `tracking-widest` on functional labels.
- **Suggested command:** `$impeccable typeset dashboard`

## Persona Red Flags

**Alex (Power user):** Must wait through ~2s hero reveal + 1.6s stat count-ups with no skip. No keyboard shortcuts or bulk actions. Search/filter split across top bar and library header. Four redundant "create" entry points.

**Sam (Accessibility):** No page `<h1>` — dashboard uses two `<h2>` elements only. Sub-12px functional text at 8–10px. Rotating hero text inside `h2` may confuse screen readers. Status badges rely heavily on hue. Mobile nav icon targets are 24px (`size-6`), below 44px minimum.

## Minor Observations

- `StatCard.tsx` and `WeeklyActivityChart.tsx` appear unused — dead code from an abandoned stats direction.
- Error copy references `supabase/migrations/...` — correct for dev, wrong register for students.
- "Mastered" on ready cards overclaims; "Ready to practice" is more honest.
- Hero card pairs `border` + `shadow-sm` — ghost-card pattern per design system ban.

## Questions to Consider

1. If the dashboard's job is "resume studying in one click," why does the hero animate for 2 seconds before the library is the visual anchor?
2. What if stats only appeared after the first practice session — would it feel more like a workbench?
3. Why is search in the top bar but filters in the library header — is that one library or two?
4. What would "instrument-like" mean here: a dense table/list instead of a card grid with hover lift and candy gradients?
