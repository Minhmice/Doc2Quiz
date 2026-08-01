import { describe, expect, it } from "vitest";
import type { WorkspaceSummary } from "@/lib/workspaces/workspaceSummary";
import {
  buildWorkspaceCardModel,
  deriveWorkspaceStatus,
  filterAndSortWorkspaceCards,
  selectResumeRecommendation,
  workspaceDashboardLinks,
} from "./workspaceDashboardModel";

const workspace = (overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary => ({
  id: "ws-1",
  title: "Biology",
  subtitle: "Cell structure",
  role: "owner",
  createdAt: "2026-07-01T00:00:00Z",
  updatedAt: "2026-07-30T00:00:00Z",
  documentCount: 0,
  canonicalVersionCount: 0,
  quizOutputCount: 0,
  flashcardOutputCount: 0,
  recentOutputs: [],
  ...overrides,
});

const output = (status: string, updatedAt = "2026-07-30T00:00:00Z") => ({
  id: `${status}-${updatedAt}`,
  kind: "quiz" as const,
  title: "Quiz",
  status,
  updatedAt,
  createdAt: updatedAt,
  bridgeStudySetId: "set-1",
});

describe("workspace dashboard model", () => {
  it("derives all statuses with processing_failed > needs_review > processing > ready > empty precedence", () => {
    expect(deriveWorkspaceStatus(workspace())).toBe("empty");
    expect(deriveWorkspaceStatus(workspace({ documentCount: 1 }))).toBe("needs_review");
    expect(deriveWorkspaceStatus(workspace({ canonicalVersionCount: 1, recentOutputs: [output("failed")] }))).toBe("processing_failed");
    expect(deriveWorkspaceStatus(workspace({ recentOutputs: [output("ready")] }))).toBe("ready");
    expect(deriveWorkspaceStatus(workspace({ recentOutputs: [output("ready"), output("pending")] }))).toBe("processing");
    expect(deriveWorkspaceStatus(workspace({ recentOutputs: [output("mystery")] }))).toBe("needs_review");
  });

  it("builds workspace card data with role, counts, and latest output link", () => {
    expect(buildWorkspaceCardModel(workspace({ documentCount: 2, canonicalVersionCount: 2, quizOutputCount: 3, flashcardOutputCount: 4 }))).toEqual({
      id: "ws-1",
      title: "Biology",
      subtitle: "Cell structure",
      role: "owner",
      sourceCount: 2,
      readySourceCount: 2,
      quizCount: 3,
      flashcardCount: 4,
      updatedAt: "2026-07-30T00:00:00Z",
      status: "needs_review",
      latestOutputTitle: null,
      latestOutputHref: null,
      href: "/workspace/ws-1",
    });
    expect(workspaceDashboardLinks.resume({ kind: "quiz", bridgeStudySetId: "set-1" })).toBe("/quiz/set-1");
    expect(workspaceDashboardLinks.resume({ kind: "flashcards", bridgeStudySetId: "set-1" })).toBe("/flashcard/set-1");
  });

  it("searches title and subtitle then filters and sorts deterministically", () => {
    const cards = [
      buildWorkspaceCardModel(workspace({ id: "b", title: "Zoology", subtitle: "Cells", updatedAt: "2026-07-29T00:00:00Z", documentCount: 1 })),
      buildWorkspaceCardModel(workspace({ id: "a", title: "Anatomy", subtitle: "Bones", updatedAt: "2026-07-30T00:00:00Z", recentOutputs: [output("ready")] })),
    ];
    expect(filterAndSortWorkspaceCards(cards, { search: "cell", filter: "all", sort: "recent" }).map(({ id }) => id)).toEqual(["b"]);
    expect(filterAndSortWorkspaceCards(cards, { search: "", filter: "ready", sort: "title" }).map(({ id }) => id)).toEqual(["a"]);
    expect(filterAndSortWorkspaceCards(cards, { search: "", filter: "all", sort: "title" }).map(({ id }) => id)).toEqual(["a", "b"]);
  });

  it("selects newest playable output and returns null without one", () => {
    expect(selectResumeRecommendation([workspace()])).toBeNull();
    expect(selectResumeRecommendation([
      workspace({ id: "old", title: "Old", recentOutputs: [output("ready", "2026-07-20T00:00:00Z")] }),
      workspace({ id: "new", title: "New", recentOutputs: [{ ...output("ready", "2026-07-31T00:00:00Z"), kind: "flashcards", bridgeStudySetId: "set-2" }] }),
    ])).toEqual({ workspaceId: "new", workspaceTitle: "New", kind: "flashcards", updatedAt: "2026-07-31T00:00:00Z", href: "/flashcard/set-2" });
  });
});
