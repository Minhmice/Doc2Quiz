"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConversationView } from "@/components/friends/ConversationView";
import { openDirectConversation } from "@/lib/client/messages";
import { useLocale } from "@/components/locale/LocaleProvider";

export type DirectMessageFriend = { userId: string; username: string | null; avatarUrl: string | null; presence: "online" | "recently_active" | "offline"; lastActiveAt: string | null };

export function getDirectMessageHeaderStatus(friend: Pick<DirectMessageFriend, "presence">): "online" | "last-active" {
  return friend.presence === "online" ? "online" : "last-active";
}

function relativeLastActive(value: string | null, labels: { noRecentActivity: string; lastActive: (minutes: number) => string; lastActiveHours: (hours: number) => string; lastActiveDays: (days: number) => string }) {
  if (!value) return labels.noRecentActivity;
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return labels.lastActive(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return labels.lastActiveHours(hours);
  return labels.lastActiveDays(Math.floor(hours / 24));
}

function ChatAvatar({ url, name }: { url: string | null; name: string | null }) {
  return <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">{url ? <img src={url} alt="" className="size-full object-cover" /> : (name?.trim()[0]?.toUpperCase() ?? "?")}</span>;
}

export function DirectMessageDialog({ friend, open, onOpenChange, onMessageReceived, onConversationRead }: { friend: DirectMessageFriend | null; open: boolean; onOpenChange: (open: boolean) => void; onMessageReceived?: () => void; onConversationRead?: () => void }) {
  const { messages } = useLocale();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const loadedFriendId = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !friend || loadedFriendId.current === friend.userId) return;
    loadedFriendId.current = friend.userId;
    setConversationId(null); setError("");
    void openDirectConversation(friend.userId).then(({ conversationId: id }) => setConversationId(id)).catch(() => { loadedFriendId.current = null; setError(messages.friends.conversationUnavailable); });
  }, [friend, open]);
  useEffect(() => { if (!open) { loadedFriendId.current = null; setConversationId(null); } }, [open]);

  if (!friend || !open) return null;
  return createPortal(<section className="fixed bottom-4 right-4 z-50 hidden h-[30rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl md:flex" aria-label={messages.friends.chatWith(friend.username ?? messages.friends.student)}>
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/30 px-4 py-3"><ChatAvatar url={friend.avatarUrl} name={friend.username} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{friend.username ?? messages.friends.student}</p><p className="text-xs text-muted-foreground">{getDirectMessageHeaderStatus(friend) === "online" ? messages.friends.activeNow : relativeLastActive(friend.lastActiveAt, messages.friends)}</p></div><Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)} aria-label={messages.friends.closeChat}><X className="size-4" /></Button></header>
    {conversationId ? <ConversationView conversationId={conversationId} friendName={friend.username} friendAvatarUrl={friend.avatarUrl} onMessageReceived={onMessageReceived} onConversationRead={onConversationRead} /> : <p className="m-auto text-sm text-muted-foreground">{error || messages.friends.openingConversation}</p>}
  </section>, document.body);
}
