"use client";

import { useEffect, useRef, useState } from "react";
import { getDocument } from "@/lib/db/studySetDb";
import { renderSinglePdfPageToDataUrl } from "@/lib/pdf/renderPagesToImages";

const COVER_MAX_WIDTH = 560;
const COVER_JPEG_QUALITY = 0.72;

type StudySetCardPdfCoverProps = Readonly<{
  studySetId: string;
  className?: string;
}>;

/**
 * First-page raster preview for dashboard cards (lazy when near viewport).
 */
export function StudySetCardPdfCover({
  studySetId,
  className,
}: StudySetCardPdfCoverProps) {
  const [src, setSrc] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const ac = new AbortController();

    const run = async () => {
      try {
        const doc = await getDocument(studySetId);
        if (ac.signal.aborted) {
          return;
        }
        const buf = doc?.pdfArrayBuffer;
        if (!buf || buf.byteLength === 0) {
          return;
        }
        const file = new File([buf], doc?.pdfFileName ?? "source.pdf", {
          type: "application/pdf",
        });
        const dataUrl = await renderSinglePdfPageToDataUrl(file, 1, {
          signal: ac.signal,
          maxWidth: COVER_MAX_WIDTH,
          jpegQuality: COVER_JPEG_QUALITY,
        });
        if (!ac.signal.aborted && dataUrl) {
          setSrc(dataUrl);
        }
      } catch {
        /* missing PDF / render failure — gradient fallback stays */
      }
    };

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit) {
          return;
        }
        io.disconnect();
        void run();
      },
      { root: null, rootMargin: "120px 0px", threshold: 0.01 },
    );

    io.observe(root);
    return () => {
      ac.abort();
      io.disconnect();
    };
  }, [studySetId]);

  return (
    <div ref={rootRef} className={className}>
      {src ? (
        // data: URL from canvas — not a candidate for next/image
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          aria-hidden
          className="absolute inset-0 z-[1] h-full w-full object-cover object-top"
          loading="lazy"
          decoding="async"
        />
      ) : null}
    </div>
  );
}
