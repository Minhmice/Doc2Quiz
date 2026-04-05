"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = (id: string) =>
  [
    { href: `/sets/${id}/source`, label: "Source" },
    { href: `/sets/${id}/review`, label: "Review" },
    { href: `/sets/${id}/play`, label: "Take quiz" },
    { href: `/sets/${id}/done`, label: "Done" },
  ] as const;

export function SetSubNav({ studySetId }: { studySetId: string }) {
  const pathname = usePathname();
  const items = tabs(studySetId);

  return (
    <nav
      className="mb-8 flex flex-wrap gap-2 border-b border-[var(--d2q-border)] pb-3"
      aria-label="Study set"
    >
      {items.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-[var(--d2q-accent)] text-white shadow-md shadow-violet-950/30"
                : "bg-[var(--d2q-surface-elevated)] text-[var(--d2q-muted)] ring-1 ring-[var(--d2q-border)] hover:bg-[var(--d2q-surface)] hover:text-[var(--d2q-text)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
