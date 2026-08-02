"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/buttons/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/components/locale/LocaleProvider";
import { fetchUserUsage, type UserUsage } from "@/lib/client/fetchUserUsage";

export function PlanUsageCard({ initialUsage }: { initialUsage?: UserUsage }) {
  const { messages } = useLocale();
  const [usage, setUsage] = useState<UserUsage | undefined>(initialUsage);
  useEffect(() => {
    if (initialUsage) return;
    void fetchUserUsage().then(setUsage).catch(() => undefined);
  }, [initialUsage]);
  const remaining = usage ? usage.weeklyRemaining + usage.bonusCredits : 0;
  return (
    <section className="rounded-xl border border-border p-5 sm:p-6" aria-labelledby="plan-usage-title">
      <p className="font-label text-[0.625rem] tracking-[0.08em] text-muted-foreground">{messages.settings.plan}</p>
      <h2 id="plan-usage-title" className="mt-1 font-heading text-xl font-bold text-foreground">{usage?.plan === "pro" ? "Pro" : messages.settings.free}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{usage ? messages.plan.remainingUsage(remaining) : messages.settings.loadingUsage}</p>
      <div className="mt-5 space-y-3">
        <label htmlFor="coupon-code" className="block text-[0.625rem] text-muted-foreground">{messages.settings.couponCode}</label>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input id="coupon-code" className="min-h-11" placeholder={messages.settings.enterCode} />
          <Button type="button" className="min-h-11 shrink-0">{messages.settings.redeem}</Button>
        </div>
      </div>
    </section>
  );
}
