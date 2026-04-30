/**
 * Validates `mismatchHrefForSurface` (route guards for quiz vs flip study).
 * Run: npx --yes tsx scripts/verify-study-set-redirects.ts
 */
import { mismatchHrefForSurface } from "../src/lib/routing/studySetContentKindRedirects";
import type { StudyContentKind } from "../src/types/studySet";

const id = "verify-id";

function ok(
  surface: Parameters<typeof mismatchHrefForSurface>[1],
  contentKind: StudyContentKind | undefined,
  expected: string | null,
) {
  const got = mismatchHrefForSurface(id, surface, contentKind);
  if (got !== expected) {
    throw new Error(
      `mismatchHrefForSurface(${JSON.stringify(surface)}, ${JSON.stringify(contentKind)}) → ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`,
    );
  }
}

ok("legacy-practice", undefined, `/quiz/${id}`);
ok("legacy-practice", "quiz", `/quiz/${id}`);
ok("legacy-practice", "flashcards", `/flashcards/${id}`);

ok("play-quiz", undefined, null);
ok("play-quiz", "quiz", null);
ok("play-quiz", "flashcards", `/flashcards/${id}`);

ok("play-flashcards", undefined, null);
ok("play-flashcards", "flashcards", null);
ok("play-flashcards", "quiz", `/quiz/${id}`);

ok("edit-quiz", undefined, null);
ok("edit-quiz", "quiz", null);
ok("edit-quiz", "flashcards", `/edit/flashcards/${id}`);

ok("edit-flashcards", undefined, null);
ok("edit-flashcards", "flashcards", null);
ok("edit-flashcards", "quiz", `/edit/quiz/${id}`);

ok("done-quiz", undefined, null);
ok("done-quiz", "quiz", null);
ok("done-quiz", "flashcards", `/flashcards/${id}/done`);

ok("done-flashcards", undefined, null);
ok("done-flashcards", "flashcards", null);
ok("done-flashcards", "quiz", `/quiz/${id}/done`);

console.log("verify-study-set-redirects: ok");
