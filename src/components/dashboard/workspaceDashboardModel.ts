import { flashcardOverview, quizOverview } from "@/lib/routes/studySetPaths";
import type {
  RecentOutputSummary,
  WorkspaceSummary,
} from "@/lib/workspaces/workspaceSummary";

export type WorkspaceStatus = "processing" | "ready" | "needs_review" | "empty";
export type WorkspaceFilter = "all" | WorkspaceStatus;
export type WorkspaceSort = "recent" | "title";

export type WorkspaceCardModel = Readonly<{
  id: string;
  title: string;
  subtitle: string | null;
  sourceCount: number;
  quizCount: number;
  flashcardCount: number;
  updatedAt: string;
  status: WorkspaceStatus;
  href: string;
}>;

export type WorkspaceResumeRecommendation = Readonly<{
  workspaceId: string;
  workspaceTitle: string;
  kind: RecentOutputSummary["kind"];
  updatedAt: string;
  href: string;
}>;

const PROCESSING_OUTPUT_STATUSES = new Set(["pending", "processing", "generating"]);
const READY_OUTPUT_STATUSES = new Set(["ready"]);

export const workspaceDashboardLinks = {
  open: (workspaceId: string) => `/workspace/${workspaceId}`,
  resume: (output: Pick<RecentOutputSummary, "kind" | "bridgeStudySetId">) =>
    output.kind === "flashcards"
      ? flashcardOverview(output.bridgeStudySetId)
      : quizOverview(output.bridgeStudySetId),
};

export function deriveWorkspaceStatus(workspace: WorkspaceSummary): WorkspaceStatus {
  if (workspace.recentOutputs.some((output) => PROCESSING_OUTPUT_STATUSES.has(output.status))) {
    return "processing";
  }
  if (workspace.recentOutputs.some((output) => READY_OUTPUT_STATUSES.has(output.status))) {
    return "ready";
  }
  if (workspace.canonicalVersionCount > 0 || workspace.documentCount > 0 || workspace.recentOutputs.length > 0) {
    return "needs_review";
  }
  return "empty";
}

export function buildWorkspaceCardModel(workspace: WorkspaceSummary): WorkspaceCardModel {
  return {
    id: workspace.id,
    title: workspace.title,
    subtitle: workspace.subtitle,
    sourceCount: workspace.documentCount,
    quizCount: workspace.quizOutputCount,
    flashcardCount: workspace.flashcardOutputCount,
    updatedAt: workspace.updatedAt,
    status: deriveWorkspaceStatus(workspace),
    href: workspaceDashboardLinks.open(workspace.id),
  };
}

export function filterAndSortWorkspaceCards(
  cards: readonly WorkspaceCardModel[],
  options: Readonly<{ search: string; filter: WorkspaceFilter; sort: WorkspaceSort }>,
): WorkspaceCardModel[] {
  const query = options.search.trim().toLocaleLowerCase();
  return cards
    .filter((card) => {
      const matchesSearch =
        !query ||
        card.title.toLocaleLowerCase().includes(query) ||
        (card.subtitle ?? "").toLocaleLowerCase().includes(query);
      return matchesSearch && (options.filter === "all" || card.status === options.filter);
    })
    .sort((left, right) =>
      options.sort === "title"
        ? left.title.localeCompare(right.title, undefined, { sensitivity: "base" }) || left.id.localeCompare(right.id)
        : Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.id.localeCompare(right.id),
    );
}

export function selectResumeRecommendation(
  workspaces: readonly WorkspaceSummary[],
): WorkspaceResumeRecommendation | null {
  const candidates = workspaces.flatMap((workspace) =>
    workspace.recentOutputs
      .filter((output) => READY_OUTPUT_STATUSES.has(output.status) && output.bridgeStudySetId)
      .map((output) => ({
        workspaceId: workspace.id,
        workspaceTitle: workspace.title,
        kind: output.kind,
        updatedAt: output.updatedAt,
        href: workspaceDashboardLinks.resume(output),
      })),
  );
  return candidates.sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.workspaceId.localeCompare(right.workspaceId),
  )[0] ?? null;
}

export function selectReviewRecommendation(
  workspaces: readonly WorkspaceSummary[],
): WorkspaceCardModel | null {
  return workspaces
    .map(buildWorkspaceCardModel)
    .filter((workspace) => workspace.status === "needs_review")
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt) || left.id.localeCompare(right.id))[0] ?? null;
}
