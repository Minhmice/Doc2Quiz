"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { ParseProgressPhase } from "@/types/studySet";
import type { PdfUploadCapabilityMode } from "@/types/uploads";

export type LivePageThumb = {
  pageIndex: number;
  dataUrl: string;
};

export type LiveParseReport = {
  studySetId: string;
  running: boolean;
  phase: ParseProgressPhase;
  current: number;
  total: number;
  /** Total pages in the PDF (from metadata), for UI copy */
  documentPageCount?: number;
  /** Questions collected so far during vision steps */
  extractedQuestionCount?: number;
  /** Recent status lines (newest last), timestamp-prefixed by producer */
  parseLog?: readonly string[];
  /** Rasterization progress (1-based page index just finished) */
  renderPageIndex?: number;
  renderPageTotal?: number;
  /** Small previews of pages already rendered (capped by producer) */
  pageThumbnails?: readonly LivePageThumb[];
};

/** Background PDF bytes upload (direct-upload only); omitted in local-only mode. */
export type LiveUploadProgress = {
  studySetId: string;
  uploadedBytes: number;
  totalBytes: number;
  running: boolean;
  capabilityMode: PdfUploadCapabilityMode;
};

type ParseProgressContextValue = {
  live: LiveParseReport | null;
  upload: LiveUploadProgress | null;
  reportParse: (r: LiveParseReport) => void;
  reportUpload: (u: LiveUploadProgress | null) => void;
  clearParse: (studySetId?: string) => void;
  clearUpload: (studySetId?: string) => void;
};

const ParseProgressContext = createContext<ParseProgressContextValue | null>(
  null,
);

export function ParseProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [live, setLive] = useState<LiveParseReport | null>(null);
  const [upload, setUpload] = useState<LiveUploadProgress | null>(null);

  const reportParse = useCallback((r: LiveParseReport) => {
    setLive(r);
  }, []);

  const reportUpload = useCallback((u: LiveUploadProgress | null) => {
    setUpload(u);
  }, []);

  const clearParse = useCallback((studySetId?: string) => {
    setLive((prev) => {
      if (!prev) {
        return null;
      }
      if (studySetId !== undefined && prev.studySetId !== studySetId) {
        return prev;
      }
      return null;
    });
  }, []);

  const clearUpload = useCallback((studySetId?: string) => {
    setUpload((prev) => {
      if (!prev) {
        return null;
      }
      if (studySetId !== undefined && prev.studySetId !== studySetId) {
        return prev;
      }
      return null;
    });
  }, []);

  const value = useMemo(
    () => ({
      live,
      upload,
      reportParse,
      reportUpload,
      clearParse,
      clearUpload,
    }),
    [live, upload, reportParse, reportUpload, clearParse, clearUpload],
  );

  return (
    <ParseProgressContext.Provider value={value}>
      {children}
    </ParseProgressContext.Provider>
  );
}

export function useParseProgress(): ParseProgressContextValue {
  const ctx = useContext(ParseProgressContext);
  if (!ctx) {
    throw new Error("useParseProgress must be used within ParseProgressProvider");
  }
  return ctx;
}
