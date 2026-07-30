"use client";

import { LanguageSelector } from "@/components/locale/LanguageSelector";
import { useLocale } from "@/components/locale/LocaleProvider";
import { PlanUsageCard } from "@/components/settings/PlanUsageCard";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SocialSafetySettings } from "@/components/settings/SocialSafetySettings";
import type { UserUsage } from "@/lib/client/fetchUserUsage";

export function SettingsPageClient({ initialUsage }: { initialUsage: UserUsage }) {
  const { messages } = useLocale();

  return (
    <section className="w-full space-y-8 pb-10">
      <header className="border-b border-border pb-6">
        <h1 className="font-heading text-3xl font-extrabold tracking-tight text-foreground text-wrap-balance">
          {messages.navigation.settings}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
          Control your identity, study access, workspace language, and social safety.
        </p>
      </header>

      <div className="grid gap-8 xl:grid-cols-2 xl:items-start">
        <div className="space-y-8">
          <ProfileSettings />
          <section className="border-t border-border pt-6">
            <SocialSafetySettings />
          </section>
          <section className="border-t border-border pt-6">
            <LanguageSelector />
          </section>
        </div>
        <div className="border-t border-border pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0">
          <PlanUsageCard initialUsage={initialUsage} />
        </div>
      </div>
    </section>
  );
}
