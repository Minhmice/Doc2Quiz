"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { importPendingAnonymousQuizAttempts } from "@/lib/client/anonymousQuizAttempts";
import { AppShell } from "@/components/layout/AppShell";
import { RoutePrefetch } from "@/components/layout/RoutePrefetch";
import { LocaleProvider } from "@/components/locale/LocaleProvider";
import { DisplayNameProvider } from "@/components/profile/DisplayNameProvider";

const CommandPalette = dynamic(
  () =>
    import("@/components/layout/CommandPalette").then((mod) => mod.CommandPalette),
  { ssr: false },
);

/** Avoid loading palette chunks during initial dev compile (Windows chunk races). */
function DeferredCommandPalette() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const start = () => setReady(true);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(start, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(start, 2000);
    return () => window.clearTimeout(t);
  }, []);

  return ready ? <CommandPalette /> : null;
}

function AnonymousQuizAttemptImporter() {
  useEffect(() => {
    void importPendingAnonymousQuizAttempts();
  }, []);

  return null;
}

export function AppProviders({
  children,
  initialLocale,
  initialUsage,
}: {
  children: React.ReactNode;
  initialLocale?: import("@/lib/locale/types").Locale;
  initialUsage?: import("@/lib/client/fetchUserUsage").UserUsage;
}) {
  return (
    <LocaleProvider initialLocale={initialLocale}>
      <DisplayNameProvider>
        <RoutePrefetch />
        <AnonymousQuizAttemptImporter />
        {/* CommandPalette must mount after AppShell so ssr:false does not shift useId for Base UI in the shell. */}
        <AppShell initialUsage={initialUsage}>{children}</AppShell>
        <DeferredCommandPalette />
      </DisplayNameProvider>
    </LocaleProvider>
  );
}
