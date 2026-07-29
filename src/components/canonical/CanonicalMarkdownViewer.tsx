"use client";

import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useRef,
  useState,
} from "react";

import type { CanonicalSection } from "@/lib/client/canonicalizeStudySet";
import { fetchCanonicalSectionPage } from "@/lib/client/canonicalReader";
import type {
  CanonicalSectionBody,
  CanonicalSectionIndexItem,
  CanonicalSectionPage,
} from "@/lib/workspaces/canonicalReader";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Max pages of section bodies retained in client memory. */
const MAX_CACHED_PAGES = 5;
/** Keep ReactMarkdown mounted only near the last visible ordinal window. */
const MOUNT_WINDOW = 12;

export type ProgressiveCanonicalSource = Readonly<{
  workspaceId: string;
  versionId: string;
  sectionIndex: CanonicalSectionIndexItem[];
  initialPage?: CanonicalSectionPage;
  pageLimit?: number;
}>;

export type CanonicalMarkdownViewerProps = Readonly<{
  /** Legacy full-document markdown fallback (study-set path). */
  markdown?: string;
  /** Legacy sections with bodies already loaded. */
  sections?: CanonicalSection[];
  /** Workspace-native progressive reader (paginated bodies). */
  progressive?: ProgressiveCanonicalSource;
  className?: string;
}>;

const markdownComponents: Components = {
  a: ({ href, children, ...props }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-chart-2 underline-offset-2 hover:underline"
      {...props}
    >
      {children}
    </a>
  ),
  h1: ({ children, ...props }) => (
    <h1
      className="font-heading text-2xl font-extrabold tracking-tight"
      {...props}
    >
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2
      className="font-heading text-2xl font-extrabold tracking-tight"
      {...props}
    >
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3
      className="font-heading text-2xl font-extrabold tracking-tight"
      {...props}
    >
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-sm font-extrabold" {...props}>
      {children}
    </h4>
  ),
  h5: ({ children, ...props }) => (
    <h5 className="text-sm font-extrabold" {...props}>
      {children}
    </h5>
  ),
  h6: ({ children, ...props }) => (
    <h6 className="text-sm font-extrabold" {...props}>
      {children}
    </h6>
  ),
  p: ({ children, ...props }) => (
    <p className="text-sm leading-relaxed" {...props}>
      {children}
    </p>
  ),
  li: ({ children, ...props }) => (
    <li className="text-sm leading-relaxed" {...props}>
      {children}
    </li>
  ),
  td: ({ children, ...props }) => (
    <td className="border border-border px-2 py-1 text-sm" {...props}>
      {children}
    </td>
  ),
  th: ({ children, ...props }) => (
    <th
      className="border border-border px-2 py-1 text-left text-sm font-extrabold"
      {...props}
    >
      {children}
    </th>
  ),
  pre: ({ children, ...props }) => (
    <pre
      className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-sm"
      {...props}
    >
      {children}
    </pre>
  ),
  code: ({ children, className, ...props }) => {
    const isBlock = className?.includes("language-");
    if (isBlock) {
      return (
        <code className={cn("font-mono text-sm", className)} {...props}>
          {children}
        </code>
      );
    }
    return (
      <code className="rounded bg-muted px-1 font-mono text-sm" {...props}>
        {children}
      </code>
    );
  },
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
};

function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}

function clampPageCache(
  cache: Map<number, CanonicalSectionBody>,
  pageOrder: number[][],
): { cache: Map<number, CanonicalSectionBody>; pageOrder: number[][] } {
  if (pageOrder.length <= MAX_CACHED_PAGES) {
    return { cache, pageOrder };
  }
  const dropCount = pageOrder.length - MAX_CACHED_PAGES;
  const nextOrder = pageOrder.slice(dropCount);
  const keep = new Set(nextOrder.flat());
  const nextCache = new Map<number, CanonicalSectionBody>();
  for (const [ordinal, section] of cache) {
    if (keep.has(ordinal)) {
      nextCache.set(ordinal, section);
    }
  }
  return { cache: nextCache, pageOrder: nextOrder };
}

function ProgressiveCanonicalMarkdownViewer({
  progressive,
  className,
}: {
  progressive: ProgressiveCanonicalSource;
  className?: string;
}) {
  const [bodies, setBodies] = useState<Map<number, CanonicalSectionBody>>(
    () => {
      const initial = new Map<number, CanonicalSectionBody>();
      for (const section of progressive.initialPage?.sections ?? []) {
        initial.set(section.ordinal, section);
      }
      return initial;
    },
  );
  const pageOrderRef = useRef<number[][]>(
    progressive.initialPage?.sections?.length
      ? [progressive.initialPage.sections.map((s) => s.ordinal)]
      : [],
  );
  const [nextAfterOrdinal, setNextAfterOrdinal] = useState<number | null>(
    () => progressive.initialPage?.nextAfterOrdinal ?? null,
  );
  const [hasInitialized, setHasInitialized] = useState(
    () => Boolean(progressive.initialPage),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusOrdinal, setFocusOrdinal] = useState<number | null>(
    () => progressive.sectionIndex[0]?.ordinal ?? null,
  );

  const inFlightRef = useRef<Set<string>>(new Set());
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const mergePage = useCallback((page: CanonicalSectionPage) => {
    setBodies((prev) => {
      const next = new Map(prev);
      const ordinals: number[] = [];
      for (const section of page.sections) {
        next.set(section.ordinal, section);
        ordinals.push(section.ordinal);
      }
      if (ordinals.length > 0) {
        pageOrderRef.current = [...pageOrderRef.current, ordinals];
        const clamped = clampPageCache(next, pageOrderRef.current);
        pageOrderRef.current = clamped.pageOrder;
        return clamped.cache;
      }
      return next;
    });
    setNextAfterOrdinal(page.nextAfterOrdinal);
    setHasInitialized(true);
  }, []);

  const loadPage = useEffectEvent(async (afterOrdinal: number) => {
    const cursorKey = `${progressive.versionId}:${afterOrdinal}`;
    if (inFlightRef.current.has(cursorKey)) {
      return;
    }
    inFlightRef.current.add(cursorKey);
    setLoading(true);
    setError(null);
    try {
      const page = await fetchCanonicalSectionPage({
        workspaceId: progressive.workspaceId,
        versionId: progressive.versionId,
        afterOrdinal,
        limit: progressive.pageLimit ?? 20,
      });
      mergePage(page);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't load more sections.",
      );
    } finally {
      inFlightRef.current.delete(cursorKey);
      setLoading(false);
    }
  });

  useEffect(() => {
    if (!hasInitialized) {
      void loadPage(0);
    }
  }, [hasInitialized]);

  const canLoadMore = nextAfterOrdinal != null;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || nextAfterOrdinal == null) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadPage(nextAfterOrdinal);
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextAfterOrdinal]);

  useEffect(() => {
    if (progressive.sectionIndex.length === 0) {
      return;
    }

    const onScroll = () => {
      let current = progressive.sectionIndex[0]?.ordinal ?? null;
      for (const section of progressive.sectionIndex) {
        const el = document.getElementById(`section-${section.ordinal}`);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= 96) {
          current = section.ordinal;
        }
      }
      setFocusOrdinal(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [progressive.sectionIndex]);

  const mountMin =
    focusOrdinal == null ? 0 : Math.max(1, focusOrdinal - MOUNT_WINDOW);
  const mountMax =
    focusOrdinal == null
      ? MOUNT_WINDOW * 2
      : focusOrdinal + MOUNT_WINDOW;

  return (
    <div
      className={cn(
        "d2q-prose max-w-[72ch] select-text text-foreground",
        className,
      )}
    >
      {progressive.sectionIndex.map((indexItem) => {
        const body = bodies.get(indexItem.ordinal);
        const shouldMountBody =
          body != null &&
          indexItem.ordinal >= mountMin &&
          indexItem.ordinal <= mountMax;

        return (
          <section
            key={indexItem.id}
            id={`section-${indexItem.ordinal}`}
            className="scroll-mt-20 space-y-3 not-last:mb-8"
            data-ordinal={indexItem.ordinal}
          >
            {indexItem.heading ? (
              <h2 className="font-heading text-2xl font-extrabold tracking-tight">
                {indexItem.heading}
              </h2>
            ) : null}
            {shouldMountBody && body ? (
              <MarkdownBlock content={body.bodyMarkdown} />
            ) : body ? (
              <p className="text-sm text-muted-foreground" aria-hidden>
                …
              </p>
            ) : indexItem.ordinal <= (nextAfterOrdinal ?? 0) ||
              (!hasInitialized && indexItem.ordinal === progressive.sectionIndex[0]?.ordinal) ? (
              <p className="text-sm text-muted-foreground">Loading section…</p>
            ) : null}
          </section>
        );
      })}

      {error ? (
        <div className="mt-4 flex flex-wrap items-center gap-3" role="alert">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void loadPage(nextAfterOrdinal ?? (hasInitialized ? 0 : 0))
            }
          >
            Retry
          </Button>
        </div>
      ) : null}

      {nextAfterOrdinal != null ? (
        <div ref={sentinelRef} className="h-8" aria-hidden />
      ) : null}

      {canLoadMore ? (
        <div className="mt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => {
              if (nextAfterOrdinal != null) {
                void loadPage(nextAfterOrdinal);
              }
            }}
          >
            {loading ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function CanonicalMarkdownViewer({
  markdown,
  sections,
  progressive,
  className,
}: CanonicalMarkdownViewerProps) {
  if (progressive) {
    return (
      <ProgressiveCanonicalMarkdownViewer
        progressive={progressive}
        className={className}
      />
    );
  }

  const hasSections = sections && sections.length > 0;

  return (
    <div
      className={cn(
        "d2q-prose max-w-[72ch] select-text text-foreground",
        className,
      )}
    >
      {hasSections
        ? sections.map((section) => (
            <section
              key={section.id}
              id={`section-${section.ordinal}`}
              className="scroll-mt-20 space-y-3 not-last:mb-8"
            >
              {section.heading ? (
                <h2 className="font-heading text-2xl font-extrabold tracking-tight">
                  {section.heading}
                </h2>
              ) : null}
              {section.bodyMarkdown ? (
                <MarkdownBlock content={section.bodyMarkdown} />
              ) : null}
            </section>
          ))
        : markdown
          ? <MarkdownBlock content={markdown} />
          : null}
    </div>
  );
}
