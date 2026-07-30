import type { FlashcardGenerateBody } from "@/lib/pipeline/flashcardSchemas";

export type FlashcardGenerateResult = {
  recommendedCount: number;
  generatedCount: number;
  detectedFormat: string;
  cardIds: string[];
  /** Output-specific bridge study set for review/practice/session/mistake routes. */
  studySetId?: string;
  bridgeStudySetId?: string;
  outputId?: string;
  snapshotCount?: number;
};

export type FlashcardCanonicalSourceOption = {
  canonicalVersionId: string;
  documentId: string;
  documentTitle: string;
  versionNumber: number;
  /** Human-readable provenance (model / mode / parser). */
  provenanceLabel: string;
  createdAt: string;
};

export type WorkspaceFlashcardGenerateBody = FlashcardGenerateBody & {
  canonicalVersionIds: string[];
};

type ApiErrorPayload = {
  error?: string;
  message?: string;
  weeklyUsed?: number;
  weeklyLimit?: number;
  bonusCredits?: number;
  weekResetsAt?: string;
};

export class FlashcardQuotaExceededError extends Error {
  readonly name = "FlashcardQuotaExceededError";
  readonly weeklyUsed: number;
  readonly weeklyLimit: number;
  readonly bonusCredits: number;
  readonly weekResetsAt: string;

  constructor(details: {
    weeklyUsed: number;
    weeklyLimit: number;
    bonusCredits: number;
    weekResetsAt: string;
  }) {
    super("Generation quota exceeded for this week.");
    this.weeklyUsed = details.weeklyUsed;
    this.weeklyLimit = details.weeklyLimit;
    this.bonusCredits = details.bonusCredits;
    this.weekResetsAt = details.weekResetsAt;
  }
}

function mapNetworkError(error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error("Connection lost. Check your network and try again.");
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Something went wrong. Try again.");
}

async function parseApiError(
  res: Response,
  fallback: string,
): Promise<Error> {
  const payload = (await res.json().catch(() => ({}))) as ApiErrorPayload;
  if (
    res.status === 402 &&
    payload.error === "quota_exceeded" &&
    typeof payload.weeklyUsed === "number" &&
    typeof payload.weeklyLimit === "number" &&
    typeof payload.bonusCredits === "number" &&
    typeof payload.weekResetsAt === "string"
  ) {
    return new FlashcardQuotaExceededError({
      weeklyUsed: payload.weeklyUsed,
      weeklyLimit: payload.weeklyLimit,
      bonusCredits: payload.bonusCredits,
      weekResetsAt: payload.weekResetsAt,
    });
  }
  return new Error(payload.message ?? payload.error ?? fallback);
}

const SELECTION_STORAGE_PREFIX = "doc2quiz:flashcard-source-selection:";

/** Restore prior explicit selection for a workspace, if any. */
export function loadFlashcardSourceSelection(
  workspaceId: string,
): string[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(
      `${SELECTION_STORAGE_PREFIX}${workspaceId}`,
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      !Array.isArray(parsed) ||
      !parsed.every((id) => typeof id === "string")
    ) {
      return null;
    }
    return parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function saveFlashcardSourceSelection(
  workspaceId: string,
  canonicalVersionIds: string[],
): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${SELECTION_STORAGE_PREFIX}${workspaceId}`,
    JSON.stringify(canonicalVersionIds),
  );
}

/**
 * Per D-03: preserve prior user selection when still valid; otherwise visibly
 * preselect the latest completed version as an editable default.
 */
export function resolveInitialFlashcardSourceSelection(
  sources: FlashcardCanonicalSourceOption[],
  priorSelection: string[] | null,
): string[] {
  const available = new Set(sources.map((s) => s.canonicalVersionId));
  if (priorSelection && priorSelection.length > 0) {
    const retained = priorSelection.filter((id) => available.has(id));
    if (retained.length > 0) return retained;
  }
  if (sources.length === 0) return [];
  const latest = [...sources].sort((a, b) => {
    const byDate = b.createdAt.localeCompare(a.createdAt);
    if (byDate !== 0) return byDate;
    return b.versionNumber - a.versionNumber;
  })[0];
  return latest ? [latest.canonicalVersionId] : [];
}

/** Group sources by document for selection UI. */
export function groupFlashcardSourcesByDocument(
  sources: FlashcardCanonicalSourceOption[],
): Array<{
  documentId: string;
  documentTitle: string;
  versions: FlashcardCanonicalSourceOption[];
}> {
  const groups = new Map<
    string,
    {
      documentId: string;
      documentTitle: string;
      versions: FlashcardCanonicalSourceOption[];
    }
  >();
  for (const source of sources) {
    const existing = groups.get(source.documentId);
    if (existing) {
      existing.versions.push(source);
    } else {
      groups.set(source.documentId, {
        documentId: source.documentId,
        documentTitle: source.documentTitle,
        versions: [source],
      });
    }
  }
  for (const group of groups.values()) {
    group.versions.sort((a, b) => b.versionNumber - a.versionNumber);
  }
  return [...groups.values()];
}

export async function postWorkspaceFlashcardGenerate(
  workspaceId: string,
  body: WorkspaceFlashcardGenerateBody,
  options?: { signal?: AbortSignal },
): Promise<FlashcardGenerateResult> {
  if (!body.canonicalVersionIds.length) {
    throw new Error("Select at least one completed canonical version.");
  }
  try {
    const res = await fetch(
      `/api/workspaces/${workspaceId}/outputs/flashcards`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          canonicalVersionIds: body.canonicalVersionIds,
          learningGoal: body.learningGoal,
          coverage: body.coverage,
          amount: body.amount,
        }),
        signal: options?.signal,
      },
    );
    if (!res.ok) {
      throw await parseApiError(
        res,
        "Something went wrong while generating flashcards. Try again.",
      );
    }
    return (await res.json()) as FlashcardGenerateResult;
  } catch (error) {
    throw mapNetworkError(error);
  }
}

/**
 * Legacy study-set adapter client. Prefer postWorkspaceFlashcardGenerate for
 * workspace-native flows. Posts IDs only when selection is provided.
 */
export async function postFlashcardGenerate(
  studySetId: string,
  body: FlashcardGenerateBody & { canonicalVersionIds?: string[] },
  options?: { signal?: AbortSignal },
): Promise<FlashcardGenerateResult> {
  try {
    const payload: Record<string, unknown> = {
      learningGoal: body.learningGoal,
      coverage: body.coverage,
      amount: body.amount,
    };
    if (body.canonicalVersionIds !== undefined) {
      payload.canonicalVersionIds = body.canonicalVersionIds;
    }
    const res = await fetch(
      `/api/study-sets/${studySetId}/flashcards/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: options?.signal,
      },
    );
    if (!res.ok) {
      throw await parseApiError(
        res,
        "Something went wrong while generating flashcards. Try again.",
      );
    }
    return (await res.json()) as FlashcardGenerateResult;
  } catch (error) {
    throw mapNetworkError(error);
  }
}
