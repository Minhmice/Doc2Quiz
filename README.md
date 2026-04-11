# 📄 Doc2Quiz

**Doc2Quiz** is an offline-first web application that transforms static documents (PDF) into interactive multiple-choice practice sessions.

The core idea is simple:

> **Upload a document → extract content → convert into a usable quiz → practice at speed**

---

## 🚀 Vision

Most learners already have a large collection of PDFs, DOCX files, and past exams — but these resources are **static and inefficient to practice with**.

Doc2Quiz aims to:

* Convert passive materials into **active learning systems**
* Enable **fast, keyboard-first practice**
* Build a foundation for **AI-powered question extraction and generation**

---

## 🧠 Core Concept

Doc2Quiz consists of 3 main engines:

### 1. Document Ingestion Engine

* Upload and read PDF files
* Extract raw text
* AI parsing from extracted text (user API key) or, for scanned PDFs with no text layer, optional **vision** parsing (OpenAI-compatible multimodal, one request per rendered page)

### 2. Question Bank (Local-first)

* Store parsed questions locally (JSON)
* Maintain history and wrong answers
* No cloud dependency in v1

### 3. Practice Engine

* Keyboard-first answering (1/2/3/4 = A/B/C/D)
* Fast navigation
* Question map and progress tracking

---

## 🧩 Tech Stack

* **Framework:** Next.js (App Router)
* **Language:** TypeScript
* **Styling:** Tailwind CSS v4
* **PDF Parsing:** pdf.js
* **State (v1):** React state (no global store yet)
* **Storage (planned):** localStorage / IndexedDB

---

## 📦 Project Structure

```bash
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                # Main upload + viewer screen
│
├── components/
│   ├── upload/
│   │   └── UploadBox.tsx
│   │
│   ├── viewer/
│   │   └── RawTextViewer.tsx
│
├── lib/
│   ├── pdf/
│   │   ├── extractText.ts      # PDF → text
│   │   └── renderPagesToImages.ts  # PDF pages → JPEG data URLs (vision)
│   ├── ai/
│   │   ├── parseChunk.ts
│   │   ├── parseVisionPage.ts
│   │   └── runVisionSequential.ts
│
├── types/
│   └── pdf.ts
```

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-username/doc2quiz.git
cd doc2quiz
```

---

### 2. Install dependencies

```bash
npm install
```

---

### 3. Run development server

```bash
npm run dev
```

---

### 4. Open in browser

```bash
http://localhost:3000
```

---

## Environment variables

* **`BLOB_READ_WRITE_TOKEN`** — Optional. When set (e.g. on Vercel after creating a Blob store), vision image staging uses [Vercel Blob](https://vercel.com/docs/storage/vercel-blob) so serverless multi-instance deployments do not lose staged images between POST and upstream GET. If unset, staging stays in-process memory (typical for local development).

### Observability (optional Sentry)

* **`SENTRY_DSN`** — Optional. When set on the **server** runtime, uncaught errors and pipeline failures reported via `reportPipelineError` can be sent to [Sentry](https://sentry.io). If unset, the Sentry SDK stays disabled and **nothing** is shipped remotely.
* **`NEXT_PUBLIC_SENTRY_DSN`** — Optional. Browser-side Sentry; omit to keep **client** capture off while still allowing server-only reporting.

Local **`pipelineLog`** (console) remains the default for development; Sentry is **additive**. Do **not** put API keys, raw PDF bytes, full `data:` URLs, or full question stems into Sentry context—tags are limited to pipeline stage metadata (see `src/lib/observability/reportPipelineError.ts`). Tighten scrubbing in `beforeSend` in `sentry.*.config.ts` if your deployment needs stricter redaction.

`next.config.ts` is **not** wrapped with `withSentryConfig` in this repo (no source-map upload token required for local builds); stacks still appear in Sentry without demangled frames until you add release + auth token per Sentry docs.

### Vision staging (production)

1. In Vercel: **Storage → Blob** — create or attach a store to the project.
2. Set **`BLOB_READ_WRITE_TOKEN`** for Production (and Preview if needed), then redeploy.
3. Confirm **Parse with vision** works: staging URLs should be HTTPS and stable across instances.

**TTL:** In-memory fallback expires entries after about **10 minutes** (and caps entry count). **Public Blob uploads from this app are not deleted automatically**—plan lifecycle separately (manual cleanup, provider policies, or a future retention job).

**Abuse:** `POST /api/ai/vision-staging` is **unauthenticated**; the only built-in control is the **payload size cap** (~12 MB decoded). **Rate limiting and auth are not implemented** here—treat as backlog if you expose the app broadly.

---

## 📄 Usage

1. Upload a `.pdf` file
2. Wait for extraction
3. For text PDFs: review raw text, then parse questions from text (AI section)
4. For scanned PDFs (empty text): use **Parse with vision** in the AI section (OpenAI or Custom provider, vision-capable model). Pages are rendered client-side to JPEG; the app sends **one API request per page** (capped at 20 pages by default). This uses your tokens and is not offline OCR.

---

## ⚠️ Limitations (Current)

* **Text extraction** from pdf.js only works when the PDF has a text layer; scans return empty text until you use vision parsing.
* **Vision parsing** is not Tesseract-style local OCR; it is multimodal chat over rendered page images. Cost and latency scale with page count.
* Persistence for the question bank is still evolving; refresh behavior may reset some UI state.

---

## 🧪 Future Enhancements

* AI-powered question extraction
* Multi-agent parsing pipeline
* Question bank management
* Practice modes (Learn vs Exam)
* Analytics & weak-topic detection

---

## 🎯 Design Principles

* **Offline-first**
* **Speed over complexity**
* **Keyboard-first UX**
* **Human-in-the-loop (review before saving)**
* **Minimal viable core before AI expansion**

---

## 📌 Philosophy

Doc2Quiz is not trying to replace existing quiz platforms.

Instead, it focuses on a specific gap:

> Turning **existing learning materials** into a **high-speed practice system**

---

## 🤝 Contributing

Currently a solo experimental project.
Structure and architecture are designed to support future modular expansion.

---

## 📜 License

MIT License (recommended)

---

## ✨ Author

Built by **Tuệ Minh**
Focused on learning systems, AI workflows, and product-first engineering.