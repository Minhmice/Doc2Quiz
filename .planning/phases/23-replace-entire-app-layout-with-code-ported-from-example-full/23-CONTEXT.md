# Phase 23 — Context

**North star (user intent):** *Replace toàn bộ layout với code từ `example/` vào* — bring **full page layout and composition** from the static mocks under `example/` into the Next.js app (not only tokens or isolated widgets).

**Depends on:** Phase 22 (Mint tokens, fonts, shell baseline already in `globals.css`, `AppShell`, `AppTopBar`, step bar).

**Design sources:** `example/*/code.html`, shared assets (e.g. `example/hub.css` if still canonical), `example/index.html` / `preview-all.html` for cross-page consistency.

**Scope boundaries (for planning):**

- Prefer **structural parity** (regions, spacing, card patterns, play/dashboard/settings chrome) mapped to **existing routes** and **client components** — avoid duplicating business logic inside pasted HTML.
- Preserve **keyboard-first practice**, **IDB / study set flows**, and **accessibility** (focus, labels); any visual-only port must not drop behaviors.
- Large surface area: plan in **waves** (e.g. shell + dashboard, then set funnel, then play/review) with `npm run build` + smoke checks per wave.

**Risks:** wholesale DOM/class copy can conflict with Tailwind v4 + shadcn patterns; iframe-only mocks may assume Google Fonts CDN — align with `layout.tsx` font variables instead.

**Next:** `/gsd-plan-phase 23` → RESEARCH (optional) + UI-SPEC + PLAN.md waves.

---

## Locked decisions (plan-phase 2026-04-12)

1. **`/develop` route** — Add **`src/app/(app)/develop/page.tsx`** (inside existing `(app)` + `AppShell`) as a **design/debug lab**: browse `example/` mocks safely, không thay thế luồng production ngay.
2. **Shadcn-first chrome** — Khung trang `/develop` dùng **shadcn/ui** (`Card`, `Tabs`, `Select`, `Button`, `Separator`, `ScrollArea`, thêm **`Sheet`** nếu cần mobile picker) — **không** paste nguyên `<html>` mock làm root layout app.
3. **Wrapper pattern** — Hiển thị nội dung mock qua **iframe** (hoặc tương đương isolated) trỏ tới **route handler** đọc `example/<folder>/code.html` từ disk, **`development` hoặc env flag** (ví dụ `ALLOW_DEVELOP_MOCKS=1`) để tránh lộ file system trên production.
4. **Sau lab** — Các wave tiếp theo port layout **từng route thật** (dashboard, play, …) dựa trên mock đã xác nhận trong `/develop`.
