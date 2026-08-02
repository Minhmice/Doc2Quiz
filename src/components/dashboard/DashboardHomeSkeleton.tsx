"use client";

import { useLocale } from "@/components/locale/LocaleProvider";

export function DashboardHomeSkeleton() {
  const { messages } = useLocale();
  return (
    <div
      className="relative z-1 w-full min-w-0 space-y-6 px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
      aria-busy="true"
      aria-label={messages.dashboard.loadingDashboard}
    >
      <section className="rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
        <div className="flex min-h-[84px] flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-9 w-3/4 max-w-md rounded-md bg-muted/60" />
            <div className="h-4 w-full max-w-lg rounded bg-muted/40" />
          </div>
          <div className="h-10 w-36 shrink-0 rounded-md bg-muted/55" />
        </div>
      </section>

      <section className="space-y-4" aria-hidden="true">
        <div className="flex min-h-[54px] flex-col gap-3 border-b border-border/40 pb-3 xl:flex-row xl:items-end xl:justify-between">
          <div className="h-8 w-44 rounded-md bg-muted/55" />
          <div className="flex gap-3">
            <div className="h-9 w-52 rounded-lg bg-muted/45" />
            <div className="h-9 w-32 rounded-lg bg-muted/45" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-48 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
            >
              <div className="h-5 w-3/4 rounded bg-muted/55" />
              <div className="mt-3 h-4 w-1/2 rounded bg-muted/40" />
              <div className="mt-12 h-9 w-full rounded bg-muted/45" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
