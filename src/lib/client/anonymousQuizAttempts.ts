import { createRandomUuid } from "@/lib/ids/createRandomUuid";

export const ANONYMOUS_QUIZ_OUTBOX_VERSION = 1;
export const ANONYMOUS_QUIZ_OUTBOX_STORAGE_KEY = "doc2quiz.anonymousQuizAttempts.v1";
export const MAX_ANONYMOUS_QUIZ_OUTBOX_ATTEMPTS = 20;
export const MAX_ANONYMOUS_QUIZ_OUTBOX_BYTES = 256 * 1024;

export type AnonymousQuizAnswer = {
  questionId: string;
  selectedIndex: number;
};

export type AnonymousQuizAttemptInput = {
  shareId: string;
  outputId: string;
  completedAt: string;
  correctCount: number;
  totalQuestions: number;
  answers: AnonymousQuizAnswer[];
};

export type AnonymousQuizAttempt = AnonymousQuizAttemptInput & {
  clientAttemptId: string;
};

type OutboxPayload = {
  version: number;
  attempts: AnonymousQuizAttempt[];
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function browserStorage(storage?: Storage): Storage | undefined {
  if (storage) return storage;
  if (typeof window === "undefined") return undefined;
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isAnswer(value: unknown): value is AnonymousQuizAnswer {
  if (!value || typeof value !== "object") return false;
  const candidate = value as AnonymousQuizAnswer;
  return (
    isUuid(candidate.questionId) &&
    Number.isInteger(candidate.selectedIndex) &&
    candidate.selectedIndex >= 0 &&
    candidate.selectedIndex <= 25
  );
}

function isAttempt(value: unknown): value is AnonymousQuizAttempt {
  if (!value || typeof value !== "object") return false;
  const candidate = value as AnonymousQuizAttempt;
  return (
    isUuid(candidate.clientAttemptId) &&
    isUuid(candidate.shareId) &&
    isUuid(candidate.outputId) &&
    typeof candidate.completedAt === "string" &&
    Number.isFinite(candidate.correctCount) &&
    Number.isFinite(candidate.totalQuestions) &&
    Array.isArray(candidate.answers) &&
    candidate.answers.length > 0 &&
    candidate.answers.length <= 500 &&
    candidate.answers.every(isAnswer)
  );
}

function parseOutbox(raw: string | null): AnonymousQuizAttempt[] {
  if (!raw) return [];
  try {
    const payload = JSON.parse(raw) as OutboxPayload;
    if (payload.version !== ANONYMOUS_QUIZ_OUTBOX_VERSION) return [];
    if (!Array.isArray(payload.attempts)) return [];
    if (payload.attempts.length > MAX_ANONYMOUS_QUIZ_OUTBOX_ATTEMPTS) return [];
    if (raw.length > MAX_ANONYMOUS_QUIZ_OUTBOX_BYTES) return [];
    if (!payload.attempts.every(isAttempt)) return [];
    return payload.attempts;
  } catch {
    return [];
  }
}

function writeOutbox(attempts: AnonymousQuizAttempt[], storage?: Storage): void {
  const target = browserStorage(storage);
  if (!target) return;

  const payload: OutboxPayload = {
    version: ANONYMOUS_QUIZ_OUTBOX_VERSION,
    attempts: attempts.slice(-MAX_ANONYMOUS_QUIZ_OUTBOX_ATTEMPTS),
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length > MAX_ANONYMOUS_QUIZ_OUTBOX_BYTES) {
    return;
  }

  try {
    target.setItem(ANONYMOUS_QUIZ_OUTBOX_STORAGE_KEY, serialized);
  } catch {
    // Ignore quota errors; outbox remains best-effort.
  }
}

function clearOutbox(storage?: Storage): void {
  const target = browserStorage(storage);
  if (!target) return;
  try {
    target.removeItem(ANONYMOUS_QUIZ_OUTBOX_STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function readAnonymousQuizOutbox(storage?: Storage): AnonymousQuizAttempt[] {
  const target = browserStorage(storage);
  if (!target) return [];

  let raw: string | null;
  try {
    raw = target.getItem(ANONYMOUS_QUIZ_OUTBOX_STORAGE_KEY);
  } catch {
    return [];
  }

  const attempts = parseOutbox(raw);
  if (raw && attempts.length === 0) {
    clearOutbox(target);
  }
  return attempts;
}

export function enqueueAnonymousQuizAttempt(
  input: AnonymousQuizAttemptInput,
  storage?: Storage,
): AnonymousQuizAttempt {
  const attempt: AnonymousQuizAttempt = {
    ...input,
    clientAttemptId: createRandomUuid(),
  };

  const existing = readAnonymousQuizOutbox(storage);
  const next = [...existing, attempt].slice(-MAX_ANONYMOUS_QUIZ_OUTBOX_ATTEMPTS);
  writeOutbox(next, storage);
  return attempt;
}

export function removeAcknowledgedAnonymousQuizAttempts(
  acknowledgedIds: string[],
  storage?: Storage,
): void {
  if (acknowledgedIds.length === 0) return;
  const acknowledged = new Set(acknowledgedIds);
  const remaining = readAnonymousQuizOutbox(storage).filter(
    (attempt) => !acknowledged.has(attempt.clientAttemptId),
  );

  if (remaining.length === 0) {
    clearOutbox(storage);
    return;
  }
  writeOutbox(remaining, storage);
}

type ImportResponse = {
  acknowledgedIds?: string[];
};

export async function importPendingAnonymousQuizAttempts(storage?: Storage): Promise<void> {
  const pending = readAnonymousQuizOutbox(storage);
  if (pending.length === 0) return;

  let response: Response;
  try {
    response = await fetch("/api/quiz-attempts/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attempts: pending }),
    });
  } catch {
    return;
  }

  if (!response.ok) {
    return;
  }

  let payload: ImportResponse;
  try {
    payload = (await response.json()) as ImportResponse;
  } catch {
    return;
  }

  const acknowledgedIds = Array.isArray(payload.acknowledgedIds)
    ? payload.acknowledgedIds.filter(isUuid)
    : [];

  if (acknowledgedIds.length > 0) {
    removeAcknowledgedAnonymousQuizAttempts(acknowledgedIds, storage);
  }
}
