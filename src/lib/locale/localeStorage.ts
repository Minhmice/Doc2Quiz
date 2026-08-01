import { DEFAULT_LOCALE } from "./messages";
import type { Locale } from "./types";

export const LOCALE_STORAGE_KEY = "doc2quiz.locale";
export const LOCALE_COOKIE_KEY = "doc2quiz.locale";

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "vi";
}

function browserStorage(): Storage | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export function readLocale(storage: Storage | undefined = browserStorage()): Locale {
  if (!storage) return DEFAULT_LOCALE;
  try {
    const value = storage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(value) ? value : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function writeLocale(locale: Locale, storage: Storage | undefined = browserStorage()): boolean {
  if (!isLocale(locale) || !storage) return false;
  try {
    storage.setItem(LOCALE_STORAGE_KEY, locale);
    return true;
  } catch {
    return false;
  }
}
