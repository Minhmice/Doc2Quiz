"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ensureStudySetDb, getStudySetMeta } from "@/lib/db/studySetDb";
import { editFlashcards, editQuiz } from "@/lib/routes/studySetPaths";

/** Legacy `/sets/[id]/parse` — parse runs on `/new/*`; land on edit. */
export default function LegacyParseRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params.id === "string" ? params.id : "";

  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await ensureStudySetDb();
        const m = await getStudySetMeta(id);
        if (cancelled) {
          return;
        }
        if (!m) {
          router.replace("/dashboard");
          return;
        }
        router.replace(
          m.contentKind === "flashcards" ? editFlashcards(id) : editQuiz(id),
        );
      } catch {
        if (!cancelled) {
          router.replace("/dashboard");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, router]);

  return (
    <p className="text-sm text-muted-foreground" role="status">
      Redirecting…
    </p>
  );
}
