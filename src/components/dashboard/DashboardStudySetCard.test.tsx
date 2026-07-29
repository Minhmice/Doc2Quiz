import { describe, expect, it } from "vitest";
import { buildDashboardStudySetCardModel } from "@/components/dashboard/dashboardStudySetCardModel";

describe("dashboard card contract", () => {
  const meta = { id: "set-1", title: "Biology", createdAt: "2026-01-01", updatedAt: "2026-01-02", pipelineStage: "quiz" as const, contentKind: "quiz" as const };
  it("limits previews and exposes canonical overview/actions", () => {
    const model = buildDashboardStudySetCardModel({ meta, status: "ready", hasMistakes: false, items: [1, 2, 3, 4].map((n) => ({ id: String(n), text: `Question ${n}`, kind: "multiple-choice" })) });
    expect(model.overviewHref).toBe("/quiz/set-1");
    expect(model.previews).toHaveLength(3);
    expect(model.previews.map((item) => item.text)).not.toContain("answer");
    expect(model.actions.review).toBe("/quiz/set-1/review");
  });

  it("prioritizes flagged content and drills mistakes", () => {
    const model = buildDashboardStudySetCardModel({ meta, status: "needs_review", hasMistakes: true, items: [{ id: "a", text: "ordinary", kind: "short" }, { id: "b", text: "flagged", kind: "short", flagged: true }] });
    expect(model.primaryLabel).toBe("Drill mistakes");
    expect(model.previews[0]?.text).toBe("flagged");
  });
});
