# Doc2Quiz — Chaos Study Mode

> Product taste contract for UI design, copy, motion, AI prompts, and review. Vocabulary guidance comes from `dictionary/Brainrot_Slang.md` and `dictionary/Slang_Dictionary.md`.

---

## Core vibe

**Academic panic, but make it fun.**

Doc2Quiz feels like a smart classmate helping you speedrun revision at 1:47 AM: playful, meme-aware, bilingual, slightly chaotic, still fast and readable.

**Personality:** Funny · Chaotic · Self-aware · Internet-native · Useful  
**Register:** Product UI — design serves study flow  
**Rule:** **Workflow clean. Personality chaotic.**

Chaos lives in reactions, annotations, loading copy, empty states, and small moments. Navigation, forms, primary actions, errors, privacy, and accessibility stay literal.

---

## Scene

A tired student under harsh desk light has an exam tomorrow, twelve tabs open, and one usable PDF; Doc2Quiz helps them turn panic into a clean next action without pretending the panic is not funny.

---

## Visual direction

- Bright mint base with white surfaces.
- Oxblood remains primary CTA and authority color.
- Coral appears more aggressively in reactions, active states, stamps, and annotation marks.
- Electric lime or cyan acts as a secondary signal, never a competing primary CTA.
- Black marker-style arrows, circles, underlines, ticks, and stamps may annotate meaningful content.
- Cards may feel slightly uneven through controlled rotation, offset, overlap, or sticker placement.
- Clean product UI forms the base layer. Chaotic annotation forms the personality layer.
- Intentional misalignment is local and reversible; core layout remains aligned to the grid.
- No corporate SaaS polish.
- No childish cartoon dashboard.
- No generic neon gamer UI.

### Chaos budget

Use one dominant chaotic gesture per viewport cluster:

- one stamp,
- one marker annotation,
- one rotated sticker,
- or one playful reaction.

Do not stack all four around every card. If everything shouts, nothing lands.

---

## Palette

| Role | Light | Dark | Use |
|---|---|---|---|
| Mint base | `#f7faf8` | `#0c1a17` | Main background |
| White surface | `#ffffff` | `#134e4a` | Primary work surfaces |
| Ink | `#181c1b` | `#ecfdf5` | Body text and marker marks |
| Muted ink | `#404945` | `#94d3c0` | Supporting copy; maintain WCAG AA |
| Oxblood | `#5f0f00` | `#ff967d` | Primary CTA, authority, wordmark |
| Coral | `#ff967d` | `#ff967d` | Reactions, active states, stamps, focus |
| Forest | `#376757` | `#34d399` | Structure, links, secondary actions |
| Mint signal | `#baeed9` | `#115e59` | Selected and supportive surfaces |
| Electric signal | `#b7f34a` or `#22d3ee` | same role-adjusted | Rare secondary signal: streak, success, live state |
| Destructive | `#ba1a1a` | `#f87171` | Errors only; never joke color |

### Color rules

- Oxblood owns primary actions.
- Coral can occupy more space than before, but remains semantic: active, reaction, focus, annotation.
- Electric lime/cyan appears on no more than one signal family per screen.
- Black marker accents must not obscure text or controls.
- Warm cream, beige, purple gradients, and gradient text remain out of register.
- Body and placeholder text require at least 4.5:1 contrast.

---

## Typography

### Families

- **Manrope:** body copy, controls, data, standard headings.
- **Space Grotesk:** labels, navigation accents, stamps, compact status text.
- **Expressive display font:** headlines, stickers, empty states, and occasional completion moments only.

Expressive font must be readable, locally hosted or loaded through established font tooling, and never used for body copy, fields, buttons, errors, or dense data.

### Scale and behavior

- Product UI uses fixed rem steps for controls and common headings.
- Large compressed headlines are allowed on empty, loading, onboarding, and completion surfaces.
- Display headline max: `6rem`; normal app-page headline usually `2.5rem–4rem`.
- Display letter-spacing floor: `-0.04em`.
- Use `text-wrap: balance` on headings and `text-wrap: pretty` on prose.
- Body copy stays within 65–75ch.
- Occasional rotation between `-2deg` and `2deg` is allowed for stickers, stamps, labels, or display fragments.
- Never rotate or distort body copy, form labels, answers, error messages, or critical instructions.

### Voice contrast

Clean Manrope text carries task comprehension. Expressive type carries emotional punctuation. Never make users decode the workflow.

---

## Layout

- App pages should fill available canvas width. Do not center a narrow content island inside desktop workspace unless content is intentionally reading-focused.
- Workspace detail, dashboard, create, and import surfaces use compact `12–24px` page padding and `16–24px` section rhythm.
- Let primary content expand; constrain prose blocks, not whole application surfaces.
- Empty states should teach and invite the next action while using useful working area.

### Existing layout contract

- Keep 4px spacing grid for workflow structure.
- Forms, navigation, quiz answers, and primary action rows align cleanly.
- Annotation layers may break alignment without changing content geometry.
- Use controlled overlap for stickers and stamps; never cover interactive targets.
- Slight card tilt is allowed on hover or highlighted states, generally within `±1deg`.
- Structural cards retain 12–16px maximum radius.
- Pills remain for badges, reactions, and compact status only.
- No nested cards.
- Responsive layout removes or flattens annotations before compressing task content.
- Mobile keeps at least 44px touch targets and avoids decorative overflow.

---

## Surfaces and graphic language

### Product layer

- Bright mint canvas.
- White or deep-forest surfaces.
- Strong, legible borders.
- Compact tool density.
- Familiar tabs, inputs, buttons, dialogs, and progress states.

### Annotation layer

Allowed when tied to meaning:

- marker underline under current focus,
- hand-drawn circle around a score or warning,
- arrow pointing to next action,
- stamped success or retry reaction,
- taped/offset label for temporary status,
- small doodle in empty space.

Avoid crude scene illustrations, fake paper grain, decorative CSS grids, repeating diagonal stripes, or random scribbles. Marker marks should feel authored, not generated filler.

---

## Motion

**Fast, punchy, state-driven. No constant animation.**

### Motion vocabulary

- Fast snap: `100–160ms` for press and selection.
- State transition: `160–240ms` for tabs, fields, and status changes.
- Sticker pop: `220–320ms`, one scale overshoot maximum; no elastic loop.
- Success stamp: quick scale/rotation arrival, settle once.
- Error: short horizontal nudge, then stop.
- Card hover: translate `-1px` to `-2px`, rotate within `±1deg`.
- Progress: useful status first, rotating joke second.

Use `cubic-bezier(0.22, 1, 0.36, 1)` or another ease-out-quint/expo curve. Avoid bounce and elastic easing.

### Motion rules

- Motion communicates loading, selection, success, error, or relationship.
- No page-load choreography for routine product screens.
- No animation that blocks interaction.
- No continuous floating, spinning decoration, or ambient sticker movement.
- All motion requires `prefers-reduced-motion` fallback: color-only, crossfade, or instant state.

---

## Copy voice

Use Vietnamese and English naturally. Sound like a helpful classmate, not a brand account trying to sound young.

### Voice ratio

- Default UI: 70% clear product language, 30% chaos.
- Loading rotation: 40–60% chaos after useful status appears.
- Correct reaction: 30–50% playful.
- Wrong reaction: 15–30% playful; never shame.
- Empty state: 30–50% playful with a clear next action.
- Primary CTA: 0–10% slang.
- Errors, destructive actions, privacy, account recovery, and accessibility instructions: 0% slang.
- Easter eggs may reach 80–100% slang but must remain optional.

### Approved voice examples

- “Drop file vô đây”
- “PDF đang bị cook”
- “Đợi tí bro, đang đọc đề”
- “Quiz ready. Lock in.”
- “Sai câu này hơi đau nha”
- “Bro cooked.”
- “Nah, chạy lại.”
- “Easy clap.”
- “Học tiếp hay nghỉ giả vờ?”
- “Source này sus. Check lại.”
- “10 câu nữa thôi, trust.”

### Copy rules

- Buttons remain understandable: `Upload file`, `Create quiz`, `Try again`, `Review mistakes`.
- Supporting copy may add personality: `Let it cook`, `Lock in`, `Easy clap`.
- Every error answers what happened and what to do next.
- Do not use slang that blames ability: avoid `skill issue` as direct user feedback.
- Do not use identity-targeting, sexual, racist, ableist, or hostile language.
- Treat fast-expiring memes such as `6-7`, Italian brainrot, and similar terms as rare easter eggs.
- Rotate jokes; repeated slang becomes corporate immediately.
- Consult `dictionary/Brainrot_Slang.md` for lines and `dictionary/Slang_Dictionary.md` for meaning, tone, and safe placement.

---

## Product vocabulary

| Standard workflow | Chaos Study Mode |
|---|---|
| Upload | Upload |
| Processing | Let it cook |
| Ready | Lock in |
| Streak | Locked-in streak |
| Wrong answer | Missed / humorous supporting reaction |
| Retry | Try again / Run it back |
| Empty library | No study sets yet + meme-like supporting caption |

Progress sequence:

**Upload → Let it cook → Lock in**

Keep technical phase names available to screen readers, logs, and detailed status surfaces.

---

## UI patterns

### Loading

Show a useful status line first, then optional rotating personality:

- `Extracting text…` / `PDF đang bị cook`
- `Finding key concepts…` / `Đang moi lore từ tài liệu`
- `Writing questions…` / `10 câu nữa thôi, trust.`

Loading humor never replaces progress, expected duration, or recovery action.

### Success

- One stamp or reaction.
- Confirm saved outcome.
- Offer one clear next action.
- Examples: `Quiz ready. Lock in.` or `Easy clap. 20 questions saved.`

### Error

- Brief horizontal nudge allowed.
- Literal headline and recovery action.
- Personality only after clarity: `This source couldn't be read. Try another file.` followed by `Source này sus. Check lại.`

### Wrong answers

- Explain correct answer first.
- Optional reaction follows.
- Never mock persistent difficulty or use humiliation as motivation.

### Empty states

- Teach what belongs here.
- Include one primary action.
- Add one doodle or caption, not a full illustrated scene.

---

## Instrument status (AI / connectivity pill)

**Role:** A compact readout in app chrome — not marketing, not a hero metric. Answers one question: *can the server reach the AI provider right now?*

### Scene

Student glances at the top bar between uploads. They need a traffic light, not a DevOps dashboard.

### Anatomy

- **Pill:** `font-label` / semibold sentence case, `rounded-full`, `h-8`, `max-w-[12.5rem]` with truncate — border tint only, no shadow stack.
- **Dot:** 8px circle left of label; color = state. Never hue-only: pair with pill text.
- **No tooltip.** All copy lives on the pill. `title` only for truncated not-wired setup hint.
- **Interaction:** Click re-tests; spinner replaces dot during flight.

### States

| State | Dot token | Pill label |
|---|---|---|
| Checking | muted (hidden; spinner) | Random line from `API_STATUS_CHECKING` by click tier |
| Live (idle) | `chart-2` / forest | `AI` — dot reflects silent ping, no status word |
| Live (after tap) | `chart-2` + soft glow | Random line from `API_STATUS_SUCCESS` by click tier |
| Not configured | `chart-3` / coral | Random setup line (`Chưa cấu hình`, …) |
| Unreachable | `destructive` | Random down line |

**No latency in pill.** Ever.

### Copy voice (this surface)

- **Before first user tap:** pill stays `AI` — dot only reflects silent dashboard ping (no `Live`, no ms).
- **Dashboard entry:** one silent background ping per visit; updates dot + cache only, no label change.
- **On tap (checking → success):** escalating VN/EN chaos from `dictionary/ApiStatusSpam_Lines.ts`:
  - Click 1: checking → success tier 1 (`đang check rồi thằng l` → `bố mày chạy ngon con ơi`)
  - Click 2: tier 2 (`check nhiều thế thằng l` → `bố vẫn chạy ngon con ơi`)
  - Click 3+: tier 3 (`đừng check nữa thằng l ơi` → `bố chạy ngon mà con ơi huuhuhu`)
- Each tier: **10 variants** (5 VI + 5 EN), picked at random.
- **Never** joke on `Not wired` (setup) or hard failures — random literal setup/down lines only.

### Tokens and type

- Labels: `text-[11px] font-semibold tracking-tight`, sentence case, truncate.
- Colors: `bg-chart-2`, `bg-destructive`, `bg-chart-3` — **no** raw Tailwind default palette.
- Engaged live pill: `border-chart-2/40`, `text-chart-2`.

### Motion

- Dot fade ↔ spinner swap: `150ms` ease-out; `motion-reduce:animate-none`.
- One-shot dot scale (`d2q-status-dot-pop`) on state change — 150ms ease-out-quint.
- Pill label crossfade (`d2q-status-pill-label-in`) on copy swap — 180ms ease-out.
- No pulse loops on the live dot.

### Easter egg (redundant taps while live)

- Copy on the pill from `dictionary/ApiStatusSpam_Lines.ts` — 3 tiers × 10 lines (checking + success each).
- Escalates by user-initiated click count while status stays `ok`.

### Accessibility

- `aria-label="AI connection status"` on trigger.
- `aria-live="polite"` region announces result after check completes.
- Tooltip is supplementary; status must be readable from pill + live region.

### Hard bans (this control)

- Raw millisecond dumps as the only label on first paint (`1462ms` before context).
- Generic `UI only` / `Frontend shell` placeholder when ping API exists.
- Disabling the pill for entire multi-second ping.
- Technical jargon in the pill (`AI agent`, `pong`, HTTP codes).

---

## Wordmark direction

No final logo required.

Start wordmark-first:

- `Doc2Quiz` in bold, controlled distorted display type.
- Hand-drawn underline or circled `2`.
- Optional folded document corner merging into a quiz tick.
- Readable at top-bar and favicon sizes.
- Funny and chaotic without becoming a cartoon mascot.

---

## Hard bans

- Corporate SaaS gradients or generic glass cards.
- Childish cartoon dashboard treatment.
- Gradient text.
- Side-stripe accent borders.
- Decorative grid backgrounds unrelated to a workbench/canvas.
- Repeating diagonal stripe backgrounds.
- Cards with both 1px border and wide soft shadow.
- Structural card radii above 16px.
- Random doodles with no informational role.
- Constant animation or attention-seeking loops.
- Slang in primary error, destructive, privacy, payment, account, or accessibility copy.
- Chaotic layout that changes reading order or hides controls.
- Meme references that require cultural knowledge to complete a task.

---

## AI and design prompt block

```text
Doc2Quiz taste — Chaos Study Mode:
- Core vibe: academic panic, but make it fun
- Smart bilingual classmate helping a student speedrun revision at 1:47 AM
- Bright mint base, white surfaces, oxblood primary CTA
- Coral for reactions and active states; one electric lime/cyan signal family
- Clean product workflow underneath a sparse marker/sticker annotation layer
- Manrope UI, Space Grotesk labels, one expressive display face for headlines/stickers only
- Large compressed headlines allowed; body text never distorted
- Controlled rotation between -2deg and 2deg on stickers/stamps only
- Fast snaps, sticker pops, one success stamp, short error nudge; no constant animation
- Vietnamese + English supporting copy; primary buttons and critical messages stay literal
- 70% clear product language, 30% chaos
- Workflow clean. Personality chaotic.
- WCAG AA, keyboard-first, reduced-motion safe
- No corporate SaaS polish, childish cartoon UI, gradients, glassmorphism, or random doodles
```

---

## Review checklist

Before shipping a surface:

1. Can users understand the next action without reading slang?
2. Is workflow geometry clean before annotations are added?
3. Does screen use one memorable chaos gesture rather than many weak ones?
4. Are primary controls familiar, aligned, and fully stateful?
5. Does playful copy support rather than replace useful information?
6. Could any reaction feel shaming, hostile, or inaccessible?
7. Does motion stop quickly and respect reduced motion?
8. Are expressive type and rotation kept away from body copy and controls?
9. Does coral/electric signal communicate state rather than decorate?
10. Does it feel like Doc2Quiz, not a corporate SaaS app wearing meme stickers?

---

*Last updated: 2026-07-26. Sources: project implementation, `dictionary/Brainrot_Slang.md`, `dictionary/Slang_Dictionary.md`, Chaos Study Mode direction, instrument-status pill (API ping).*
