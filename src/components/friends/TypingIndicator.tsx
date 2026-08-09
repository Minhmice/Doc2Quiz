import type { TypingSnapshot } from "@/lib/client/typing";

export function TypingIndicator({ snapshot, currentUserId }: { snapshot: TypingSnapshot; currentUserId: string | null }) {
  if (snapshot.state === "unknown") return <p className="text-xs text-muted-foreground" aria-live="polite">Typing status unavailable.</p>;
  const count = snapshot.users.filter((user) => user.userId !== currentUserId).length;
  return count ? <p className="text-xs text-muted-foreground" aria-live="polite">{count === 1 ? "Someone is typing…" : "People are typing…"}</p> : null;
}
