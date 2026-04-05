"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { ReviewSection } from "@/components/review/ReviewSection";

export default function StudySetReviewPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";

  if (!id) {
    return null;
  }

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold tracking-tight text-[var(--d2q-text)]">
          Review
        </h1>
        <p className="mt-1 text-sm text-[var(--d2q-muted)]">
          Edit AI-parsed questions, then press Done to save the bank and return
          to the library.
        </p>
      </header>

      <ReviewSection studySetId={id} />

      <p className="mt-6 text-sm text-[var(--d2q-muted)]">
        <Link
          href={`/sets/${id}/source`}
          className="font-medium text-[var(--d2q-accent-hover)] underline-offset-2 hover:underline"
        >
          ← Back to Source
        </Link>
      </p>
    </div>
  );
}
