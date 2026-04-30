"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";
import {
  mismatchHrefForSurface,
  type StudySetProductSurface,
} from "@/lib/routing/studySetContentKindRedirects";

/**
 * Loads study set meta once and `router.replace`s when the set's content kind
 * does not match the current product surface (play/edit/done/legacy practice).
 *
 * @returns `true` when safe to render the surface; `false` while loading or after dispatching redirect.
 */
export function useStudySetProductSurfaceRedirect(
  studySetId: string | undefined,
  surface: StudySetProductSurface,
): boolean {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!studySetId) {
      setReady(true);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        await ensureStudySetDb();
        const meta = await getStudySetMeta(studySetId);
        if (cancelled) {
          return;
        }
        const href = mismatchHrefForSurface(
          studySetId,
          surface,
          meta?.contentKind,
        );
        if (href) {
          router.replace(href);
          return;
        }
      } catch {
        if (!cancelled) {
          setReady(true);
        }
        return;
      }
      if (!cancelled) {
        setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [studySetId, surface, router]);

  return ready;
}
