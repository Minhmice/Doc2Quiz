import { describe, expect, it } from "vitest";
import type { StudySetMeta } from "@/types/studySet";
import {
  drillMistakesHref,
  editHref,
  openOverviewHref,
  playHref,
  resultsHref,
  reviewHref,
} from "./studySetDashboardLinks";

function meta(contentKind: "quiz" | "flashcards"): StudySetMeta {
  return {
    id: `${contentKind}-set`,
    title: "Contract fixture",
    createdAt: "2026-07-26T00:00:00.000Z",
    updatedAt: "2026-07-26T00:00:00.000Z",
    pipelineStage: contentKind,
    contentKind,
  };
}

describe.each([
  {
    kind: "quiz" as const,
    root: "/quiz/quiz-set",
  },
  {
    kind: "flashcards" as const,
    root: "/flashcard/flashcards-set",
  },
])("dashboard links for $kind", ({ kind, root }) => {
  const studySet = meta(kind);

  it("opens cards on the set overview", () => {
    expect(openOverviewHref(studySet)).toBe(root);
  });

  it("maps every action to its typed canonical destination", () => {
    expect(reviewHref(studySet)).toBe(`${root}/review`);
    expect(editHref(studySet)).toBe(`${root}/edit`);
    expect(playHref(studySet)).toBe(`${root}/play`);
    expect(resultsHref(studySet)).toBe(`${root}/results`);
    expect(drillMistakesHref(studySet)).toBe(`${root}/drill-mistake`);
  });
});
