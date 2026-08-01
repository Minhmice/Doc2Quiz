"use client";

import { LanguageSelector } from "@/components/locale/LanguageSelector";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { useLocale } from "@/components/locale/LocaleProvider";
import { PlanUsageCard } from "@/components/settings/PlanUsageCard";
import { ProfileSettings } from "@/components/settings/ProfileSettings";
import { SocialSafetySettings } from "@/components/settings/SocialSafetySettings";
import type { UserUsage } from "@/lib/client/fetchUserUsage";

export function SettingsPageClient({ initialUsage }: { initialUsage: UserUsage }) {
  const { messages } = useLocale();

  return (
    <section className="w-full space-y-5 pb-8">
      <header className="flex flex-col gap-2 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
        <h1 className="font-heading text-4xl font-extrabold leading-none tracking-[-0.03em] text-foreground text-wrap-balance">
          {messages.navigation.settings}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-muted-foreground text-pretty">
          Control your identity, study access, workspace language, and social safety.
        </p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">Changes save to this device instantly.</p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)] xl:items-start">
        <div className="space-y-6">
          <ProfileSettings />
          <section className="border-t border-border pt-5">
            <SocialSafetySettings />
          </section>
          <section className="border-t border-border pt-5">
            <AppearanceSettings />
          </section>
          <section className="border-t border-border pt-5">
            <LanguageSelector />
          </section>
        </div>
        <div className="border-t border-border pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <PlanUsageCard initialUsage={initialUsage} />
        </div>
      </div>
    </section>
  );
}
