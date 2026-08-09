export type TypingState = "typing" | "stopped";
export type TypingUser = Readonly<{ userId: string; state: "typing"; expiresAt: string }>;
export type TypingSnapshot = Readonly<{ state: "ready" | "unknown"; users: readonly TypingUser[] }>;

type Timer = ReturnType<typeof setTimeout>;

async function typingRequest<T>(conversationId: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api/friends/messages/${conversationId}/typing`, init);
  if (!response.ok) throw new Error("typing_unavailable");
  return (await response.json() as { data: T }).data;
}

export function getTypingSnapshot(conversationId: string): Promise<TypingSnapshot> {
  return typingRequest<TypingSnapshot>(conversationId);
}

export async function updateTyping(conversationId: string, state: TypingState): Promise<void> {
  await typingRequest(conversationId, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ state }),
  });
}

export function createTypingController(conversationId: string, send: typeof updateTyping = updateTyping, debounceMs = 500) {
  let timer: Timer | null = null;
  let active = false;
  const clear = () => { if (timer !== null) clearTimeout(timer); timer = null; };
  const stopped = () => { active = false; void send(conversationId, "stopped").catch(() => undefined); };
  return {
    input(value: string) {
      clear();
      if (!value.trim()) return stopped();
      if (active) return;
      timer = setTimeout(() => { active = true; void send(conversationId, "typing").catch(() => undefined); }, debounceMs);
    },
    stop() { clear(); if (active) stopped(); },
  };
}
