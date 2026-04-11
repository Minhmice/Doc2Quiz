# Ghi chú: hiển thị công thức / LaTeX trong câu hỏi (chưa triển khai)

## Vấn đề

Nội dung từ PDF / AI có thể chứa **LaTeX inline** dạng `$...$` (ví dụ `$u_4 = 4$`, `$\frac{1}{2}$`, `$\sqrt{2}$`).  
UI hiện đang hiển thị **chuỗi thuần**; cần **render toán** thay vì chỉ đổi font chữ thường.

## Font vs “cách hiện ký tự”

- **Không** giải quyết bằng một font sans-serif đơn lẻ: subscript, phân số, căn bậc hai là **layout toán học**, không phải glyph có sẵn trong một family chữ thường.
- Thư viện render (bên dưới) thường dùng **font toán** kèm bộ layout:
  - **KaTeX**: bundle font (Computer Modern–style), nhẹ, SSR-friendly nếu cấu hình đúng.
  - **MathJax**: font STIX / similar, mạnh với TeX phức tạp, nặng hơn.

**Từ khóa tìm hiểu:** “KaTeX fonts”, “MathJax font configuration”, “STIX Two Math”.

## Hướng kỹ thuật (React / Next.js)

1. **KaTeX** (`katex`, `react-katex` hoặc `rehype-katex` / `remark-math` nếu coi stem như markdown nhỏ)  
   - Tài liệu: https://katex.org/docs/browser.html  
   - Cần import CSS của KaTeX (`katex.min.css`).

2. **MathJax 3** (component hoặc script, `typeset` sau khi mount)  
   - Tài liệu: https://docs.mathjax.org/  
   - Phù hợp nếu sau này cần macro TeX rất đầy đủ.

3. **Chiến lược parse chuỗi**
   - Tách đoạn text thường vs đoạn `$...$` (regex hoặc parser đơn giản), chỉ đưa phần trong `$` vào KaTeX/MathJax.
   - Cảnh báo: nội dung từ AI/user → **không** `dangerouslySetInnerHTML` thô; dùng API an toàn của thư viện hoặc sanitize.

## Chỗ trong codebase sẽ cần đụng tới (khi làm)

- Hiển thị stem / options MCQ: ví dụ `QuestionCard`, `McqOptionsPreview`, `QuestionEditor`, và mọi nơi in `question` / `options[]`.
- Có thể tách **component** `MathText` hoặc `RichQuestionText` dùng chung để tránh lặp.

## Việc chưa làm (theo yêu cầu)

Chỉ lưu hướng dẫn; **chưa** cài package, **chưa** sửa UI.

---

*Cập nhật khi bắt đầu phase triển khai: ghi rõ package đã chọn, cách bundle CSS trong Next.js App Router, và quy tắc an toàn cho chuỗi từ AI.*

---

## Research bổ sung (tóm tắt — 2026)

Mục tiêu sản phẩm: **môn Toán trước** (preview đủ ký hiệu/layout), kiến trúc mở rộng sau cho môn khác **không** đồng nghĩa phải hỗ trợ mọi loại nội dung trong một phase.

| Hướng | Ưu | Nhược / lưu ý |
|--------|-----|----------------|
| **KaTeX** | Nhẹ, render đồng bộ, font bundle ổn định, phổ biến với Next.js (`katex` + CSS; hoặc `react-katex` / tách segment `$...$` rồi `renderToString` có kiểm soát) | Subset LaTeX; cần **phiên bản đã vá** (ví dụ ≥ 0.16.21) cho lỗ hổng liên quan `\htmlData` khi render chuỗi không tin cậy — không bật `trust` bừa bãi. |
| **MathJax 3** | Hỗ trợ TeX rộng hơn, một số tình huống a11y tốt hơn | Bundle nặng hơn; tích hợp React thường `typeset()` sau mount — cần pattern rõ để tránh flicker / race. |
| **Pipeline MDX** (`remark-math` + `rehype-katex` / `rehype-mathjax`) | Hợp nếu toàn bộ stem là markdown | Doc2Quiz hiện lưu **plain string** MCQ; chỉ nên dùng nếu CONTEXT quyết định “stem = markdown nhỏ” — không mặc định. |
| **MathML / Temml** | Chuẩn W3C / hướng MathML | Trình duyệt & ecosystem thực tế — đánh giá kỹ trước khi chọn làm path chính. |

**Đa môn:** Phase 9 nên ship **lớp hiển thị notation** (công thức + ký hiệu toán). Môn khác (Lý, Hóa, …) tận dụng cùng component nếu vẫn là **LaTeX/công thức**; **hình vẽ, phản ứng hóa, mạch điện** = phase/backlog riêng.

**Tài liệu tham chiếu:** [KaTeX browser](https://katex.org/docs/browser.html), [MathJax 3 docs](https://docs.mathjax.org/), so sánh thực nghiệm kiểu [intmath KaTeX vs MathJax](https://www.intmath.com/cg5/katex-mathjax-comparison.php) (độ trễ + font).
