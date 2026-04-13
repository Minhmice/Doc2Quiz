# Doc2Quiz — testing reality and manual smoke

## What the repo actually verifies today

- **Automated:** There is **no** Playwright (or other browser E2E runner) in `package.json`, and no Jest/Vitest test script. Day-to-day verification is:
  - **`npm run lint`** — runs ESLint (flat config + `eslint-config-next`).
  - **`npm run build`** — Next.js production build (type-checking is part of this pipeline as configured by Next/TypeScript).
- **Manual / browser:** Feature correctness and UX are validated by **human smoke** in a real browser after lint and build succeed.

Do **not** claim “tests pass” based only on assumptions; run the two commands above and exercise critical flows in the UI.

---

## Anti-pattern: brittle DOM snapshots (Cursor / browser automation)

**Do not** rely on selectors or snapshots that target:

- Auto-generated element **`id`s** such as `id="base-ui-_r_*"` (React/useId-style values that **change between renders** or sessions).
- Overly long **positional CSS / DOM paths** that duplicate unstable internal structure.

Those identifiers and trees are **not a public contract** and will break automation or “snapshot replay” the moment the component tree or React reconciliation order shifts.

Prefer **stable contracts**: visible text where it maps to accessibility, **ARIA roles**, **accessible names**, or explicit **`data-testid`** attributes that the team adds and keeps stable (see API status below).

---

## Header API status control (`ApiStatusIndicator`)

**File:** `src/components/layout/ApiStatusIndicator.tsx`

The trigger is a small **button** whose visible label cycles among **`Checking`**, **`API OK`**, and **`API Down`** (see the `label` variable). That label is exposed in the DOM as normal text, so it participates in the **accessible name** of the control.

**Automation hooks** (Playwright-style; no runner in `package.json` yet, but locators apply to Cursor browser tools too):

1. **Primary — stable test id** on the real trigger (`Button` in `ApiStatusIndicator`):

```ts
page.getByTestId("doc2quiz-api-status-trigger");
```

2. **Fallback — role + visible label** (tracks user-visible state without Base UI internal ids):

```ts
page.getByRole("button", { name: /API OK|API Down|Checking/ });
```

Do **not** use `#base-ui-_r_*` or long DOM paths for this control.

---

## Higher-value manual smoke flows (recommended order)

1. **Dashboard / home** — Open `/` (redirects to **`/dashboard`**) or `/dashboard` directly. Confirm the library loads and navigation is sane.
2. **Create a study set** — From dashboard, go to **`/sets/new`**, pick a format path (**`/sets/new/quiz`** or **`/sets/new/flashcards`** per the UI), complete PDF import / setup until a set exists.
3. **Source** — Open **`/sets/{id}/source`** for the new set. Confirm document attachment, text/viewer behavior, and links to downstream steps.
4. **(Optional) Parse** — If your set uses AI parsing, exercise **`/sets/{id}/parse`** when the product surface offers it (depends on content and pipeline state).
5. **Review** — **`/sets/{id}/review`** — confirm question list, edits, and approval flow match expectations.
6. **Practice / play** — **`/sets/{id}/practice`** and/or **`/sets/{id}/play`** depending on mode (quiz vs play session). From project conventions (**`CLAUDE.md`** / implementation): **keyboard-first** answering uses keys **`1`–`4`** mapped to choices **A–D** in `PlaySession` (`src/components/play/PlaySession.tsx`).

Optional branches: flashcards (`/sets/{id}/flashcards`, review subroutes), done/summary pages, settings — add when touching those areas.

---

## Commands (copy-paste)

```bash
npm run lint
npm run build
```

Run both before release or large UI refactors; use **`npm run dev`** for iterative manual checks.

---

## Luồng kiểm thử (thay thế snapshot DOM)

**Thực tế repo:** Chỉ có **`npm run lint`** và **`npm run build`**; không có Playwright hay test runner trong `package.json`. Kiểm chứng cuối cùng vẫn cần **mở trình duyệt** và chạy các luồng smoke thủ công.

**Tránh:** Chụp snapshot hoặc selector dựa vào **`id` tự sinh** kiểu `base-ui-_r_*` hoặc **chuỗi DOM dài** — chúng **đổi giữa các lần render**, rất dễ gãy.

**Nên dùng:** (1) **`getByTestId("doc2quiz-api-status-trigger")`** trên nút trạng thái API; (2) dự phòng **`getByRole('button', { name: /API OK|API Down|Checking/ })`**. Không dùng `#base-ui-_r_*`.

**Luồng smoke chính (thứ tự gợi ý):** Dashboard (`/dashboard`) → tạo bộ (`/sets/new`, rồi quiz hoặc flashcards) → trang nguồn (`/sets/{id}/source`) → (tuỳ chọn) parse → review → practice/play; khi làm quiz, nhớ thử **phím 1–4** chọn đáp án nếu đang kiểm phần chơi.
