"use client";

import { ChevronRight, List } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { CanonicalSection } from "@/lib/client/canonicalizeStudySet";
import { cn } from "@/lib/utils";

export type CanonicalSectionTocProps = Readonly<{
  sections: CanonicalSection[];
}>;

const SCROLL_OFFSET_PX = 80;

function getScrollBehavior(): ScrollBehavior {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return "auto";
  }
  return "smooth";
}

function scrollToSection(ordinal: number) {
  const el = document.getElementById(`section-${ordinal}`);
  if (!el) {
    return;
  }
  const top =
    el.getBoundingClientRect().top + window.scrollY - SCROLL_OFFSET_PX;
  window.scrollTo({ top, behavior: getScrollBehavior() });
}

export function CanonicalSectionToc({ sections }: CanonicalSectionTocProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeOrdinal, setActiveOrdinal] = useState<number | null>(
    sections[0]?.ordinal ?? null,
  );

  const handleSectionClick = useCallback((ordinal: number) => {
    scrollToSection(ordinal);
    setActiveOrdinal(ordinal);
    setMobileOpen(false);
  }, []);

  useEffect(() => {
    if (sections.length === 0) {
      return;
    }

    const onScroll = () => {
      let current: number | null = sections[0]?.ordinal ?? null;
      for (const section of sections) {
        const el = document.getElementById(`section-${section.ordinal}`);
        if (!el) {
          continue;
        }
        const top = el.getBoundingClientRect().top;
        if (top <= SCROLL_OFFSET_PX + 16) {
          current = section.ordinal;
        }
      }
      setActiveOrdinal(current);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  if (sections.length < 2) {
    return null;
  }

  const tocLinks = sections.map((section) => {
    const isActive = activeOrdinal === section.ordinal;
    const label = section.heading || `Section ${section.ordinal}`;

    return (
      <button
        key={section.id}
        type="button"
        onClick={() => handleSectionClick(section.ordinal)}
        className={cn(
          "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          isActive
            ? "font-label text-chart-2"
            : "text-muted-foreground hover:text-foreground",
        )}
        aria-current={isActive ? "true" : undefined}
      >
        {label}
      </button>
    );
  });

  return (
    <>
      <div className="lg:hidden">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
        >
          <List className="size-4" aria-hidden />
          Sections ({sections.length})
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              mobileOpen && "rotate-90",
            )}
            aria-hidden
          />
        </Button>
        {mobileOpen ? (
          <nav
            aria-label="Document sections"
            className="mt-3 rounded-xl bg-card/60 p-3 ring-1 ring-foreground/10"
          >
            <div className="space-y-1">{tocLinks}</div>
          </nav>
        ) : null}
      </div>

      <nav
        aria-label="Document sections"
        className="hidden lg:block lg:w-60 lg:shrink-0"
      >
        <p className="font-label text-xs font-extrabold uppercase tracking-wide text-muted-foreground">
          Sections
        </p>
        {sections.length > 8 ? (
          <ScrollArea className="mt-3 h-[min(60vh,480px)] pr-3">
            <div className="space-y-1">{tocLinks}</div>
          </ScrollArea>
        ) : (
          <div className="mt-3 space-y-1">{tocLinks}</div>
        )}
      </nav>
    </>
  );
}
