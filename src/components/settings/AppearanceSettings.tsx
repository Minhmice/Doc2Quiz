"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { useThemePreference } from "@/components/providers/ThemePreferenceProvider";
import type { ThemePreference } from "@/lib/profile/themePreference";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale/LocaleProvider";

const OPTIONS: Array<{ value: ThemePreference; swatches: [string, string, string] }> = [
  { value: "system", swatches: ["#f7faf8", "#0c1a17", "#ff967d"] },
  { value: "vscode-dark", swatches: ["#1e1e1e", "#d4d4d4", "#569cd6"] },
  { value: "vscode-light", swatches: ["#ffffff", "#1e1e1e", "#0070c1"] },
  { value: "monokai", swatches: ["#272822", "#f8f8f2", "#f92672"] },
  { value: "high-contrast", swatches: ["#000000", "#ffffff", "#ffff00"] },
];

export function AppearanceSettings() {
  const { messages } = useLocale();
  const { themePreference, setThemePreference } = useThemePreference();
  const [feedback, setFeedback] = useState("");
  const options = OPTIONS.map((option) => ({ ...option, ...messages.settings.themes[option.value] }));

  const selectTheme = async (theme: ThemePreference) => {
    if (theme === themePreference) return;
    setFeedback(messages.settings.savingAppearance);
    try {
      await setThemePreference(theme);
      setFeedback(messages.settings.appearanceSaved);
    } catch {
      setFeedback(messages.settings.appearanceSaveFailed);
    }
  };

  return (
    <fieldset>
      <legend className="font-heading text-2xl font-bold tracking-[-0.03em] text-foreground text-wrap-balance sm:text-3xl">
        {messages.settings.appearance}
      </legend>
      <p className="mt-2 max-w-prose text-pretty text-sm leading-6 text-muted-foreground">
        {messages.settings.appearanceDescription}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label={messages.settings.appearanceAria}>
        {options.map((option) => {
          const selected = themePreference === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => void selectTheme(option.value)}
              onKeyDown={(event) => {
                if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
                event.preventDefault();
                const direction = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
                const next = OPTIONS[(OPTIONS.indexOf(option) + direction + OPTIONS.length) % OPTIONS.length];
                document.getElementById(`theme-${next.value}`)?.focus();
                void selectTheme(next.value);
              }}
              id={`theme-${option.value}`}
              className={cn(
                "flex min-h-24 w-full items-start gap-3 rounded-lg border p-4 text-left outline-none transition-colors hover:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring",
                selected ? "border-primary bg-accent text-accent-foreground" : "border-border bg-background hover:bg-accent/50",
              )}
            >
              <span className="mt-1 flex shrink-0 overflow-hidden rounded border border-black/20" aria-hidden>
                {option.swatches.map((color) => <span key={color} className="size-4" style={{ backgroundColor: color }} />)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-bold text-foreground">
                  {option.label}
                  {selected ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
                </span>
                <span className="mt-1 block text-sm leading-5 text-muted-foreground">{option.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="sr-only" aria-live="polite">{feedback}</p>
    </fieldset>
  );
}
