"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_LOCALE, messages } from "@/lib/locale/messages";
import {
  isLocale,
  LOCALE_STORAGE_KEY,
  readLocale,
  writeLocale,
} from "@/lib/locale/localeStorage";
import { createSlangRotator, type SlangRotator } from "@/lib/locale/selectSlang";
import type { Locale, MessageCatalog, SlangContext, SlangEntry } from "@/lib/locale/types";

type LocaleContextValue = {
  locale: Locale;
  hydrated: boolean;
  messages: MessageCatalog;
  setLocale: (locale: Locale) => void;
  getRandomSlang: (context: SlangContext) => SlangEntry | null;
};

type StorageEventLike = Pick<StorageEvent, "key" | "newValue">;
type DocumentRoot = { lang: string };

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function readInitialLocale(storage?: Storage): Locale {
  return readLocale(storage);
}

export function applyDocumentLocale(locale: Locale, root: DocumentRoot): void {
  root.lang = locale;
}

export function localeFromStorageEvent(event: StorageEventLike): Locale | null {
  if (event.key !== LOCALE_STORAGE_KEY || !isLocale(event.newValue)) return null;
  return event.newValue;
}

export function useLocale(): LocaleContextValue {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used within LocaleProvider");
  return value;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [hydrated, setHydrated] = useState(false);
  const rotatorRef = useRef<SlangRotator | null>(null);
  if (!rotatorRef.current) rotatorRef.current = createSlangRotator();

  useEffect(() => {
    const storedLocale = readInitialLocale();
    setLocaleState(storedLocale);
    applyDocumentLocale(storedLocale, document.documentElement);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      const nextLocale = localeFromStorageEvent(event);
      if (!nextLocale) return;
      setLocaleState(nextLocale);
      applyDocumentLocale(nextLocale, document.documentElement);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setLocale = useCallback((nextLocale: Locale) => {
    if (!isLocale(nextLocale)) return;
    setLocaleState(nextLocale);
    writeLocale(nextLocale);
    applyDocumentLocale(nextLocale, document.documentElement);
  }, []);

  const getRandomSlang = useCallback(
    (context: SlangContext) => rotatorRef.current?.getRandomSlang(context, locale) ?? null,
    [locale],
  );

  const value = useMemo(
    () => ({ locale, hydrated, messages: messages[locale], setLocale, getRandomSlang }),
    [getRandomSlang, hydrated, locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
