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
