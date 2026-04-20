"use client";

import { splitMathSegments } from "@/lib/math/splitMathSegments";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

export type MathTextProps = {
  source: string;
  className?: string;
  /** 0 = update as soon as `source` changes (default). Editor should pass 300–500. */
  debounceMs?: number;
};

type MathJaxApi = {
  loader?: { paths?: Record<string, string> };
  tex?: { packages?: Record<string, string[]> };
  options?: { enableMenu?: boolean };
  typesetPromise?: (nodes?: (HTMLElement | null)[]) => Promise<void>;
  startup?: { promise?: Promise<void> };
};

declare global {
  interface Window {
    MathJax?: MathJaxApi;
  }
}

/** Keep in sync with package.json `mathjax` version (CDN fallback). */
const MATHJAX_PKG_VERSION = "3.2.2";
const MATHJAX_LOCAL_BASE = "/mathjax/es5";
const MATHJAX_LOCAL_SCRIPT = `${MATHJAX_LOCAL_BASE}/tex-chtml.js`;
const MATHJAX_CDN_BASE = `https://cdn.jsdelivr.net/npm/mathjax@${MATHJAX_PKG_VERSION}/es5`;
const MATHJAX_CDN_SCRIPT = `${MATHJAX_CDN_BASE}/tex-chtml.js`;

let mathJaxLoadPromise: Promise<void> | null = null;

function configureMathJax(pathsBase: string): void {
  window.MathJax = {
    loader: {
      paths: { mathjax: pathsBase },
    },
    tex: {
      packages: { "[+]": ["noerrors", "noundefined"] },
    },
    options: {
      enableMenu: false,
    },
  };
}

function resetMathJaxLoader(): void {
  document
    .querySelectorAll("script[data-doc2quiz-mathjax]")
    .forEach((el) => el.remove());
  delete (window as unknown as { MathJax?: unknown }).MathJax;
}

function injectMathJaxScript(scriptUrl: string, pathsBase: string): Promise<void> {
  return new Promise((resolve, reject) => {
    configureMathJax(pathsBase);
    const script = document.createElement("script");
    script.dataset.doc2quizMathjax = "1";
    script.src = scriptUrl;
    script.async = true;
    script.onload = () => {
      void waitForTypeset().then(resolve).catch(reject);
    };
    script.onerror = () => {
      reject(new Error(`Failed to load MathJax script: ${scriptUrl}`));
    };
    document.head.appendChild(script);
  });
}

/**
 * Load MathJax (local → CDN on failure). If a stale script tag exists without a working
 * `typesetPromise` (e.g. Fast Refresh), remove it and inject again.
 */
async function loadMathJaxWithRecovery(): Promise<void> {
  const hasScript = () =>
    document.querySelector("script[data-doc2quiz-mathjax]") !== null;

  try {
    if (!hasScript()) {
      await injectMathJaxScript(MATHJAX_LOCAL_SCRIPT, MATHJAX_LOCAL_BASE);
    } else {
      await waitForTypeset();
    }
    if (!window.MathJax?.typesetPromise) {
      throw new Error("MathJax API missing");
    }
  } catch {
    resetMathJaxLoader();
    try {
      await injectMathJaxScript(MATHJAX_LOCAL_SCRIPT, MATHJAX_LOCAL_BASE);
    } catch {
      resetMathJaxLoader();
      await injectMathJaxScript(MATHJAX_CDN_SCRIPT, MATHJAX_CDN_BASE);
    }
    if (!window.MathJax?.typesetPromise) {
      throw new Error("MathJax did not initialize");
    }
  }
}

function loadMathJaxFromPublic(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  if (window.MathJax?.typesetPromise) {
    return Promise.resolve();
  }
  if (mathJaxLoadPromise) {
    return mathJaxLoadPromise;
  }
  mathJaxLoadPromise = loadMathJaxWithRecovery().catch((e) => {
    mathJaxLoadPromise = null;
    throw e;
  });
  return mathJaxLoadPromise;
}

/** ~6.4s max — MathJax 3 can be slow on first paint after script onload. */
async function waitForTypeset(): Promise<void> {
  for (let i = 0; i < 400; i += 1) {
    if (window.MathJax?.typesetPromise) {
      if (window.MathJax.startup?.promise) {
        await window.MathJax.startup.promise;
      }
      return;
    }
    await new Promise((r) => setTimeout(r, 16));
  }
  throw new Error("MathJax did not initialize");
}

function wrapTex(body: string, display: boolean): string {
  if (display) {
    return `\\[${body}\\]`;
  }
  return `\\(${body}\\)`;
}

function useDebouncedSource(value: string, ms: number): string {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    if (ms <= 0) {
      setDebounced(value);
      return;
    }
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function MathText({ source, className, debounceMs = 0 }: MathTextProps) {
  const debouncedSource = useDebouncedSource(source, debounceMs ?? 0);
  const segments = useMemo(
    () => splitMathSegments(debouncedSource),
    [debouncedSource],
  );
  const needsMath = useMemo(
    () => segments.some((s) => s.kind === "math"),
    [segments],
  );
  const rootRef = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!needsMath) {
      setError(null);
      return;
    }
    let cancelled = false;
    const run = async () => {
      setError(null);
      try {
        await loadMathJaxFromPublic();
        if (cancelled || !rootRef.current) {
          return;
        }
        const mj = window.MathJax;
        if (!mj?.typesetPromise) {
          throw new Error("MathJax API missing");
        }
        const clear = (mj as { typesetClear?: (n: HTMLElement[]) => void })
          .typesetClear;
        clear?.([rootRef.current]);
        await mj.typesetPromise([rootRef.current]);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Math render failed");
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedSource, needsMath]);

  return (
    <span className={cn("math-text-root inline-block max-w-full", className)}>
      <span ref={rootRef} className="math-text-inner">
        {segments.map((seg, idx) =>
          seg.kind === "text" ? (
            <span key={idx} className="whitespace-pre-wrap">
              {seg.value}
            </span>
          ) : (
            <span key={idx} className="mjx-wrap text-foreground">
              {wrapTex(seg.value, Boolean(seg.display))}
            </span>
          ),
        )}
      </span>
      {error && needsMath ? (
        <span className="mt-1 block text-xs text-destructive/90">
          {error} — raw:{" "}
          <code className="rounded bg-muted px-1 font-mono text-[11px]">
            {source.length > 120 ? `${source.slice(0, 120)}…` : source}
          </code>
        </span>
      ) : null}
    </span>
  );
}
