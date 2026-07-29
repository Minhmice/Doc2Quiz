# Doc2Quiz MVP Pipeline

```text
Input Zone
→ Validate Input
→ MarkItDown Conversion
→ Raw Markdown
→ Canonical Knowledge Builder
→ Save Canonical Knowledge to Supabase
→ Choose Learning Mode
   ├─ Quiz
   │  → Detect testable concepts
   │  → Recommend question count
   │  → Generate MCQs
   │  → Save immediately to Supabase
   │  → User review/edit/delete
   │  → Start quiz
   └─ Flashcards
      → Ask learning goal
      → Ask coverage
      → Ask card amount
      → Detect best card format automatically
      → Generate flashcards
      → Save immediately to Supabase
      → Start learning
```

## Pipeline (authoritative)

This file is the source of truth for v2.1 milestone planning. See also `.planning/REQUIREMENTS.md` and `.planning/ROADMAP.md`.


Accept:

* PDF
* DOCX
* PPTX
* XLSX/XLS
* JPG/JPEG/PNG
* WAV/MP3
* HTML
* CSV
* JSON
* XML
* Plain text
* Pasted text
* YouTube URL

## Canonical Knowledge Builder

Must:

* clean extraction noise
* remove duplicates
* preserve headings, tables, formulas, examples
* detect language
* detect theory, exam, or mixed content
* extract existing questions and answer keys
* split content into stable sections
* generate title and clean filename
* never invent information

Store original file, raw Markdown, canonical Markdown, metadata, and sections.

## Quiz Rules

* Canonical knowledge only
* Four options
* Exactly one correct answer
* No duplicate concepts
* Generate fewer questions when content is insufficient
* Save before review

## Flashcard Options

Ask only:

1. Learning goal: memorize, understand, exam preparation
2. Coverage: entire document or selected sections
3. Amount: recommended or custom

All generated content is private, immediately saved, editable, and usable. No draft, publishing, sharing, or quality-validation stage.
