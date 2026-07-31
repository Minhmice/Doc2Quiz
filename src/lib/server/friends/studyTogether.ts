export const PRESENCE_STATUSES = ["online", "recently_active", "offline"] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];
export type StudyMode = "practice" | "score";
export type RevealPolicy = "immediate" | "after_both_complete" | "after_deadline";
export type SessionStatus = "pending" | "active" | "completed" | "expired" | "cancelled";
export type AttemptStatus = "in_progress" | "completed";
export type StudyRpcErrorCode = "social_unavailable";

type RpcError = { message: string; details?: string | null };
type StudyRpcSupabase = {
  rpc: (functionName: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: RpcError | null }>;
};

type Json = Record<string, unknown>;

export class SocialUnavailableError extends Error {
  constructor() {
    super("social_unavailable");
    this.name = "SocialUnavailableError";
  }
}

export type ChallengeSummary = { sessionId: string; status: SessionStatus; recipientId: string };
export type StudyAttempt = { sessionId: string; attemptId: string; status: AttemptStatus; resumed: boolean };
export type PracticeQuestion = { id: string; prompt: string; choices: [string, string, string, string] };
export type PracticeDto = { sessionId: string; attemptId: string; title: string; mode: StudyMode; questions: PracticeQuestion[]; selectedIndices: (number | null)[] };
export type AttemptResultDto = { attemptId: string; status: "completed"; score: number; questionCount: number; accuracy: number; durationSeconds: number; resultsVisible: boolean };
export type NotificationType = "study_challenge_received" | "study_challenge_accepted" | "study_challenge_declined" | "study_challenge_completed" | "study_challenge_result_ready" | "study_challenge_expiring";
export type NotificationDto = { id: string; type: NotificationType; recipientId: string; actorId: string | null; entityId: string; payload: Json; createdAt: string; readAt: string | null; archivedAt: string | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SESSION_STATUSES = new Set<SessionStatus>(["pending", "active", "completed", "expired", "cancelled"]);
const NOTIFICATION_TYPES = new Set<NotificationType>(["study_challenge_received", "study_challenge_accepted", "study_challenge_declined", "study_challenge_completed", "study_challenge_result_ready", "study_challenge_expiring"]);

function object(value: unknown): Json {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new SocialUnavailableError();
  return value as Json;
}
function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) throw new SocialUnavailableError();
  return value;
}
function text(value: unknown): string {
  if (typeof value !== "string") throw new SocialUnavailableError();
  return value;
}
function number(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new SocialUnavailableError();
  return value;
}
function nullableText(value: unknown): string | null {
  if (value === null) return null;
  return text(value);
}

export function mapStudyTogetherRpcError(error: RpcError): never {
  const tokens = ["social_unavailable", "challenge_unavailable", "attempt_unavailable", "source_unavailable", "authentication_required"];
  if (tokens.some((token) => error.message.includes(token))) throw new SocialUnavailableError();
  throw new SocialUnavailableError();
}

async function call(supabase: StudyRpcSupabase, name: string, args: Record<string, unknown>): Promise<Json> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) mapStudyTogetherRpcError(error);
  return object(data);
}

export function decodeChallenge(value: unknown): ChallengeSummary {
  const row = object(value);
  const status = text(row.status) as SessionStatus;
  if (!SESSION_STATUSES.has(status)) throw new SocialUnavailableError();
  return { sessionId: uuid(row.sessionId), status, recipientId: uuid(row.recipientId) };
}

function decodeAttempt(value: unknown): StudyAttempt {
  const row = object(value);
  const status = text(row.status) as AttemptStatus;
  if (status !== "in_progress" && status !== "completed") throw new SocialUnavailableError();
  if (typeof row.resumed !== "boolean") throw new SocialUnavailableError();
  return { sessionId: uuid(row.sessionId), attemptId: uuid(row.attemptId), status, resumed: row.resumed };
}

export function decodePractice(value: unknown): PracticeDto {
  const row = object(value);
  if (!Array.isArray(row.questions) || !Array.isArray(row.selectedIndices)) throw new SocialUnavailableError();
  const questions = row.questions.map((item) => {
    const q = object(item);
    if (!Array.isArray(q.choices) || q.choices.length !== 4 || !q.choices.every((choice) => typeof choice === "string")) throw new SocialUnavailableError();
    return { id: text(q.id), prompt: text(q.prompt), choices: q.choices as [string, string, string, string] };
  });
  const mode = text(row.mode);
  if (mode !== "practice" && mode !== "score") throw new SocialUnavailableError();
  if (!row.selectedIndices.every((answer) => answer === null || (Number.isInteger(answer) && (answer as number) >= 0 && (answer as number) <= 3))) throw new SocialUnavailableError();
  return { sessionId: uuid(row.sessionId), attemptId: uuid(row.attemptId), title: text(row.title), mode, questions, selectedIndices: row.selectedIndices as (number | null)[] };
}

export function decodeNotification(value: unknown): NotificationDto {
  const row = object(value);
  const type = text(row.type) as NotificationType;
  if (!NOTIFICATION_TYPES.has(type)) throw new SocialUnavailableError();
  return { id: uuid(row.id), type, recipientId: uuid(row.recipientId), actorId: row.actorId === null ? null : uuid(row.actorId), entityId: uuid(row.entityId), payload: object(row.payload), createdAt: text(row.createdAt), readAt: nullableText(row.readAt), archivedAt: nullableText(row.archivedAt) };
}

function decodeResult(value: unknown): AttemptResultDto {
  const row = object(value);
  if (row.status !== "completed" || typeof row.resultsVisible !== "boolean") throw new SocialUnavailableError();
  return { attemptId: uuid(row.attemptId), status: "completed", score: number(row.score), questionCount: number(row.questionCount), accuracy: number(row.accuracy), durationSeconds: number(row.durationSeconds), resultsVisible: row.resultsVisible };
}

export async function createStudyChallenge(supabase: StudyRpcSupabase, input: { recipientId: string; outputId: string; mode: StudyMode; deadlineAt: string | null; message: string | null; revealPolicy: RevealPolicy }) {
  return decodeChallenge(await call(supabase, "create_study_challenge", { p_recipient_id: input.recipientId, p_output_id: input.outputId, p_mode: input.mode, p_deadline_at: input.deadlineAt, p_message: input.message, p_reveal_policy: input.revealPolicy }));
}
export async function startStudyChallengeAttempt(supabase: StudyRpcSupabase, sessionId: string) { return decodeAttempt(await call(supabase, "start_study_challenge_attempt", { p_session_id: sessionId })); }
export async function acceptStudyChallenge(supabase: StudyRpcSupabase, sessionId: string) { return decodeAttempt(await call(supabase, "accept_study_challenge", { p_session_id: sessionId })); }
export async function listStudyChallenges(supabase: StudyRpcSupabase, limit: number, before: string | null) { return call(supabase, "list_study_challenges", { p_limit: limit, p_before: before }); }
export async function getStudyChallenge(supabase: StudyRpcSupabase, sessionId: string) { return call(supabase, "get_study_challenge", { p_session_id: sessionId }); }
export async function declineStudyChallenge(supabase: StudyRpcSupabase, sessionId: string) { return call(supabase, "decline_study_challenge", { p_session_id: sessionId }); }
export async function getStudyAttemptPractice(supabase: StudyRpcSupabase, attemptId: string) { return decodePractice(await call(supabase, "get_study_attempt_practice", { p_attempt_id: attemptId })); }
export async function saveStudyAttemptProgress(supabase: StudyRpcSupabase, attemptId: string, selectedIndices: (number | null)[], currentQuestionIndex: number) { return call(supabase, "save_study_attempt_progress", { p_attempt_id: attemptId, p_selected_indices: selectedIndices, p_current_question_index: currentQuestionIndex }); }
export async function completeStudyAttempt(supabase: StudyRpcSupabase, attemptId: string, selectedIndices: (number | null)[], durationSeconds: number) { return decodeResult(await call(supabase, "complete_study_attempt", { p_attempt_id: attemptId, p_selected_indices: selectedIndices, p_duration_seconds: durationSeconds })); }
export async function listNotifications(supabase: StudyRpcSupabase, limit: number, before: string | null) { return call(supabase, "list_social_notifications", { p_limit: limit, p_before: before }); }
export async function markNotificationRead(supabase: StudyRpcSupabase, notificationId: string) { return call(supabase, "mark_social_notification_read", { p_notification_id: notificationId }); }
export async function markAllNotificationsRead(supabase: StudyRpcSupabase) { return call(supabase, "mark_all_social_notifications_read", {}); }
export async function archiveChallengeNotification(supabase: StudyRpcSupabase, sessionId: string) { return call(supabase, "archive_study_challenge_notification", { p_session_id: sessionId }); }
export async function getUnreadNotificationCount(supabase: StudyRpcSupabase) { const row = await call(supabase, "get_social_notification_unread_count", {}); return number(row.count); }
export function mapStudyTogetherRouteError(error: unknown) { return error instanceof SocialUnavailableError ? { status: 404, body: { error: "social_unavailable" } } : null; }
