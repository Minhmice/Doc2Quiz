export type StudyMode = "practice" | "score";
export type RevealPolicy = "immediate" | "after_both_complete" | "after_deadline";
export type ChallengeStatus = "pending" | "active" | "completed" | "expired" | "cancelled";
export type ChallengeSummary = Readonly<{ sessionId: string; status: ChallengeStatus; recipientId: string }>;
export type ChallengeAttemptLink = Readonly<{ attemptId: string; playHref: string }>;
export type PracticeQuestion = Readonly<{ id: string; prompt: string; choices: readonly [string, string, string, string] }>;
export type ChallengePractice = Readonly<{ sessionId: string; attemptId: string; title: string; mode: StudyMode; questions: readonly PracticeQuestion[]; selectedIndices: readonly (number | null)[] }>;
export type ChallengeResult = Readonly<{ attemptId: string; status: "completed"; score: number; questionCount: number; accuracy: number; durationSeconds: number; resultsVisible: boolean }>;
export type ChallengeNotification = Readonly<{ id: string; type: string; actorId: string | null; entityId: string; payload: Readonly<Record<string, unknown>>; createdAt: string; readAt: string | null; archivedAt: string | null }>;
export type EligibleChallengeQuiz = Readonly<{ outputId: string; title: string; questionCount: number; status: "ready" }>;

const unavailable = "Challenge is unavailable.";

function isEligibleChallengeQuiz(value: unknown): value is EligibleChallengeQuiz {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.outputId === "string" && typeof row.title === "string" && row.status === "ready" && typeof row.questionCount === "number" && Number.isInteger(row.questionCount) && row.questionCount > 0;
}

export async function listEligibleChallengeQuizzes(): Promise<EligibleChallengeQuiz[]> {
  const rows = await request<unknown>("/api/friends/study-challenges/sources");
  return Array.isArray(rows) ? rows.filter(isEligibleChallengeQuiz) : [];
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) throw new Error(unavailable);
    return ((await response.json()) as { data: T }).data;
  } catch (error) {
    if (error instanceof Error && error.message === unavailable) throw error;
    if (error instanceof TypeError) throw new Error("Connection lost. Check your network and try again.");
    throw new Error(unavailable);
  }
}

const json = (body: unknown): RequestInit => ({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export function createStudyChallenge(input: Readonly<{ recipientId: string; outputId: string; mode: StudyMode; deadlineAt: string | null; message: string | null; revealPolicy: RevealPolicy }>) {
  return request<ChallengeSummary>("/api/friends/study-challenges", json(input));
}
export type InviteSummary = Readonly<{ sessionId: string; creatorId: string; username: string | null; title: string; createdAt: string }>;
export type InvitePage = Readonly<{ items: readonly InviteSummary[]; nextCursor: string | null; hasMore: boolean; totalCount?: number }>;
export function listStudyChallenges(cursor?: string) { const params=new URLSearchParams({role:"recipient",status:"pending",limit:"20",...(cursor?{cursor}:{})}); return request<InvitePage>(`/api/friends/study-challenges?${params}`); }
export function getStudyChallenge(sessionId: string) { return request<Record<string, unknown>>(`/api/friends/study-challenges/${sessionId}`); }
export function acceptStudyChallenge(sessionId: string) { return request<ChallengeAttemptLink>(`/api/friends/study-challenges/${sessionId}/accept`, { method: "POST" }); }
export function declineStudyChallenge(sessionId: string) { return request<{ ok: true }>(`/api/friends/study-challenges/${sessionId}`, { method: "DELETE" }); }
export function startOrResumeCreatorAttempt(sessionId: string) { return request<ChallengeAttemptLink>(`/api/friends/study-challenges/${sessionId}/start`, { method: "POST" }); }
export function loadStudyChallengeAttempt(sessionId: string, attemptId: string) { return request<ChallengePractice>(`/api/friends/study-challenges/${sessionId}/attempt?attemptId=${attemptId}`); }
export function saveStudyChallengeProgress(sessionId: string, attemptId: string, selectedIndices: readonly (number | null)[], currentQuestionIndex: number) { return request<{ ok: true }>(`/api/friends/study-challenges/${sessionId}/attempt?attemptId=${attemptId}`, { ...json({ selectedIndices, currentQuestionIndex }), method: "PATCH" }); }
export function completeStudyChallengeAttempt(sessionId: string, attemptId: string, selectedIndices: readonly (number | null)[], durationSeconds: number) { return request<ChallengeResult>(`/api/friends/study-challenges/${sessionId}/attempt?attemptId=${attemptId}`, json({ selectedIndices, durationSeconds })); }
export function listChallengeNotifications() { return request<{ notifications: ChallengeNotification[] }>("/api/friends/notifications?limit=20"); }
export function markChallengeNotificationRead(notificationId: string) { return request<{ ok: true }>("/api/friends/notifications", { ...json({ notificationId }), method: "PATCH" }); }
export function markAllChallengeNotificationsRead() { return request<{ ok: true }>("/api/friends/notifications", json({ action: "mark_all_read" })); }
export function archiveChallengeInvite(sessionId: string) { return request<{ ok: true }>("/api/friends/notifications", json({ action: "archive_invite", sessionId })); }
