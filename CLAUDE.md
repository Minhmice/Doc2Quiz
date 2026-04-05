# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Doc2Quiz is an offline-first Next.js web app that converts PDF documents into interactive multiple-choice quiz sessions. The pipeline is: Upload PDF → Extract text → AI parsing → Review questions → Practice with keyboard-first UX.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run lint       # Run ESLint
```

## Tech Stack

- **Framework**: Next.js (App Router) with TypeScript
- **Styling**: Tailwind CSS v4
- **PDF Parsing**: `pdfjs-dist`
- **State**: React local state only (no global store)
- **Storage**: localStorage / IndexedDB (planned — no cloud dependency)

## Architecture

The app is organized around three core engines:

1. **Document Ingestion** (`src/lib/pdf/`) — PDF upload, text extraction via pdf.js, and optional `renderPagesToImages.ts` for vision parsing when the text layer is empty (scanned PDFs). Vision is OpenAI-compatible multimodal only (not local OCR).

2. **Question Bank** (`src/lib/` or `src/types/`) — Local-first JSON storage of parsed questions, wrong-answer history, and practice state.

3. **Practice Engine** (`src/components/`) — Keyboard-first quiz UI where keys 1/2/3/4 map to answer choices A/B/C/D.

### Target source layout

```
src/
├── app/
│   ├── layout.tsx
│   └── page.tsx                  # Main screen: upload + text viewer
├── components/
│   ├── upload/UploadBox.tsx
│   └── viewer/RawTextViewer.tsx
├── lib/
│   └── pdf/
│       ├── extractText.ts        # PDF → text
│       └── renderPagesToImages.ts # Pages → JPEG for vision
└── types/
    └── pdf.ts
```

### Core types

```ts
// src/lib/pdf/extractText.ts return type
type ExtractResult = {
  text: string
  pageCount: number
}

// src/app/page.tsx state shape
type PageState = {
  file: File | null
  loading: boolean
  text: string
  error: string | null
}
```

## Development Phases

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | PDF upload + text extraction | Complete |
| 2 | AI text chunking → structured questions | Planned |
| 3 | Question review/edit interface | Planned |
| 4 | Keyboard-first practice engine | Planned |
| 5 | Score tracking + wrong-answer loop | Planned |

## Key Constraints

- **Offline-first**: no backend calls in v1; all data in localStorage/IndexedDB
- **Keyboard-first UX**: 1/2/3/4 keys for answers, fast navigation throughout
- **Human-in-the-loop**: AI-parsed questions must go through a review step before being saved
- **Scanned PDFs**: pdf.js returns empty text for image-only pages; the UI offers **Parse with vision** (JPEG per page, cap ~20 pages, user-cancelable). Requires a vision model and OpenAI or Custom tab — not the Anthropic-native path. This is not offline OCR; token usage is per page.
