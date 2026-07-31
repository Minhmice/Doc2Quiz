"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ConversationView } from "@/components/friends/ConversationView";
import { openDirectConversation } from "@/lib/client/messages";

type Friend = { userId: string; username: string | null; avatarUrl: string | null; isOnline: boolean; lastActiveAt: string | null };

function relativeLastActive(value: string | null) {
  if (!value) return "Không hoạt động gần đây";
  const minutes = Math.max(1, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hoạt động ${hours} giờ trước`;
  return `Hoạt động ${Math.floor(hours / 24)} ngày trước`;
}

function ChatAvatar({ url, name }: { url: string | null; name: string | null }) {
  return <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">{url ? <img src={url} alt="" className="size-full object-cover" /> : (name?.trim()[0]?.toUpperCase() ?? "?")}</span>;
}

export function DirectMessageDialog({ friend, open, onOpenChange, onMessageReceived, onConversationRead }: { friend: Friend | null; open: boolean; onOpenChange: (open: boolean) => void; onMessageReceived?: () => void; onConversationRead?: () => void }) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const loadedFriendId = useRef<string | null>(null);

  useEffect(() => {
    if (!open || !friend || loadedFriendId.current === friend.userId) return;
    loadedFriendId.current = friend.userId;
    setConversationId(null); setError("");
    void openDirectConversation(friend.userId).then(({ conversationId: id }) => setConversationId(id)).catch(() => { loadedFriendId.current = null; setError("Không thể mở cuộc trò chuyện."); });
  }, [friend, open]);
  useEffect(() => { if (!open) { loadedFriendId.current = null; setConversationId(null); } }, [open]);

  if (!friend || !open) return null;
  return createPortal(<section className="fixed bottom-4 right-4 z-50 hidden h-[30rem] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl md:flex" aria-label={`Trò chuyện với ${friend.username ?? "bạn học"}`}>
    <header className="flex shrink-0 items-center gap-3 border-b border-border bg-muted/30 px-4 py-3"><ChatAvatar url={friend.avatarUrl} name={friend.username} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{friend.username ?? "Bạn học"}</p><p className="text-xs text-muted-foreground">{friend.isOnline ? "Đang hoạt động" : relativeLastActive(friend.lastActiveAt)}</p></div><Button type="button" variant="ghost" size="icon" className="size-8" onClick={() => onOpenChange(false)} aria-label="Đóng trò chuyện"><X className="size-4" /></Button></header>
    {conversationId ? <ConversationView conversationId={conversationId} friendName={friend.username} friendAvatarUrl={friend.avatarUrl} onMessageReceived={onMessageReceived} onConversationRead={onConversationRead} /> : <p className="m-auto text-sm text-muted-foreground">{error || "Đang mở cuộc trò chuyện…"}</p>}
  </section>, document.body);
}
