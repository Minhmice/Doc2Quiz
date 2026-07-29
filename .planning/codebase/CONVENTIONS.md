# Code Conventions — Doc2Quiz

> Last updated: 2026-07-26

## 1. Code Style

### TypeScript

- **TS strict mode** enabled (`"strict": true` in `tsconfig.json`) — no implicit anys, strict null checks, all strict family flags on.
- **ESNext module resolution** with bundler mode (`"moduleResolution": "bundler"`).
- Path alias `@/` maps to `./src/*` — all internal imports use `@/` (e.g. `@/lib/utils`, `@/components/ui/button`).
- No `any` type unless unavoidable (legacy boundary); prefer `unknown` + narrowing.
- ESLint v9 via `eslint-config-next` — three react-hooks rules deferred (`set-state-in-effect`, `refs`, `static-components`).

### Components

- **Functional components with explicit props interfaces.** Every component defines its props inline or as a named type/interface.
- **`Readonly<{...}>` for component props** — all props objects are wrapped in `Readonly<>` to enforce immutability:

```typescript
type StudySetFlowPageShellProps = Readonly<{
  children: ReactNode;
  studySetId: string;
}>;
```

- **Named exports** for all components — no `export default` for components. Page files (`app/**/page.tsx`) use `export default function Page()` as required by Next.js.
- **Client components** marked with `"use client"` directive at top of file.
- **Server components** for data fetching; client components for interactivity only.

### CSS & Styling

- **Tailwind v4** utility classes — no `@apply` in component files.
- **`cn()` utility** (`tailwind-merge` + `clsx`) for conditional class merging, imported from `@/lib/utils`:

```typescript
import { cn } from "@/lib/utils";
```

- **Custom CSS properties** use the `--d2q-*` prefix (e.g. `--d2q-blue`, `--d2q-accent`, `--d2q-border`, `--d2q-surface`). Defined in `globals.css` under `:root` and `.dark`, then mapped to `@theme inline` Tailwind color tokens.
- **CSS custom properties in `globals.css`** — Shadcn/base-ui CSS variables (`--background`, `--foreground`, `--primary`, etc.) plus `--d2q-*` branding properties.
- **Design tokens** from `DESIGN.md` are the source of truth; `globals.css` is the implementation.

### File Naming

| Pattern | Examples |
|---|---|
| PascalCase for components | `DashboardHomeClient.tsx`, `AppTopBar.tsx`, `FlashcardReviewWorkspace.tsx` |
| kebab-case for utilities | `cn.ts`, `studySetDashboardLinks.ts` |
| camelCase for hooks | `useDashboardHome.ts`, `useLibrarySearch.ts` |
| route files match Next.js conventions | `page.tsx`, `layout.tsx`, `template.tsx`, `route.ts`, `loading.tsx` |

### Routes

- Next.js file-based routing with `(groups)` for route organization:
  - `(app)/` — authenticated app shell (dashboard, study sets, edit, quiz, flashcards)
  - `(auth)/` — login / signup flows
- API routes: `route.ts` files in `app/api/` directory.
- Dynamic segments: `[id]`, `[studySetId]` in bracket directories.

### Import Order

1. **External dependencies** — `react`, `next/*`, `framer-motion`, `lucide-react`, `@supabase/*`, `@base-ui/*`, `@teispace/*`
2. **Internal lib / utils** — `@/lib/utils`, `@/lib/supabase/*`, `@/lib/pipeline/*`, `@/lib/client/*`
3. **Components** — `@/components/*`
4. **Hooks** — `@/hooks/*`
5. **Types** — `@/types/*`
6. **CSS files** — `./globals.css` (only in root layout)

Blank line between groups.

### Animations (Framer Motion)

- **Fast snaps** — duration 100–240ms for micro-interactions (button press, fade-in, scale).
- **State-only, no loops** — animations driven by component state, never infinite loops.
- **`useReducedMotion` respected** — always call the hook and disable motion when user prefers reduced motion.
- Route transitions use `d2q-route-transition` CSS classes (opacity, transform, filter only — no layout animation).

### UI Interactions

- **DropdownMenu** from `@/components/ui/dropdown-menu` (shadcn/Base UI) for menus and overflow actions.
- **AlertDialog** from `@/components/ui/alert-dialog` for destructive confirmations and critical prompts.
- **Dynamic imports** via `next/dynamic` for heavy components with loading fallbacks:

```typescript
const HeavyComponent = dynamic(() => import("./HeavyComponent"), {
  loading: () => <Skeleton className="h-32 w-full" />,
});
```

## 2. Design System Constants

See `DESIGN.md` for the full design ledger. Quick reference:

| Token | Value |
|---|---|
| **Typography — Body** | Manrope, 0.875rem / text-sm, leading-5 |
| **Typography — Label** | Space Grotesk, 0.625rem / text-[10px], tracking-[0.08em], uppercase |
| **Base radius** | 4px (Tailwind `rounded` / `--radius`) |
| **Rounded sm** | 2.4px |
| **Rounded md** | 3.2px |
| **Rounded lg** | 4px |
| **Rounded xl / card** | 5.6px |
| **Spacing grid** | 4px (xs=4, sm=8, md=16, lg=24, xl=32) |
| **Primary** | Oxblood `#5f0f00` |
| **Signal / Ring** | Coral `#ff967d` |
| **Page background** | Mint Paper `#f7faf8` |
| **Text** | Study Ink `#181c1b` |
| **Card surface** | Card White `#ffffff` |

## 3. Error Handling

- **AI pipeline failures** — catch and return typed error objects (`FlashcardGenerateError`, `CanonicalizeError`, `QuizGenerateError`). Errors are union-typed so callers can discriminate.
- **Pipeline logging** — use a dedicated pipeline log mechanism for debugging LLM calls (prompts sent, raw responses, timing). Implemented as needed per phase; no global logger.
- **Console logging** — acceptable in development for debugging; clean up before production.
- **Error aggregation** — Sentry is a dependency (`@sentry/nextjs`) but optional; set up per deployment.
- **API routes** return `{ ok: boolean, error?: string }` JSON shape consistently.

## 4. Accessibility

- **WCAG 2.1 AA** contrast ratios — Muted Ink `#404945` on Mint Paper `#f7faf8` is ≥4.5:1.
- **Keyboard operability** — all interactive elements reachable and operable via keyboard.
- **Screen reader support** — `aria-label` on icon-only buttons and interactive controls; `aria-live="polite"` or `aria-live="assertive"` on dynamic regions (loading states, progress updates).
- **`prefers-reduced-motion`** respected — all CSS animations have `motion-reduce:animate-none` or `@media (prefers-reduced-motion: reduce)` overrides.
- **Color-blind safety** — never use hue-only state indicators (always pair color with icon, text, or pattern).
- **`aria-busy`** on loading skeletons and shell states.

## 5. Testing Style

- Tests use Vitest with `vi.mock()` for external dependency mocking (Supabase, AI provider, fetch).
- `describe` / `it` blocks for test organization.
- Pure functions tested without mocks; API callers tested with vi-stubbed globals or mocked modules.

See [TESTING.md](./TESTING.md) for the full testing guide.
