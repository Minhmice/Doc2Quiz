# Phase 21 — UI design contract (vision MVP)

**Scope:** incremental draft list, confidence affordances, benchmark surfacing (minimal MVP).

## 1. Incremental preview

- Trong `AiParseSection` (hoặc presenter tách): khi `onItemsExtracted` fire, **append** vào list đang hiển thị (không chờ hết parse).
- Thứ tự: theo **batchIndex** rồi thứ tự item trong batch; sau dedupe cuối cùng có thể reorder một lần — MVP: append-only + dedupe key để tránh double hiển thị overlap.
- Loading: giữ overlay progress; có thể hiển thị “Batch 2/5…” text nhỏ.

## 2. Confidence

- **Badge** trên mỗi card draft:
  - `confidence ≥ 0.75` → “High” (muted success).
  - `0.45–0.75` → “Review” (amber).
  - `< 0.45` → “Low” (destructive outline).
- `aria-label` trên card gồm confidence tier cho SR.

## 3. Benchmark (MVP)

- **Developer / `?debug=1`:** khối `<pre>` hoặc copy-button với text từ `formatVisionBenchmarkReport(benchmark)` — không chặn learner nếu ẩn mặc định.
- Hoặc chỉ `pipelineLog` + `console.info` trong dev — ghi rõ trong SUMMARY nếu chọn tối giản.

## 4. Mode clarity

- Header parse: một dòng **“Mode: Quiz”** / **“Mode: Flashcards”** từ `parseOutputMode` (không suy từ URL một mình).

## 5. Non-goals (UI)

- Không polish ensemble UI trong phase này (chỉ flag env nếu có).
