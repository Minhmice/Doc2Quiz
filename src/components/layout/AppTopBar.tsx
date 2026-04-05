"use client";

import Link from "next/link";

export function AppTopBar() {
  return (
    <header
      className="sticky top-0 z-40 flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--d2q-border)] bg-[var(--d2q-surface)]/95 px-3 py-3 backdrop-blur-md sm:gap-4 sm:px-5"
      role="banner"
    >
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 rounded-lg pr-2 transition-opacity hover:opacity-90"
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--d2q-accent)] text-sm font-bold text-white shadow-lg shadow-violet-900/30"
          aria-hidden
        >
          D2
        </span>
        <span
          className="font-[family-name:var(--font-display)] text-lg font-bold tracking-tight text-[var(--d2q-text)]"
        >
          Doc2Quiz
        </span>
      </Link>

      <div className="hidden items-center gap-1 sm:flex">
        <Link
          href="/sets/new"
          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--d2q-muted)] transition-colors hover:bg-[var(--d2q-surface-elevated)] hover:text-[var(--d2q-text)]"
        >
          + Create
        </Link>
        <Link
          href="/dashboard"
          className="rounded-lg px-3 py-2 text-sm font-medium text-[var(--d2q-muted)] transition-colors hover:bg-[var(--d2q-surface-elevated)] hover:text-[var(--d2q-text)]"
        >
          Explore
        </Link>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--d2q-accent-warm)]">
            Good morning
          </p>
          <p className="text-sm font-semibold text-[var(--d2q-text)]">
            Study partner
          </p>
        </div>
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-sm font-bold text-white ring-2 ring-[var(--d2q-border-strong)]"
          aria-hidden
        >
          S
        </div>
      </div>
    </header>
  );
}
