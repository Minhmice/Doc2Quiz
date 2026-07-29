# Phase 9: Math & notation preview - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `09-CONTEXT.md`.

**Date:** 2026-04-11
**Phase:** 9 — Math & notation preview (LaTeX-first, subject-ready)
**Areas discussed:** Rendering stack & security; Editor & preview UX

---

## Chọn hạng mục thảo luận (lần 1)

| Option | Description | Selected |
|--------|-------------|----------|
| Stack | Thư viện render & bảo mật | ✓ |
| Delimiters | Quy tắc `$` / `$$` | |
| Fallback | TeX lỗi / không an toàn | |
| Phase 8 | Phụ thuộc flashcards | |
| Editor | UX preview (lần 1 chưa chọn) | |

**User's choice:** Chỉ **stack** (sau khi yêu cầu hỏi bằng tiếng Việt).

---

## Rendering stack & security

| Option | Description | Selected |
|--------|-------------|----------|
| KaTeX | Mặc định roadmap; nhẹ; CVE posture | |
| MathJax 3 | LaTeX rộng; bundle/typeset trade-off | ✓ |
| Hybrid | KaTeX + fallback MathJax | |

**User's choice:** **MathJax 3**

| Option | Description | Selected |
|--------|-------------|----------|
| npm bundle | Self-host | |
| CDN | Cần mạng | |
| Discretion | Planner chọn miễn đảm bảo offline-first / cache | ✓ |

**User's choice:** **Planner discretion** với ràng buộc **offline-first** (ghi trong CONTEXT).

---

## Editor & preview UX

| Option | Description | Selected |
|--------|-------------|----------|
| Debounce ~300–500ms | Cân bằng hiệu năng | ✓ |
| on blur | Nhẹ nhất | |
| Split preview | Khung riêng | |
| Live mỗi phím | WYSIWYG tối đa | |

**User's choice:** **Debounce**

**Follow-up (a11y/focus):** User chọn **“Đủ rồi”** — giao chi tiết cho planner, ưu tiên a11y vừa phải.

---

## Hoàn tất

User chọn **tạo CONTEXT**; delimiter / fallback / Phase 8 để planner theo NOTES + ROADMAP.

## Claude's Discretion

- Cấu hình chi tiết MathJax (component list, TeX extensions).
- Delimiter grammar và fallback string.

## Deferred Ideas

- KaTeX-first path (đã bỏ qua theo chọn MathJax).
- SMILES / sơ đồ mạch / hình học không-LaTeX.
