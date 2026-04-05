"use client";

import { useEffect, useState } from "react";
import { getMediaBlob } from "@/lib/db/studySetDb";

const MAX_PREVIEW_W = 320;

export function StoredImage({
  mediaId,
  alt,
  className = "",
}: {
  mediaId: string;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let cancelled = false;
    (async () => {
      const blob = await getMediaBlob(mediaId);
      if (cancelled || !blob) {
        return;
      }
      const u = URL.createObjectURL(blob);
      revoked = u;
      setUrl(u);
    })();
    return () => {
      cancelled = true;
      if (revoked) {
        URL.revokeObjectURL(revoked);
      }
    };
  }, [mediaId]);

  if (!url) {
    return (
      <span className="text-xs text-[var(--d2q-muted)]" aria-hidden>
        Loading image…
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={`max-h-48 w-auto max-w-full rounded-md border border-[var(--d2q-border)] object-contain ${className}`}
      style={{ maxWidth: MAX_PREVIEW_W }}
    />
  );
}
