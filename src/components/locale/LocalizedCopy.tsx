"use client";

import { useEffect, useState } from "react";
import { useLocale } from "./LocaleProvider";
import type { Locale, SlangContext } from "@/lib/locale/types";

export type EventSlangSnapshot = Readonly<{
  locale: Locale;
  context: SlangContext;
  eventKey: string;
  text: string;
}>;

export function resolveEventSlang(
  previous: EventSlangSnapshot | null,
  locale: Locale,
  context: SlangContext,
  eventKey: string,
  enabled: boolean,
  select: () => string | null,
): EventSlangSnapshot | null {
  if (!enabled) return null;
  if (
    previous?.locale === locale &&
    previous.context === context &&
    previous.eventKey === eventKey
  ) {
    return previous;
  }
  const text = select();
  return text ? { locale, context, eventKey, text } : null;
}

export function useEventSlang(
  context: SlangContext,
  eventKey: string,
  enabled = true,
): string | null {
  const { locale, hydrated, getRandomSlang } = useLocale();
  const [snapshot, setSnapshot] = useState<EventSlangSnapshot | null>(null);

  useEffect(() => {
    setSnapshot((previous) =>
      resolveEventSlang(
        previous,
        locale,
        context,
        eventKey,
        hydrated && enabled,
        () => getRandomSlang(context)?.text ?? null,
      ),
    );
  }, [context, enabled, eventKey, getRandomSlang, hydrated, locale]);

  return snapshot?.text ?? null;
}

export function LocalizedSlangLine({
  context,
  eventKey,
  enabled = true,
  className,
}: Readonly<{
  context: SlangContext;
  eventKey: string;
  enabled?: boolean;
  className?: string;
}>) {
  const slang = useEventSlang(context, eventKey, enabled);
  if (!slang) return null;

  return (
    <p
      className={className ?? "mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground text-pretty"}
      aria-hidden="true"
    >
      {slang}
    </p>
  );
}
