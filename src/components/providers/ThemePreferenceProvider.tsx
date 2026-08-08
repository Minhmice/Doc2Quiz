"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTheme } from "@teispace/next-themes";
import {
  DEFAULT_THEME_PREFERENCE,
  isThemePreference,
  type ThemePreference,
} from "@/lib/profile/themePreference";

const STORAGE_KEY = "doc2quiz-theme-preference";

type ThemePreferenceContextValue = {
  themePreference: ThemePreference;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
};

const ThemePreferenceContext = createContext<ThemePreferenceContextValue | null>(null);

function applyThemePreference(preference: ThemePreference, resolvedTheme?: string) {
  const theme = preference === "system"
    ? resolvedTheme === "light" ? "vscode-light" : "vscode-dark"
    : preference;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.toggle("dark", theme !== "vscode-light");
}

export function useThemePreference() {
  const value = useContext(ThemePreferenceContext);
  if (!value) throw new Error("useThemePreference must be used within ThemePreferenceProvider");
  return value;
}

export function ThemePreferenceProvider({ children, initialPreference }: { children: ReactNode; initialPreference?: ThemePreference }) {
  const { resolvedTheme, setTheme } = useTheme();
  const [themePreference, setPreference] = useState(initialPreference ?? DEFAULT_THEME_PREFERENCE);
  const [ready, setReady] = useState(initialPreference !== undefined);

  useEffect(() => {
    if (initialPreference === undefined) {
      const storedPreference = window.localStorage.getItem(STORAGE_KEY);
      if (isThemePreference(storedPreference)) setPreference(storedPreference);
    }
    setReady(true);
  }, [initialPreference]);

  useEffect(() => {
    if (!ready) return;
    setTheme(themePreference === "system" ? "system" : themePreference === "vscode-light" ? "light" : "dark");
    applyThemePreference(themePreference, resolvedTheme);
    window.localStorage.setItem(STORAGE_KEY, themePreference);
  }, [ready, resolvedTheme, setTheme, themePreference]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && isThemePreference(event.newValue)) setPreference(event.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setThemePreference = useCallback(async (next: ThemePreference) => {
    if (!isThemePreference(next)) return;
    const previous = themePreference;
    setPreference(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyThemePreference(next, resolvedTheme);
    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ themePreference: next }),
      });
      if (!response.ok) throw new Error("Could not save theme preference");
    } catch {
      setPreference(previous);
      window.localStorage.setItem(STORAGE_KEY, previous);
      applyThemePreference(previous, resolvedTheme);
      throw new Error("Could not save theme preference");
    }
  }, [resolvedTheme, themePreference]);

  const value = useMemo(() => ({ themePreference, setThemePreference }), [setThemePreference, themePreference]);
  return <ThemePreferenceContext.Provider value={value}>{children}</ThemePreferenceContext.Provider>;
}
