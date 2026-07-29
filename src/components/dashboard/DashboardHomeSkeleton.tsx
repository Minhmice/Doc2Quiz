"use client";

import type { CSSProperties } from "react";
import { useLocale } from "@/components/locale/LocaleProvider";

export function DashboardHomeSkeleton() {
  const { messages } = useLocale();
  return (
    <main
      className="relative z-[1] mx-auto w-full max-w-7xl min-w-0 space-y-8 py-6 sm:py-8"
      aria-busy="true"
      aria-label={messages.dashboard.loadingDashboard}
    >
      <section className="d2q-dashboard-enter rounded-lg border border-border/20 bg-card p-6 shadow-sm sm:p-8 [--i:0]">
        <div className="flex min-h-[92px] flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-9 w-3/4 max-w-md animate-pulse rounded-md bg-muted/60 motion-reduce:animate-none" />
            <div className="h-4 w-full max-w-lg animate-pulse rounded bg-muted/40 motion-reduce:animate-none" />
          </div>
          <div className="h-10 w-36 shrink-0 animate-pulse rounded-md bg-muted/55 motion-reduce:animate-none" />
        </div>
      </section>

      <section className="d2q-dashboard-enter space-y-6 [--i:1]" aria-hidden="true">
        <div className="flex min-h-[54px] flex-col gap-4 border-b border-border/40 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="h-8 w-44 animate-pulse rounded-md bg-muted/55 motion-reduce:animate-none" />
          <div className="flex gap-3">
            <div className="h-9 w-52 animate-pulse rounded-lg bg-muted/45 motion-reduce:animate-none" />
            <div className="h-9 w-32 animate-pulse rounded-lg bg-muted/45 motion-reduce:animate-none" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="d2q-dashboard-card-enter h-48 animate-pulse rounded-xl border border-border/60 bg-card p-5 motion-reduce:animate-none"
              style={{ "--card-i": index } as CSSProperties}
            >
              <div className="h-5 w-3/4 rounded bg-muted/55" />
              <div className="mt-3 h-4 w-1/2 rounded bg-muted/40" />
              <div className="mt-12 h-9 w-full rounded bg-muted/45" />
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
