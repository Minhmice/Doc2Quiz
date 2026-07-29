# Doc2Quiz -- Chaos Study Mode

> Academic panic, but make it fun.
> Upload PDF -- AI cooks it -- Lock in with quiz or flashcards -- Repeat mistakes till you gaslight the exam.

Doc2Quiz is a vibe shift for anyone who's ever stared at a PDF at 1:47 AM with an exam in T-minus hours and thought *doc lai thi cung nhu khong*. Instead of re-reading static files like a clown, you upload once, let the server cook, and get a keyboard-first practice surface that actually respects your time. No cap.

**Personality:** Funny -- Chaotic -- Self-aware -- Internet-native -- Useful
**Register:** Product UI -- design serves study flow
**Rule:** Workflow clean. Personality chaotic.

---

## Tldr; what dis?

| You got | We flip |
|---|---|
| A PDF of past exams, notes, or question banks | Structured quiz or flashcard set |
| Passive re-reading (cringe) | Active recall (based) |
| No idea where you weak | Mistake queue + drill loop |
| Deadline anxiety | Calm next-action energy |

**Core loop:** Upload -- Let it cook -- Lock in -- Practice -- Miss? -- Run it back

---

## Features (nocap)

- **PDF ingest** -- Drop file vo day. Server extracts text via MarkItDown, chunks it, finds the lore, and generates MCQs or flashcards in batches.
- **Keyboard-first practice** -- 1/2/3/4 maps to A/B/C/D. No mouse touching needed during the grind. Pure finger ballet.
- **Mistake drilling** -- Wrong answers go into a queue. You run it back till you own that concept. Git gud or die trying.
- **Review before trust** -- AI extraction = draft. You sanity-check before committing. Human-in-the-loop is a feature, not friction. Trust but verify, bro.
- **Bilingual UI** -- Vietnamese + English code-switching like a real study session between two hoc sinh bi no mon.
- **Chaos annotations** -- Marker-style stamps, coral reaction marks, the occasional sticker. One dominant gesture per viewport. No AI slop.
- **Instrument-status AI pill** -- A lil traffic-light dot in the chrome so you know if the server is alive. Tap it to get roasted (dung check nua thang l oi).

---

## Vibe check

Fast. Mint + oxblood. Calm surface with low-key chaotic personality in the details.
**No** generic AI SaaS cream backgrounds. **No** purple gradients. **No** glassmorphism. **No** childish cartoon dashboard.
Clean product layer underneath a sparse annotation layer. Think desk lamp at 2 AM, not a landing page.

---

## Tech stack (real talk)

| Layer | What we runnin' |
|---|---|
| **Framework** | Next.js (App Router) -- server components where it counts |
| **Language** | TypeScript -- we type our crap |
| **Styling** | Tailwind CSS v4 + tw-animate-css |
| **UI primitives** | shadcn + Base UI React |
| **Animations** | Framer Motion v12 -- fast snaps, no loops |
| **Auth** | Supabase SSR -- sync across sessions |
| **DB** | Supabase Postgres + IndexedDB cache for hybrid offline |
| **AI** | OpenAI-compatible /chat/completions -- concept extraction + MCQ gen |
| **PDF conv** | Microsoft MarkItDown (Python subprocess) |
| **Obs** | Sentry (optional) -- error capture, not telemetry spam |
| **Forms** | react-hook-form + zod |
| **Icons** | lucide-react -- no icon soup |

---

## Project layout (the tour)

```
src/
├── app/
│   ├── (app)/          # Authenticated routes: dashboard, quiz, edit, settings
│   ├── (auth)/         # Login/logout
│   └── api/            # Route handlers: AI, ingestion, quiz gen
├── components/
│   ├── dashboard/      # Home screen: hero, library, mobile nav
│   ├── quiz/           # Practice engine: questions, answers, timer
│   ├── edit/           # Review and approve AI-generated content
│   ├── upload/         # File drop zone
│   ├── flashcards/     # Flip study mode
│   ├── ui/             # Primitives: buttons, dialogs, dropdowns, badges
│   ├── layout/         # Shells, nav bars, providers
│   └── ...             # etc.
├── lib/
│   ├── ai/             # Parse chunk, run vision, quiz gen pipeline
│   ├── supabase/       # DB queries, auth helpers
│   ├── pdf/            # Extract text, render pages
│   ├── dashboard/      # Study set link builders
│   └── utils.ts        # cn(), etc.
├── hooks/              # Custom React hooks
└── types/              # TypeScript definitions
```

---

## Setup (for the uninitiated)

### Prerequisites

- **Node.js** 20+ (we on Next.js 16)
- **Python** 3.10+ (MarkItDown needs it)
- **A Supabase project** (for auth)
- **An OpenAI-compatible API endpoint** (for the AI to cook)

### 1. Clone the joint

```bash
git clone https://github.com/your-username/doc2quiz.git
cd doc2quiz
```

### 2. Install deps

```bash
npm install
```

### 3. Python venv for MarkItDown

```bash
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/python

pip install -r requirements.txt
python -m markitdown --version   # make sure it works, bro
```

### 4. Environment variables (dung skip or you're cooked)

Copy `.env.example` to `.env.local` and fill these:

| Var | What it do |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `AI_BASE_URL` | OpenAI-compatible base URL (e.g. `https://api.openai.com/v1`) |
| `AI_API_KEY` | Your API key (server-only, never leak this) |
| `AI_MODEL` | Model for MCQ gen (e.g. `gpt-4.1-mini`) |
| `MARKITDOWN_PYTHON` | Path to your venv Python (optional, auto-detects) |

Optional but based:
- `BLOB_READ_WRITE_TOKEN` -- Vercel Blob for vision staging in prod
- `SENTRY_DSN` -- Error tracking if you're into that
- `ENABLE_DEV_ENGINE_PANEL=true` -- Debug panel for AI pipeline

### 5. Apply Supabase schema

```bash
# Local Supabase:
supabase db reset

# Or paste supabase/migrations/20260725120000_v21_baseline.sql
# into the Supabase Dashboard SQL editor like a caveman
```

### 6. Run it

```bash
npm run dev
# Server starts on http://localhost:3000
# Go forth and cook
```

---

## Available commands

| Command | What it do |
|---|---|
| `npm run dev` | Dev server (custom script) |
| `npm run dev:turbo` | Dev server with Turbopack |
| `npm run build` | Production build (webpack) |
| `npm run start` | Start production server |
| `npm run lint` | ESLint -- keep it clean |
| `npm run typecheck` | tsc --noEmit -- no broken types on my watch |
| `npm run test` | Vitest -- tests or it didn't happen |
| `npm run dev:clean` | Nuke .next then dev (fixes cursed cache) |

---

## How the AI pipeline works (no cap)

1. **Upload** -- Drop a PDF. Server receives it, saves to Supabase, adds to queue. Don't be sus, just drop it.
2. **Let it cook** -- MarkItDown extracts text. Server chunks it, identifies grounded concepts using the AI model, recommends question count, generates validated MCQs in batches. De doc dang bi cook.
3. **Review** -- You check the output. Approve, edit, or yeet individual questions. Kiem tra lai di bro, de xem AI co bua khong.
4. **Lock in** -- Set's ready. Practice mode unlocked. Gio thi lock-in thoi.
5. **Practice** -- Keyboard-first, timer optional, question map visible. Easy clap.
6. **Mistake drill** -- Wrong answers? They go to a queue. Run it back. Sai cung khong sao, lam lai la len.
7. **Repeat** -- Build that locked-in streak. Trust. 10 cau nua thoi, trust.

> **Scanned PDF?** Needs the OCR/doc extraction path first. Quizzes are never generated from raw page images. Patience, grasshopper.

---

## Design taste (Chaos Study Mode)

This project runs on a specific taste contract defined in `TASTE.md`, `PRODUCT.md`, and `DESIGN.md`. Short version:

- **Palette:** Mint base, oxblood primary, coral signal, forest links. No cream, beige, purple, or gradient text. Ever. Khong co mau do chung.
- **Typography:** Manrope for UI, Space Grotesk for labels, expressive display face for headlines/stickers only.
- **Motion:** Fast snap (100-160ms). State-only. No page-load choreography, no loops, no ambient animation. prefers-reduced-motion respected.
- **Copy:** 70% clear product language, 30% chaos. Vietnamese + English code-switch. Primary buttons stay literal.
- **Hard bans:** Corporate SaaS gradients, glassmorphism, childish cartoons, decorative grid backgrounds, gradient text, side-stripe accents, cards with 1px border + wide shadow, random doodles. Basically anything that looks like a templated turd.
- **Chaos budget:** One dominant chaotic gesture per viewport. One stamp, one annotation, one rotated sticker, or one playful reaction. Never all four. Dung spam,it's not funny if everything shouts.

---

## Deployment notes (prod)

- **Vercel** is the target. Build with `npm run build` (webpack).
- **Python/MarkItDown** doesn't run on pure serverless Node. You need Docker, a VM, or a conversion sidecar for ingest to work in prod. Don't say we didn't warn you.
- **Blob storage** -- If using vision features, set `BLOB_READ_WRITE_TOKEN` and attach a Vercel Blob store. In-memory fallback expires after about 10 min. That's cap for production.
- **Sentry** -- `next.config.ts` is **not** wrapped with `withSentryConfig` by default. Add if you want source-mapped stacks.
- **Rate limiting** -- `POST /api/ai/vision-staging` is unauthenticated. Only protection is a ~12 MB payload cap. Don't deploy this wide open without adding auth/rate limits unless you wanna get absolutely cooked.

---

## Slang dictionary (so you not lost)

| Term | Translation |
|---|---|
| Let it cook | Processing -- wait for the AI to finish. De no cook. |
| Lock in | Ready to practice -- get in the zone. Lock-in thoi. |
| Run it back | Retry or drill mistakes again. Lam lai di. |
| Bro cooked | AI did a good job. Thang AI nau ngon. |
| Source nay sus | This document looks suspicious. Check lai di. |
| Easy clap | Task completed successfully. Qua de. |
| Doi ti bro, dang doc de | Wait bro, reading the questions. |
| Sai cau nay hoi dau nha | Getting this wrong kinda hurts. |
| Hoc tiep hay nghi gia vo? | Keep studying or pretend to take a break? |
| Gaslight the exam | Study so hard you convince yourself you know everything |
| No cap | Not lying, for real. Khong xao. |
| Based | Admirable, correct, commendable. Chuan. |
| Cringe | Embarrassing, second-hand shame. Ngan. |
| Yeet | Discard or delete. Veo di. |
| Cooked | In trouble or something went wrong. Toi r. |
| Vibe shift | Change in atmosphere/approach. Doi gio. |
| Git gud | Get better, improve your skills. Gioi len di. |
| Sus | Suspicious. Dang nghi. |
| Bua | Bullshit or nonsense (Vietnamese slang). |
| De | Easy, simple. |
| Ngon | Good, delicious, works well. |
| Toi r | I'm done for, I'm screwed. |
| Btw | By the way. Ma thoi. |
| Tbh | To be honest. That ma noi. |
| Ngl | Not gonna lie. Khong xao ma. |
| Low-key | Subtly, moderately. |
| High-key | Obviously, intensely. Ro rang. |
| Stan | To be an obsessive fan. Me nó luon. |
| Glow up | Transformation for the better. Len level. |
| Side quest | Secondary task, distraction. |
| Main character | The most important person in a situation. Nhan vat chinh. |
| Rent free | Living in someone's head without paying. O trong dau khong mat tien. |
| Delulu | Delusional. Ao tuong. |
| W | Win. Thang. |
| L | Loss. Thua. |
| Ratio'd | Get more replies than the original post (getting clowned). Bi che. |
| Understood the assignment | Performed exactly as needed. Hieu bai. |
| Ate and left no crumbs | Performed flawlessly. Lam qua ngon. |
| It's giving | It's conveying a certain vibe. Dang toa ra. |
| Slay | Do something exceptionally well. Lam dep. |
| Period | Emphatic statement ending. Het chuyen. |
| Bestie | Best friend. Ban than. |
| Fr fr | For real, for real. That. |
| Iykyk | If you know, you know. Ai biet thi biet. |
| Pookie | Term of endearment. Cung. |
| Type shit | That kind of thing. The loai day. |
| On God | Swearing on something. The thanh. |
| Bet | Agreement or acknowledgement. Chuan luon. |
| Preach | Express strong agreement. Chuan khong can chinh. |
| Caught in 4k | Caught on camera, undeniable evidence. Bi bat quang tang. |
| Touch grass | Go outside, touch some grass. Ra ngoai di cho. |
| Main character energy | Confident, protagonist vibe. Khi cua nhan vat chinh. |
| Speedrun | Complete something as fast as possible. Chay speed. |
| Softlock | Get stuck in an unresolvable state. Ket. |
| Hardlock | Get completely stuck with no escape. Ket cung. |
| Hot take | Unpopular opinion. Y kien trai chieu. |
| Take the L | Accept defeat. Nhan thua. |
| W rizz | Winning charm or charisma. Cuon hut. |
| Final boss | The ultimate challenge. Trum cuoi. |
| Side-eye | Skeptical look. Nhin deu. |
| Read to filth | Criticize harshly. Che toi noi. |
| Spill the tea | Share gossip. Ke chuyen. |
| No thoughts, head empty | Brain not braining. Khong nghi gi ca. |
| Brainrot | Obsessive thoughts about something. Am anh. |
| Do it for the plot | Do something just for the experience, regardless of outcome. Lam vi co chuyen. |
| Living rent free | Something constantly on your mind. O trong dau. |
| Babygirl | Endearing term for someone. Cung cung. |
| Nah, chay lai | Nah, run it again. |
| Hieu bai chua | You get it now? Unclear? |
| Binh tinh | Calm down, relax. |
| Nhin nay ne | Look at this real quick. |
| Deo tin noi | Unbelievable (VN slang). |
| Nhung ma thoi | But anyway. |
| Chet me r | Dead serious or dead tired. |
| Anh huong | Influencer vibes. |
| Dep trai/xai khong | Looking good or useless. |
| Khong sao dau | It's okay, no problem. |
| Co len | Keep going, you got this. |
| May tinh no bi lag | Computer is lagging. Classic. |
| Xong | Done, finished. |
| Vo dich | Champion, the best. |

---

## License

MIT. Do whatever, but if you make money off this, at least buy your boy a coffee. Dau tuong.

---

## Author

Built by **Tue Minh** -- learning systems, AI workflows, product-first engineering, and questionable amounts of slang. Khong xao dau, su that day.

> *"10 cau nua thoi, trust."*
