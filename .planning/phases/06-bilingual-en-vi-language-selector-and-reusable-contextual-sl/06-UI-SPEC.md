---
phase: 06
slug: bilingual-en-vi-language-selector-and-reusable-contextual-sl
status: draft
shadcn_initialized: true
preset: b2fA
created: 2026-07-26
---

# Phase 6 — UI Design Contract

> Visual and interaction contract for bilingual EN/VI controls and contextual supporting copy. Preserve current routes, functionality, component hierarchy, responsive geometry, and visual identity; no broad redesign.

---

## Design System

| Property | Value |
|----------|-------|
| Tool | shadcn |
| Preset | `b2fA` — base-nova, Base UI, neutral base, subtle menu accent |
| Component library | Existing shadcn/Base UI primitives; reuse `DropdownMenu`, `Select` or `RadioGroup`, `Card`, `Badge`, `Alert`, `Progress`, `Dialog`, and Sonner |
| Icon library | Lucide |
| Font | Existing Manrope body/controls and Space Grotesk label treatment through project font variables; do not introduce new font |

### Existing-System Contract

- Reuse tokens from `src/app/globals.css`; add no parallel palette or phase-specific theme.
- Preserve current app-shell height, search width, avatar trigger, cards, grids, progress shell, quiz Stitch theme, flashcard geometry, toast placement, and mobile bottom-navigation structure.
- Keep existing structural radii. New selector surfaces use current control radius; no radius above 16px.
- Use existing focus ring token `--ring: #ff967d`; never remove visible focus.
- Translate app shell and listed-context chrome only. Study-set titles, filenames, source/canonical text, MCQ stems/options/explanations, flashcard fronts/backs, and dynamic technical error detail remain unchanged.
- New visual element count stays minimal: one reusable `LanguageSelector` and one optional supporting-copy line. No decorative redesign.

---

## Spacing Scale

Declared values (multiples of 4):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon-to-label gaps, compact status spacing |
| sm | 8px | Dropdown item internals, option gaps, supporting-copy offset |
| md | 16px | Standard control groups and card content gaps |
| lg | 24px | Settings card padding and section separation |
| xl | 32px | Existing page-group separation only |
| 2xl | 48px | Existing major section breaks only |
| 3xl | 64px | Existing page-level/header rhythm only |

Exceptions:

- Interactive controls and rows: minimum 44px hit target, including account-menu language row, EN/VI options, Settings selector options, and mobile controls.
- Account dropdown keeps current `min-w-48` baseline but may use a bounded width of `min(18rem, calc(100vw - 24px))` when needed for clear language labels. Do not increase top-bar height.
- Compact language group uses 8px internal gap and 8px inset rhythm; no nested card around selector.
- Supporting-copy spacing uses only 8px or 16px: 8px top gap after literal description and 16px minimum gap before next interactive region when it creates a separate line. No 12px spacing value is permitted.

---

## Typography

Exactly four sizes and two weights govern new or modified Phase 6 chrome:

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Compact label / badge | 12px | 600 | 1.25 |
| Body / control | 14px | 400 | 1.5 |
| Section heading | 16px | 600 | 1.25 |
| Page/result heading | 28px | 600 | 1.2 |

- Allowed weights: regular 400 and semibold 600 only for new Phase 6 UI. Existing stronger weights remain unchanged where already part of page geometry.
- Literal status, action, warning, and explanation text uses Manrope/body treatment.
- Compact category labels may use existing `font-label`/Space Grotesk treatment; language names, buttons, errors, and accessibility instructions must not use uppercase marker styling.
- Supporting slang is 12–14px, 400, line-height 1.5, muted foreground. Never larger or heavier than literal message it supports.
- Use `text-wrap: balance` for headings and `text-wrap: pretty` for descriptions. Do not truncate meaningful settings, error, recovery, or feedback copy.

---

## Color

| Role | Value | Usage |
|------|-------|-------|
| Dominant (60%) | `#f7faf8` / dark `#0c1a17` | Main canvas and unchanged page backgrounds |
| Secondary (30%) | `#ffffff`, `#ebefed` / dark `#134e4a`, `#1e3d36` | Cards, dropdown, Settings preference surface, progress and result surfaces |
| Accent (10%) | Oxblood `#5f0f00`, coral ring `#ff967d`, selected mint `#baeed9` | Primary CTA, selected EN/VI state, active feedback, focus ring, one semantic status family |
| Destructive | `#ba1a1a` / dark `#f87171` | Delete and serious error states only |

Accent reserved for: primary actions; selected language state; keyboard focus ring; correct/current semantic feedback already using project tokens; one existing streak/success/live signal family per screen.

- Language selection cannot rely on color alone: selected option includes check icon or selected indicator plus explicit text.
- Body, placeholder, supporting slang, badges, and controls meet WCAG AA: 4.5:1 for normal text, 3:1 for large text and non-text control boundaries.
- Slang does not receive destructive color. Serious errors use destructive styling with literal copy only.
- Preserve existing dark-mode tokens. No raw Tailwind color added where semantic token exists.

---

## Language Selector Contract

### Account Menu

Order is fixed:

1. Existing compact AI status on small screens, when present.
2. `Language` / `Ngôn ngữ` group.
3. Explicit options `English (EN)` and `Tiếng Việt (VI)`.
4. `Settings` / `Cài đặt` as normal navigation item.
5. Separator.
6. `Log out` / `Đăng xuất` as final literal action.

- Language is understandable before interaction; do not expose a bare globe icon or unlabeled `EN/VI` toggle.
- Preferred compact pattern: non-interactive group label followed by two menu-compatible 44px options with one visible selected marker. Selection updates in place and keeps menu behavior predictable; closing after selection is acceptable if Base UI default does so.
- Do not nest another popover/submenu inside current cramped dropdown. Avoid lateral submenu overflow on 375px screens.
- Keep dropdown within viewport with 16px edge clearance. Option labels remain one line at 14px; use concise canonical names above rather than abbreviating to ambiguous single codes.
- Preference focal point: `Language` / `Ngôn ngữ` group label plus visible selected-locale marker. `Settings` and `Log out` remain subordinate rows with separate current behavior; language choice must not visually merge with either.
- Keyboard: avatar trigger opens menu; arrows traverse all actionable rows; Enter/Space selects language; Escape closes; focus returns to avatar trigger. Selected state exposed through primitive semantics (`aria-checked`, `aria-selected`, or radio-menu equivalent).

### Settings

- Add one Application preference row/card before export/dev panels.
- Label: `Language` / `Ngôn ngữ`.
- Description: `Choose the language used for app controls and messages.` / `Chọn ngôn ngữ cho điều khiển và thông báo trong ứng dụng.`
- Show full options `English (EN)` and `Tiếng Việt (VI)` in a reusable labeled control. No slang.
- Preference focal point within Application preferences: `Language` / `Ngôn ngữ` heading plus visibly selected option. Description and other Application settings remain subordinate.
- At desktop, options may sit inline if both fit without compression. At 375px, stack options full-width; each stays at least 44px high.
- Change applies immediately. No Save button, reload prompt, route change, or confirmation toast required.

### Preference and Hydration

- Storage key is validated localStorage (`doc2quiz.locale` per plans); only `en` and `vi` are accepted.
- Cross-tab `storage` events update visible locale and selected state without navigation or auth changes.
- Server and first client render use English. Stored preference applies after hydration; no randomized slang during SSR or first hydration render.
- After locale applies, update `document.documentElement.lang` to `en` or `vi`.
- Account and Settings selectors always reflect same provider state.

---

## EN/VI Geometry Contract

- Language change must not alter top-bar height, card dimensions, grid columns, quiz answer geometry, flashcard dimensions, progress-step order, bottom-nav height, or primary action ordering.
- Test minimum viewport: 375px wide. Also verify desktop at 1440px.
- Fixed compact labels such as badges and mobile navigation use curated short translations. Never reduce font below 12px or touch target below 44px to force fit.
- Buttons: allow intrinsic width inside existing wrapping action groups; primary action remains first. If row already supports wrapping, preserve its break behavior. Do not create new horizontal scroll.
- Descriptions, empty-state bodies, progress subtitles, feedback explanations, and toast descriptions may wrap to two or more lines using `text-pretty`; containers grow vertically without overlap.
- Headings use balanced wrapping and existing max widths. No manual `<br>` tied to one locale.
- Badges remain single line. Use concise labels and preserve `whitespace-nowrap`; no ellipsis for status meaning.
- Dashboard card titles and user content retain existing line clamping. Translated chrome must not consume title space or alter card min-height.
- Account dropdown options remain one line. Settings description may wrap.
- Toast width remains Sonner default/current responsive width. Literal title occupies first line; optional slang goes in description, never concatenated into an unbreakable string.
- Number formatting changes visible representation only; preserve raw calculations and reserve existing tabular-number geometry.

---

## Message Hierarchy

Every eligible surface follows this order:

1. **Literal state or outcome** — required, localized, visually primary, assistive source of truth.
2. **Useful detail or explanation** — required when needed for comprehension or recovery.
3. **Optional contextual slang** — visually secondary, post-hydration, `aria-hidden` unless it conveys non-duplicated meaning (which should be avoided).
4. **Clear action** — literal verb + noun; never slang-only.

| Surface | Primary literal layer | Secondary layer | Slang rule |
|---------|-----------------------|-----------------|------------|
| Upload / conversion / generation | Current operation and step | Format/count/progress detail | One line after status; rotate only when workflow step/status changes |
| Toast | Factual outcome or problem | Recovery/action detail | Success/info only; error and destructive toasts get none |
| Quiz correct feedback | `Correct` plus explanation | Optional praise | Select on answer reveal; stable until next answer |
| Quiz wrong feedback | `Incorrect` plus correct answer/explanation | Gentle encouragement | Appears after explanation; no blame, score penalty joke, or ability judgment |
| Flashcard practice | Literal side/progress/navigation | Optional completion/support line | Never in front/back announcement or keyboard instruction |
| Results | Completion, score, saved state | Optional result reaction | One event-stable line; score stays primary |
| Dashboard empty state | What belongs here and next action | Optional playful caption | Select once when empty state activates; hover/reveal must not rotate it |
| Badges / streaks / stats | Literal status/value | Optional short embellishment | Value/state change only; do not enlarge badge or replace label |
| Navigation / command palette | Literal destination/action | None required | No slang needed for wayfinding |
| Warning | Actionable literal warning | Optional safe support only for noncritical warning | Omit when severity or interpretation is uncertain |
| Error / destructive / auth / privacy / recovery / accessibility | Literal problem, consequence, and recovery | Technical detail when safe | Zero slang |

### Rotation and Motion

- Rotate slang only on semantic transitions: context change, real workflow step, answer reveal, retry, success, value/state change, or session completion.
- No timer rotation. No rotation on hover, resize, theme switch, locale-neutral rerender, progress repaint, or animation frame.
- Copy changes use existing state transition behavior; no added entrance choreography. If a one-shot transition exists, duration stays 160–240ms.
- `prefers-reduced-motion: reduce` makes changes instant or color-only. No bounce, pulse loop, marquee, or continuous slang animation.

---

## Copywriting Contract

| Element | English | Vietnamese |
|---------|---------|------------|
| Language label | Language | Ngôn ngữ |
| Settings option description | Choose the language used for app controls and messages. | Chọn ngôn ngữ cho điều khiển và thông báo trong ứng dụng. |
| Primary creation CTA | Create study set | Tạo bộ học |
| Primary quiz CTA | Start quiz | Bắt đầu quiz |
| Primary flashcard CTA | Start flashcards | Bắt đầu flashcard |
| Empty state heading | No study sets yet. | Chưa có bộ học nào. |
| Empty state body | Add study material to create your first set. | Thêm tài liệu học để tạo bộ đầu tiên. |
| Generic serious error | We couldn’t complete this action. Try again. | Không thể hoàn tất thao tác này. Hãy thử lại. |
| Delete confirmation | Delete study set? This removes the set and all its data. This cannot be undone. | Xóa bộ học? Thao tác này sẽ xóa bộ học và toàn bộ dữ liệu. Không thể hoàn tác. |
| Delete actions | Keep study set / Delete study set | Giữ bộ học / Xóa bộ học |

- Primary literal copy remains understandable without slang. Primary CTA slang allowance is zero for this phase.
- Use one consistent product term per locale. Keep recognizable product-mode names `Quiz` and `Flashcards` where concise labels reduce width risk; explanatory Vietnamese belongs in nearby body copy when needed.
- Every error states what happened and next step. Preserve dynamic server detail verbatim beneath localized stable framing; never translate by substring.
- Never translate user/source/generated study content.
- Forbidden slang classes: destructive, privacy, authentication, account recovery, accessibility, serious error, hostile, shaming, identity-targeting, sexual, racist, ableist, coarse/profane, or comprehension-critical copy.

---

## Component Contracts

### `LanguageSelector`

- Reusable modes: `compact` for account menu and `full` for Settings.
- Inputs derive from locale provider; no independent local state except primitive interaction state.
- Explicit options and selected semantics required. No third locale, automatic browser-language option, or flags.
- Compact mode fits bounded account dropdown. Full mode owns visible label and description.

### `LocalizedSlangLine` / Supporting Slot

- Plain text only; no Markdown and no `dangerouslySetInnerHTML`.
- Render after hydration and only when context allows it.
- Style: muted foreground, 12–14px, regular weight, 1.5 line-height, max prose width, `aria-hidden="true"`.
- Error/disabled/forbidden state suppresses slot and removes its spacing.

### Shared Progress

- Existing title remains `aria-live="polite"`; optional slang is outside live region.
- Literal title, subtitle, progressbar label, and step-list label localize together.
- Supporting slot appears below subtitle and before progress bar without reordering steps/footer.
- Error state removes supporting slang.

### Feedback and Results

- Explanation precedes reaction in DOM and visual reading order.
- Result score uses tabular numerals and existing hierarchy; localized labels wrap around, not through, numeric metric.
- Result slang may use existing coral/electric semantic accent, but only one signal family per screen and no contrast loss.

### Empty States, Badges, Navigation, Toasts

- Empty state retains one literal heading, teaching body, and primary action. Optional slang is one caption only.
- Badge literal status remains visible and single-line. Optional slang belongs outside badge unless a short curated secondary label fits existing geometry.
- Navigation and ARIA labels remain literal. Mobile bottom nav keeps 64px height and 44px targets.
- Toast title is factual. Optional success/info slang appears as description after factual outcome. Errors remain literal only.

---

## Accessibility and Interaction

- All locale-dependent visible control text, placeholders, labels, titles, and matching ARIA copy switch together after hydration.
- Supporting slang is not announced by default. Stable literal status owns `aria-live`; avoid repeated announcements during progress.
- Account and Settings selectors expose group label, option names, and selected state programmatically.
- Preserve quiz keys `1–4`, Enter, Space, ArrowRight; preserve flashcard Space/arrows/focus behavior; preserve command palette shortcut and routing.
- Focus order follows DOM order. Adding Language group must not trap focus or skip Settings/Log out.
- Focus ring remains at least 2px visually apparent using ring token. Color is never sole state cue.
- Touch targets are at least 44×44px. Pointer hover behavior has equivalent keyboard focus behavior.
- Reduced motion disables existing/additional movement; localization must not re-trigger page/card entrance animation.
- Literal accessibility instructions contain zero slang.

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | Existing installed primitives only; no new block required | Existing project dependency; no new source import |
| `@animate-ui` | None for Phase 6 | Not used; no vetting required |
| Third-party | None | No third-party block permitted without separate source review |

---

## Verification Contract

- Compare EN and VI at 375px and 1440px across account menu, Settings, command palette, dashboard, import/conversion/generation, quiz/flashcard review and practice, results, progress, toasts, badges, and mobile navigation.
- Pass conditions: no clipped selector option; no dropdown viewport overflow; no changed top-bar or bottom-nav height; no hidden/reordered controls; no new horizontal scroll; no primary-action displacement; no card/grid geometry regression.
- Confirm keyboard focus and selected semantics in both selectors.
- Confirm English SSR/first client render, stored VI post-hydration, `<html lang>` update, reload persistence, invalid-value EN fallback, and cross-tab sync.
- Confirm slang stays stable through unrelated rerenders and rotates only on semantic transitions without immediate repeats.
- Confirm zero slang in destructive, privacy, auth, recovery, accessibility, and serious-error surfaces.
- Confirm WCAG AA contrast in light/dark modes and reduced-motion behavior.
- Confirm routes, storage data, source/generated content, score math, session persistence, keyboard interactions, and current callbacks remain unchanged.

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
