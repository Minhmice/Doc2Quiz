# Product

## Register

product

## Platform

web

## Users

The primary user is a **solo student** who already has PDFs of past exams, notes, or question banks and wants to drill actively instead of re-reading passively. They work alone, upload their own materials, and care about speed through the practice loop — not collaboration, teacher dashboards, or institutional features.

Context: usually exam prep or self-directed review, often with a backlog of 10–50 documents. They need to parse a document, sanity-check the output, then get into keyboard-first quiz or flashcard sessions quickly. Wrong-answer loops and return visits are how they build retention.

## Product Purpose

Doc2Quiz is an **AI study workbench**: upload a PDF, extract structured questions and flashcards, review before committing, then practice with fast navigation and mistake-focused replay.

The product exists because static PDFs are inefficient practice surfaces. Success means users **return to wrong-answer loops and build a study habit** — not one-off uploads. The core loop is upload → parse → review → practice → score → repeat mistakes.

Cloud accounts (Supabase Auth) sync study sets across sessions; IndexedDB remains for local caches and hybrid offline resilience. AI processing runs server-side via same-origin route handlers — users do not manage API keys in the browser.

## Positioning

**The AI study workbench that turns one PDF into reviewable quizzes and flashcards you actually come back to.**

## Brand Personality

**Precise. Calm. Instrument-like.**

Doc2Quiz should feel like a focused tool that stays out of the way — not a gamified study app or a marketing landing page. Confidence comes from clarity and speed, not decoration. Progress signals are functional (parse status, session score, mistake queues), not celebratory.

Emotional goal: calm focus during study sessions. The interface earns trust through readable hierarchy, honest loading states, and human review before practice.

## Anti-references

- **Generic AI SaaS** — cream/warm-neutral backgrounds, purple gradients, hero metrics, glassmorphism cards, uppercase eyebrow kickers on every section, "AI-powered" marketing chrome
- **Flashcard-app candy** — oversized pill cards, playful illustrations, gamification badges, bouncy motion, candy-color accents unrelated to content
- **SaaS landing-page templates** — identical icon+heading+text card grids, gradient text, side-stripe callouts, decorative grid backgrounds on non-canvas surfaces

## Design Principles

1. **Practice over reading.** Every screen should move the user closer to active recall, not passive consumption of the source document.
2. **Instrument, not entertainment.** UI chrome supports the task; it does not compete with study content for attention.
3. **Review before trust.** AI extraction is a draft until the user approves it. Human-in-the-loop is a feature, not friction.
4. **Keyboard-first flow.** Answer selection, navigation, and common actions must work without reaching for the mouse during practice.
5. **Habit through repetition.** Wrong-answer loops, session history, and fast re-entry are first-class — one-time uploads are not enough.

## Accessibility & Inclusion

Full inclusive design from day one:

- **WCAG 2.1 AA** contrast on all readable text, including muted labels and placeholders
- **Keyboard operability** across practice, review, dashboard, and auth flows (existing product priority)
- **Screen reader support** — semantic landmarks, labelled controls, live regions for parse progress and session state
- **Reduced motion** — all animations (route enter, parse shimmer, flashcard flip) respect `prefers-reduced-motion`
- **Color-blind safety** — state and correctness never rely on hue alone; pair color with text, icons, or position
