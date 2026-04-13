"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  LS_DISPLAY_NAME,
  LS_NAME_PROMPT_DISMISSED,
  readDisplayName,
  readPromptDismissed,
  writeDisplayName as persistDisplayName,
  writePromptDismissed,
} from "@/lib/profile/displayNameStorage";

const MAX_LEN = 40;

type DisplayNameContextValue = {
  displayName: string;
  setDisplayName: (value: string) => void;
  dismissPrompt: () => void;
  /** True after localStorage read: no saved name and user has not skipped. */
  needsDisplayNamePrompt: boolean;
};

const DisplayNameContext = createContext<DisplayNameContextValue | null>(null);

export function useDisplayName(): DisplayNameContextValue {
  const ctx = useContext(DisplayNameContext);
  if (!ctx) {
    throw new Error("useDisplayName must be used within DisplayNameProvider");
  }
  return ctx;
}

export function DisplayNameProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [displayName, setDisplayNameState] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [promptDismissed, setPromptDismissed] = useState(false);

  useEffect(() => {
    const name = readDisplayName() ?? "";
    const dismissed = readPromptDismissed();
    setDisplayNameState(name);
    setPromptDismissed(dismissed);
    setHydrated(true);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null) {
        return;
      }
      if (e.key !== LS_DISPLAY_NAME && e.key !== LS_NAME_PROMPT_DISMISSED) {
        return;
      }
      setDisplayNameState(readDisplayName() ?? "");
      setPromptDismissed(readPromptDismissed());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setDisplayName = useCallback((value: string) => {
    const next = value.slice(0, MAX_LEN);
    setDisplayNameState(next);
    persistDisplayName(next);
  }, []);

  const dismissPrompt = useCallback(() => {
    writePromptDismissed();
    setPromptDismissed(true);
  }, []);

  const needsDisplayNamePrompt =
    hydrated && !displayName.trim() && !promptDismissed;

  const value = useMemo(
    () => ({
      displayName,
      setDisplayName,
      dismissPrompt,
      needsDisplayNamePrompt,
    }),
    [displayName, setDisplayName, dismissPrompt, needsDisplayNamePrompt],
  );

  return (
    <DisplayNameContext.Provider value={value}>
      {children}
    </DisplayNameContext.Provider>
  );
}

export const DISPLAY_NAME_MAX_LEN = MAX_LEN;
