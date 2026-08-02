"use client";

import { LanguageSelector } from "@/components/locale/LanguageSelector";
import { useLocale } from "@/components/locale/LocaleProvider";
import { AppearanceSettings } from "@/components/settings/AppearanceSettings";
import { Card, CardContent } from "@/components/ui/card";

export default function SettingsPage() {
  const { messages } = useLocale();

  return (
    <div className="w-full max-w-3xl space-y-6 pb-8">
      <header className="border-b border-border/70 pb-5">
        <p className="font-label text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
          Application
        </p>
        <h1 className="mt-2 font-heading text-3xl font-extrabold leading-tight tracking-[-0.03em] text-foreground sm:text-4xl">
          {messages.navigation.settings}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground text-pretty">
          Choose how Doc2Quiz looks and reads on this device.
        </p>
      </header>
      <div className="grid gap-4">
        <Card className="rounded-lg">
          <CardContent className="p-5 sm:p-6"><AppearanceSettings /></CardContent>
        </Card>
        <Card className="rounded-lg">
          <CardContent className="p-5 sm:p-6"><LanguageSelector /></CardContent>
        </Card>
      </div>
    </div>
  );
}
