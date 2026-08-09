export const PRESENCE_TTL_SECONDS = 60;
export const PRESENCE_SESSION_LIMIT = 8;

function safeSegment(value: string, pattern: RegExp, label: string) {
  if (!pattern.test(value)) throw new Error(`invalid ${label}`);
  return value;
}

export function presenceKey(userId: string, sessionId: string) {
  return `d2q:presence:${safeSegment(userId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "user id")}:${safeSegment(sessionId, /^[A-Za-z0-9_-]{1,64}$/, "session id")}`;
}

export function presenceSessionIndexKey(userId: string) {
  return `d2q:presence-sessions:${safeSegment(userId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "user id")}`;
}

export function socialRateLimitKey(scope: string, subjectType: "user" | "ip", subject: string, window: number) {
  if (!/^[a-z-]{1,32}$/.test(scope) || !/^[A-Za-z0-9._:-]{1,128}$/.test(subject)) throw new Error("invalid rate limit subject");
  return `d2q:rate:${scope}:${subjectType}:${window}`;
}
