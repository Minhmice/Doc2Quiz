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

let mathJaxLoadPromise: Promise<void> | null = null;

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
  mathJaxLoadPromise = new Promise((resolve, reject) => {
    if (document.querySelector("script[data-doc2quiz-mathjax]")) {
      void waitForTypeset().then(resolve).catch(reject);
      return;
    }
    window.MathJax = {
      loader: {
        paths: { mathjax: "/mathjax/es5" },
      },
      tex: {
        packages: { "[+]": ["noerrors", "noundefined"] },
      },
      options: {
        enableMenu: false,
      },
    };
    const script = document.createElement("script");
    script.dataset.doc2quizMathjax = "1";
    script.src = "/mathjax/es5/tex-chtml.js";
    script.async = true;
    script.onload = () => {
      void waitForTypeset().then(resolve).catch(reject);
    };
    script.onerror = () =>
      reject(new Error("Failed to load MathJax from /mathjax/es5/tex-chtml.js"));
    document.head.appendChild(script);
  });
  return mathJaxLoadPromise;
}

async function waitForTypeset(): Promise<void> {
  for (let i = 0; i < 200; i += 1) {
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
  const rootRef = useRef<HTMLSpanElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, [debouncedSource]);

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
      {error ? (
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
