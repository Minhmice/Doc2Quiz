"use client";

import { CheckIcon } from "lucide-react";
import { useLocale } from "@/components/locale/LocaleProvider";
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Locale, MessageCatalog } from "@/lib/locale/types";
import { cn } from "@/lib/utils";

function localeTooltip(value: Locale, m: MessageCatalog): string {
  return value === "en" ? m.settings.englishTooltip : m.settings.vietnameseTooltip;
}

export function LanguageSelector({ mode = "full" }: { mode?: "compact" | "full" }) {
  const { locale, messages, setLocale } = useLocale();
  const options: Array<{ value: Locale; label: string; tooltip: string }> = [
    { value: "vi", label: messages.settings.vietnamese, tooltip: localeTooltip("vi", messages) },
    { value: "en", label: messages.settings.english, tooltip: localeTooltip("en", messages) },
  ];

  if (mode === "compact") {
    return (
      <>
        <DropdownMenuLabel className="px-2 pt-2 text-sm font-semibold">
          {messages.settings.languageTitle}
        </DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={(value) => setLocale(value as Locale)}>
          {options.map((option) => (
            <DropdownMenuRadioItem
              key={option.value}
              value={option.value}
              className="min-h-11 cursor-pointer px-2 pr-8 text-base font-semibold"
            >
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </>
    );
  }

  return (
    <fieldset>
      <legend className="font-heading text-2xl font-bold tracking-[-0.03em] text-foreground text-wrap-balance sm:text-3xl">
        {messages.settings.languageTitle}
      </legend>
      <p className="mt-2 max-w-prose text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl">
        {messages.settings.languageSubtitle}
      </p>
      <div
        className="mt-6 grid gap-3 sm:grid-cols-2"
        role="radiogroup"
        aria-label={`${messages.settings.languageTitle}. ${messages.settings.languageSubtitle}`}
      >
        {options.map((option) => {
          const selected = locale === option.value;
          return (
            <Tooltip key={option.value}>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={option.label}
                    onClick={() => setLocale(option.value)}
                    className={cn(
                      "flex min-h-[3.25rem] w-full items-center justify-between rounded-lg border px-5 py-3.5 text-left text-xl font-bold tracking-[-0.03em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:min-h-14 sm:text-2xl",
                      selected
                        ? "border-primary bg-accent text-accent-foreground"
                        : "border-border bg-background hover:bg-accent/50",
                    )}
                  />
                }
              >
                <span>{option.label}</span>
                {selected ? <CheckIcon className="size-6 shrink-0" aria-hidden /> : null}
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-left leading-snug">
                {option.tooltip}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </fieldset>
  );
}
