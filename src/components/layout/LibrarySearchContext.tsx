"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export {
  FOCUS_LIBRARY_SEARCH_EVENT,
  ACTIVITY_STATS_CHANGED_EVENT,
} from "@/lib/appEvents";

type LibrarySearchContextValue = {
  search: string;
  setSearch: (value: string) => void;
  mobileSearchOpen: boolean;
  setMobileSearchOpen: (open: boolean) => void;
  desktopSearchRef: React.RefObject<HTMLInputElement | null>;
  focusLibrarySearch: () => void;
};

const LibrarySearchContext = createContext<LibrarySearchContextValue | null>(
  null,
);

export function LibrarySearchProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const desktopSearchRef = useRef<HTMLInputElement | null>(null);

  const focusLibrarySearch = useCallback(() => {
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 640px)").matches) {
      queueMicrotask(() => desktopSearchRef.current?.focus());
    } else {
      setMobileSearchOpen(true);
    }
  }, []);

  const value = useMemo(
    () => ({
      search,
      setSearch,
      mobileSearchOpen,
      setMobileSearchOpen,
      desktopSearchRef,
      focusLibrarySearch,
    }),
    [search, mobileSearchOpen, focusLibrarySearch],
  );

  return (
    <LibrarySearchContext.Provider value={value}>
      {children}
    </LibrarySearchContext.Provider>
  );
}

export function useLibrarySearch(): LibrarySearchContextValue {
  const ctx = useContext(LibrarySearchContext);
  if (!ctx) {
    throw new Error("useLibrarySearch must be used within LibrarySearchProvider");
  }
  return ctx;
}
