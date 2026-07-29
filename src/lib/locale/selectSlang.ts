import { slangCatalog } from "./slang";
import type { Locale, SlangContext, SlangEntry } from "./types";

export type RandomSource = () => number;

export function selectSlang(
  entries: readonly SlangEntry[],
  previous: string | undefined,
  random: RandomSource = Math.random,
): SlangEntry | null {
  if (entries.length === 0) return null;
  const candidates = entries.length > 1 ? entries.filter(({ text }) => text !== previous) : entries;
  if (candidates.length === 0) return entries[0] ?? null;
  const sample = random();
  const normalized = Number.isFinite(sample) ? Math.min(1, Math.max(0, sample)) : 0;
  const index = Math.min(candidates.length - 1, Math.floor(normalized * candidates.length));
  return candidates[index] ?? null;
}

export type SlangRotator = {
  getRandomSlang: (context: SlangContext, locale: Locale) => SlangEntry | null;
  reset: (locale?: Locale) => void;
};

export function createSlangRotator(random: RandomSource = Math.random): SlangRotator {
  const history = new Map<string, string>();
  const keyFor = (locale: Locale, context: SlangContext) => `${locale}:${context}`;

  return {
    getRandomSlang(context, locale) {
      const key = keyFor(locale, context);
      const selected = selectSlang(slangCatalog[locale][context], history.get(key), random);
      if (selected) history.set(key, selected.text);
      return selected;
    },
    reset(locale) {
      if (!locale) {
        history.clear();
        return;
      }
      for (const key of history.keys()) if (key.startsWith(`${locale}:`)) history.delete(key);
    },
  };
}
