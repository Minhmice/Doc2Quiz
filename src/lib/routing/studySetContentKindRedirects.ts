import {
  flashcardEdit,
  flashcardPlay,
  flashcardResults,
  quizEdit,
  quizPlay,
  quizResults,
} from "@/lib/routes/studySetPaths";
import type { StudyContentKind } from "@/types/studySet";

/** Current product URL the user is on (for guard redirects only). */
export type StudySetProductSurface =
  | "play-quiz"
  | "play-flashcards"
  | "edit-quiz"
  | "edit-flashcards"
  | "done-quiz"
  | "done-flashcards"
  | "legacy-practice";

/**
 * If the study set's `contentKind` does not match this surface, returns the
 * canonical URL for that set. Returns `null` when no redirect is needed
 * (including when `contentKind` is undefined — legacy rows keep current route).
 */
export function mismatchHrefForSurface(
  studySetId: string,
  surface: StudySetProductSurface,
  contentKind: StudyContentKind | undefined,
): string | null {
  if (surface === "legacy-practice") {
    if (contentKind === "flashcards") {
      return flashcardPlay(studySetId);
    }
    return quizPlay(studySetId);
  }

  if (contentKind == null) {
    return null;
  }

  switch (surface) {
    case "play-quiz":
      return contentKind === "flashcards" ? flashcardPlay(studySetId) : null;
    case "play-flashcards":
      return contentKind === "quiz" ? quizPlay(studySetId) : null;
    case "edit-quiz":
      return contentKind === "flashcards" ? flashcardEdit(studySetId) : null;
    case "edit-flashcards":
      return contentKind === "quiz" ? quizEdit(studySetId) : null;
    case "done-quiz":
      return contentKind === "flashcards" ? flashcardResults(studySetId) : null;
    case "done-flashcards":
      return contentKind === "quiz" ? quizResults(studySetId) : null;
    default: {
      const _exhaustive: never = surface;
      return _exhaustive;
    }
  }
}
