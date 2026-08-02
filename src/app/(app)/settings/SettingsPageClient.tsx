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
    <section className="w-full space-y-6 pb-8">
      <header className="border-b border-border/70 pb-5">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.12em] text-primary">{messages.settings.application}</p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold leading-tight tracking-[-0.03em] text-foreground text-wrap-balance sm:text-4xl">
          {messages.navigation.settings}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
          {messages.settings.description}
        </p>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(18rem,0.8fr)] xl:items-start">
        <div className="space-y-6">
          <ProfileSettings />
          <section className="border-t border-border/70 pt-6">
            <SocialSafetySettings />
          </section>
          <section className="border-t border-border/70 pt-6">
            <AppearanceSettings />
          </section>
          <section className="border-t border-border/70 pt-6">
            <LanguageSelector />
          </section>
        </div>
        <div className="border-t border-border/70 pt-6 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
          <PlanUsageCard initialUsage={initialUsage} />
        </div>
      </div>
    </section>
  );
}
