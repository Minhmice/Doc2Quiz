import { describe, expect, it } from "vitest";
import {
  createFlashcard,
  createQuiz,
  createStudySet,
  flashcardDrillMistakes,
  flashcardEdit,
  flashcardOverview,
  flashcardPlay,
  flashcardResults,
  flashcardReview,
  quizDrillMistakes,
  quizEdit,
  quizOverview,
  quizPlay,
  quizResults,
  quizReview,
} from "./studySetPaths";

describe("canonical study-set paths", () => {
  const setId = "set-123";

  it("uses the canonical creation routes", () => {
    expect(createStudySet()).toBe("/create");
    expect(createQuiz()).toBe("/quiz/create");
    expect(createFlashcard()).toBe("/flashcard/create");
  });

  it.each([
    [quizOverview, "/quiz/set-123"],
    [quizReview, "/quiz/set-123/review"],
    [quizEdit, "/quiz/set-123/edit"],
    [quizPlay, "/quiz/set-123/play"],
    [quizResults, "/quiz/set-123/results"],
    [quizDrillMistakes, "/quiz/set-123/drill-mistake"],
    [flashcardOverview, "/flashcard/set-123"],
    [flashcardReview, "/flashcard/set-123/review"],
    [flashcardEdit, "/flashcard/set-123/edit"],
    [flashcardPlay, "/flashcard/set-123/play"],
    [flashcardResults, "/flashcard/set-123/results"],
    [flashcardDrillMistakes, "/flashcard/set-123/drill-mistake"],
  ])("preserves setId in %s", (builder, expected) => {
    expect(builder(setId)).toBe(expected);
  });

  it("never emits legacy route vocabulary", () => {
    const paths = [
      createStudySet(),
      createQuiz(),
      createFlashcard(),
      quizOverview(setId),
      quizReview(setId),
      quizEdit(setId),
      quizPlay(setId),
      quizResults(setId),
      quizDrillMistakes(setId),
      flashcardOverview(setId),
      flashcardReview(setId),
      flashcardEdit(setId),
      flashcardPlay(setId),
      flashcardResults(setId),
      flashcardDrillMistakes(setId),
    ];

    for (const path of paths) {
      expect(path).not.toMatch(/^\/edit(?:\/|$)/);
      expect(path).not.toMatch(/^\/sets(?:\/|$)/);
      expect(path).not.toMatch(/^\/flashcards(?:\/|$)/);
      expect(path).not.toMatch(/\/done(?:\/|$)/);
      expect(path).not.toContain(`review${String.fromCharCode(61)}mistakes`);
    }
  });
});
