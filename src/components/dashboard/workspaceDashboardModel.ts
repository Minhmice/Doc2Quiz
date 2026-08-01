import { flashcardOverview, quizOverview } from "@/lib/routes/studySetPaths";
import type {
  RecentOutputSummary,
  WorkspaceRole,
  WorkspaceSummary,
} from "@/lib/workspaces/workspaceSummary";

export type WorkspaceStatus =
  | "processing_failed"
  | "needs_review"
  | "processing"
  | "ready"
  | "empty";

export type WorkspaceFilter = "all" | WorkspaceStatus | "needs_attention";
export type WorkspaceSort = "recent" | "title";
export type WorkspaceKindFilter = "all" | "quiz" | "flashcards";

export type WorkspaceCardModel = Readonly<{
  id: string;
  title: string;
  subtitle: string | null;
  role: WorkspaceRole;
  sourceCount: number;
  readySourceCount: number;
  quizCount: number;
  flashcardCount: number;
  updatedAt: string;
  status: WorkspaceStatus;
  latestOutputTitle?: string | null;
  latestOutputHref?: string | null;
  href: string;
}>;

export type DashboardOutputCardModel = Readonly<{
  id: string;
  kind: "quiz" | "flashcards";
  title: string;
  status: string;
  updatedAt: string;
  workspaceId: string;
  workspaceTitle: string;
  href: string;
}>;

const PROCESSING_OUTPUT_STATUSES = new Set(["pending", "processing", "generating"]);

export const workspaceDashboardLinks = {
  open: (workspaceId: string) => `/workspace/${workspaceId}`,
  resume: (output: Pick<RecentOutputSummary, "kind" | "bridgeStudySetId">) =>
    output.kind === "flashcards"
      ? flashcardOverview(output.bridgeStudySetId)
      : quizOverview(output.bridgeStudySetId),
};

export function deriveWorkspaceStatus(workspace: WorkspaceSummary): WorkspaceStatus {
  // 1. processing_failed: if any output has failed status
  if (workspace.recentOutputs.some((o) => o.status === "failed")) {
    return "processing_failed";
  }

  // 2. needs_review: if documents/versions exist but 0 outputs created yet
  const hasNoOutputsYet =
    (workspace.documentCount > 0 || workspace.canonicalVersionCount > 0) &&
    workspace.recentOutputs.length === 0;
  if (hasNoOutputsYet) {
    return "needs_review";
  }

  // 3. processing: if any output is pending/processing/generating
  if (workspace.recentOutputs.some((o) => PROCESSING_OUTPUT_STATUSES.has(o.status))) {
    return "processing";
  }

  // 4. ready: has at least one ready output
  if (workspace.recentOutputs.some((o) => o.status === "ready")) {
    return "ready";
  }

  // 5. empty: 0 documents and 0 outputs
  if (workspace.documentCount === 0 && workspace.recentOutputs.length === 0) {
    return "empty";
  }

  return "needs_review";
}

export function buildWorkspaceCardModel(workspace: WorkspaceSummary): WorkspaceCardModel {
  const latestOutput = workspace.recentOutputs[0];
  const latestOutputHref = latestOutput?.bridgeStudySetId
    ? workspaceDashboardLinks.resume(latestOutput)
    : null;

  return {
    id: workspace.id,
    title: workspace.title,
    subtitle: workspace.subtitle,
    role: workspace.role,
    sourceCount: workspace.documentCount,
    readySourceCount: workspace.canonicalVersionCount,
    quizCount: workspace.quizOutputCount,
    flashcardCount: workspace.flashcardOutputCount,
    updatedAt: workspace.updatedAt,
    status: deriveWorkspaceStatus(workspace),
    latestOutputTitle: latestOutput?.title ?? null,
    latestOutputHref,
    href: workspaceDashboardLinks.open(workspace.id),
  };
}

export function getContextualAction(card: WorkspaceCardModel): { label: string; href: string } {
  switch (card.status) {
    case "processing_failed":
    case "needs_review":
      return { label: "Review source", href: card.href };
    case "processing":
      return { label: "View progress", href: card.href };
    case "ready":
      return card.latestOutputHref
        ? { label: "Continue studying", href: card.latestOutputHref }
        : { label: "Create quiz", href: card.href };
    case "empty":
    default:
      return { label: "Add source", href: card.href };
  }
}

export function extractRecentDashboardOutputs(
  workspaces: readonly WorkspaceSummary[],
  limit = 3,
): DashboardOutputCardModel[] {
  const outputs: DashboardOutputCardModel[] = [];
  for (const ws of workspaces) {
    for (const out of ws.recentOutputs) {
      if (out.status === "ready" && out.bridgeStudySetId) {
        outputs.push({
          id: out.id,
          kind: out.kind,
          title: out.title,
          status: out.status,
          updatedAt: out.updatedAt,
          workspaceId: ws.id,
          workspaceTitle: ws.title,
          href: workspaceDashboardLinks.resume(out),
        });
      }
    }
  }
  outputs.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  return outputs.slice(0, limit);
}

export function filterAndSortWorkspaceCards(
  cards: readonly WorkspaceCardModel[],
  options: Readonly<{
    search: string;
    filter: WorkspaceFilter;
    sort: WorkspaceSort;
    kind?: WorkspaceKindFilter;
  }>,
): WorkspaceCardModel[] {
  const query = options.search.trim().toLocaleLowerCase();
  return cards
    .filter((card) => {
      const matchesSearch =
        !query ||
        card.title.toLocaleLowerCase().includes(query) ||
        (card.subtitle ?? "").toLocaleLowerCase().includes(query) ||
        (card.latestOutputTitle ?? "").toLocaleLowerCase().includes(query);

      let matchesFilter = true;
      if (options.filter === "needs_attention") {
        matchesFilter =
          card.status === "needs_review" ||
          card.status === "processing_failed" ||
          card.status === "processing";
      } else if (options.filter !== "all") {
        matchesFilter = card.status === options.filter;
      }

      let matchesKind = true;
      if (options.kind === "quiz") {
        matchesKind = card.quizCount > 0;
      } else if (options.kind === "flashcards") {
        matchesKind = card.flashcardCount > 0;
      }

      return matchesSearch && matchesFilter && matchesKind;
    })
    .sort((left, right) =>
      options.sort === "title"
        ? left.title.localeCompare(right.title, undefined, { sensitivity: "base" }) || left.id.localeCompare(right.id)
        : Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.id.localeCompare(right.id),
    );
}

export function selectResumeRecommendation(
  workspaces: readonly WorkspaceSummary[],
) {
  const recent = extractRecentDashboardOutputs(workspaces, 1)[0];
  if (!recent) return null;
  return {
    workspaceId: recent.workspaceId,
    workspaceTitle: recent.workspaceTitle,
    kind: recent.kind,
    updatedAt: recent.updatedAt,
    href: recent.href,
  };
}

export function selectReviewRecommendation(
  workspaces: readonly WorkspaceSummary[],
): WorkspaceCardModel | null {
  return (
    workspaces
      .map(buildWorkspaceCardModel)
      .filter((w) => w.status === "needs_review" || w.status === "processing_failed")
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0] ?? null
  );
}
