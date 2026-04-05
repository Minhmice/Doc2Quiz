"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppTopBar } from "@/components/layout/AppTopBar";

const links = [
  {
    href: "/dashboard",
    label: "Library",
    Icon: IconLibrary,
  },
  {
    href: "/sets/new",
    label: "New set",
    Icon: IconPlus,
  },
  {
    href: "/settings",
    label: "Settings",
    Icon: IconCog,
  },
] as const;

function IconLibrary({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function IconCog({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--d2q-bg)]">
      <AppTopBar />

      <div className="flex min-h-0 flex-1 flex-col pb-16 lg:flex-row lg:pb-0">
        <aside
          className="fixed bottom-0 left-0 right-0 z-30 flex flex-row justify-around border-t border-[var(--d2q-border)] bg-[var(--d2q-surface)]/95 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-md lg:static lg:w-52 lg:shrink-0 lg:flex-col lg:justify-start lg:gap-1 lg:border-r lg:border-t-0 lg:p-3 lg:pb-3"
          aria-label="Main"
        >
          {links.map(({ href, label, Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard" || pathname === "/"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors lg:flex-row lg:gap-3 lg:px-3 lg:py-2.5 lg:text-sm ${
                  active
                    ? "bg-[var(--d2q-accent-muted)] text-[var(--d2q-accent-hover)] ring-1 ring-[var(--d2q-accent)]/35"
                    : "text-[var(--d2q-muted)] hover:bg-[var(--d2q-surface-elevated)] hover:text-[var(--d2q-text)]"
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden />
                <span className="sr-only lg:not-sr-only lg:inline">{label}</span>
              </Link>
            );
          })}
        </aside>

        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-3 py-5 pb-24 sm:px-5 lg:px-8 lg:py-8 lg:pb-8">
          {children}
        </main>
      </div>
    </div>
  );
}
