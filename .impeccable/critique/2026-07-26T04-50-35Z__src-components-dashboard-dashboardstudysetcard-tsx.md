---
target: dashboard quiz card
total_score: 24
p0_count: 0
p1_count: 2
timestamp: 2026-07-26T04-50-35Z
slug: src-components-dashboard-dashboardstudysetcard-tsx
---
# Doc2Quiz Dashboard Quiz Card — Design Critique

**Target:** `src/components/dashboard/DashboardStudySetCard.tsx` (ready quiz variant)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Ready badge + 4 Qs + timestamp clear; Mastered overstates progress |
| 2 | Match System / Real World | 2 | Mastered with 4 approved Qs misleads; MULTIPLE CHOICE is format jargon |
| 3 | User Control and Freedom | 3 | Rename/Delete in More menu; primary path obvious |
| 4 | Consistency and Standards | 2 | Uppercase kickers on card vs sentence-case hero CTAs |
| 5 | Error Prevention | 3 | Delete gated behind More menu |
| 6 | Recognition Rather Than Recall | 2 | Review hidden in overflow; title hover implies click that does not exist |
| 7 | Flexibility and Efficiency | 2 | No card-level click or keyboard resume; CTA precision required |
| 8 | Aesthetic and Minimalist Design | 2 | 80px decorative header + eyebrow + stats + CTA + footer = six layers |
| 9 | Error Recovery | 3 | n/a at card level |
| 10 | Help and Documentation | 2 | Ready vs Mastered distinction unexplained; Q count semantics unclear |
| **Total** | | **24/40** | **Acceptable — meaningful card refinement needed** |

## Anti-Patterns Verdict

**LLM assessment:** Borderline fail. The card still reads as a templated SaaS library tile: decorative header band, uppercase tracked kickers (MULTIPLE CHOICE, DRILL MISTAKES, MORE), misleading Mastered label, and teal-on-teal dark surfaces. Product logic (Start quiz routing, conditional Drill mistakes) saves it from full slop.

**Deterministic scan:** `detect.mjs` returned 0 findings on `DashboardStudySetCard.tsx`. Static scan missed compositional issues: empty header band, vestigial `bg-gradient-to-br`, uppercase stack.

**Browser snapshot:** Confirmed two quiz cards with Start quiz + Drill mistakes links; titles as h4; More triggers have descriptive aria-labels. Blueprint grid visible in user screenshot comes from `AppShell` `d2q-technical-grid`, not the card component.

## Overall Impression

The card knows what to do (route to quiz, surface mistake drill) but dresses like a flashcard app tile. For a long Vietnamese exam title, the decorative header and uppercase metadata compete with the one thing that matters: resume practice.

## What's Working

1. Pipeline-aware primary CTA via `dashboardCardPrimaryCtaLabel()` — Start quiz vs Open editor vs Resume practice.
2. Mistake drill as conditional secondary action when `hasMistakes && approvedCount > 0`.
3. Stable grid geometry via `line-clamp-2` title and full-height flex layout.

## Priority Issues

### [P1] Decorative header band is empty chrome
- **Why:** 80px `bg-gradient-to-br` header holds only Ready pill — no preview, no progress.
- **Fix:** Remove header band; inline status chip next to title or kind row.
- **Suggested command:** `$impeccable quieter dashboard quiz card`

### [P1] Mastered misrepresents ready state
- **Why:** 4 approved questions ≠ mastered material; erodes trust in progress signals.
- **Fix:** Ready to practice or 4 approved.
- **Suggested command:** `$impeccable clarify dashboard quiz card`

### [P2] Uppercase eyebrow stack
- **Why:** kindLabel, updatedLabel, Drill mistakes, More — anti-reference kicker pattern.
- **Fix:** Sentence case; drop tracking-widest on functional labels.
- **Suggested command:** `$impeccable typeset dashboard quiz card`

### [P2] Vestigial gradientClass prop
- **Why:** Always `bg-muted` but still applies `bg-gradient-to-br`.
- **Fix:** Remove prop and gradient utilities; flat card surface with variant border tint.
- **Suggested command:** `$impeccable distill dashboard quiz card`

### [P3] False click affordance on title
- **Why:** `group-hover:text-primary` on title but only Start quiz link navigates.
- **Fix:** Make card surface click-to-play or remove title hover color.
- **Suggested command:** `$impeccable shape dashboard quiz card`

## Persona Red Flags

**Alex:** Must hit Start quiz precisely; Review buried in More; low info density (no last score, mistake count, last attempt).

**Sam:** More trigger likely below 44px touch target (`px-1`); h4 titles without enclosing h3; `line-clamp-2` truncates long titles with no `title` tooltip; `overflow-hidden` on article may clip dropdown.

## Minor Observations

- Primary CTA hover teal to chart-4 may be imperceptible in dark mode.
- FileText icon for quiz is generic.
- Footer uneven when Drill mistakes absent (More alone right-aligned).

## Questions to Consider

1. If the card's job is resume in one click, why does 25% of height sell atmosphere?
2. What if the title were the primary control and the button were removed?
3. Does Ready on the badge plus Mastered in stats mean two different things or the same thing twice?
