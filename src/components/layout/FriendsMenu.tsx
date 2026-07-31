"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AddFriendDialog } from "@/components/friends/AddFriendDialog";
import { DirectMessageDialog } from "@/components/friends/DirectMessageDialog";
import { FriendActionMenu } from "@/components/friends/FriendActionMenu";
import { fetchIncomingFriendRequests, listAcceptedFriends, respondFriendRequest, type AcceptedFriendSummary, type IncomingFriendRequestSummary } from "@/lib/client/friends";
import { createSocialCountsController, type SocialCountsSnapshot } from "@/lib/client/socialCounts";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

export function FriendsMenu() {
  const router = useRouter();
  const [friends, setFriends] = useState<AcceptedFriendSummary[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequestSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [messageFriend, setMessageFriend] = useState<AcceptedFriendSummary | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [counts, setCounts] = useState<SocialCountsSnapshot>({ notificationUnreadCount: 0, incomingRequestCount: 0, unreadMessageCount: 0, notifications: [] });
  const refresh = useCallback(async () => {
    try {
      const [nextFriends, nextIncoming] = await Promise.all([listAcceptedFriends(), fetchIncomingFriendRequests()]);
      setFriends(nextFriends); setIncoming(nextIncoming.requests);
    } catch { setStatus("Không thể tải danh sách bạn bè."); }
  }, []);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cleanup: () => void = () => undefined;
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user?.id) cleanup = createSocialCountsController({ supabase, userId: data.user.id, onSnapshot: setCounts });
    });
    return () => cleanup();
  }, []);
  const respond = async (id: string, action: "accept" | "decline") => {
    try { await respondFriendRequest(id, action); await refresh(); }
    catch { setStatus("Không thể cập nhật lời mời."); }
  };
  const online = friends.filter((friend) => friend.isOnline);
  const offline = friends.filter((friend) => !friend.isOnline);
  const aggregateCount = counts.notificationUnreadCount + counts.incomingRequestCount + counts.unreadMessageCount;
  const openChat = (friend: AcceptedFriendSummary) => { setMessageFriend(friend); setChatOpen(true); };
  const refreshFriends = useCallback(() => { void refresh(); }, [refresh]);
  const studyTogether = (friend: AcceptedFriendSummary) => {
    setOpen(false);
    router.push(`/friends?studyWith=${friend.userId}`);
  };

  return <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger aria-label="Bạn bè" className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative size-10")}>
        <img src="/friends-add-icon.png" alt="" className="size-5 object-contain" />
        <span className="sr-only">Bạn bè</span>
        {aggregateCount ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">{aggregateCount}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="grid grid-cols-3 gap-1 px-2 py-2 text-center text-[11px] text-muted-foreground">
          <span>Yêu cầu <strong className="block text-sm text-foreground">{counts.incomingRequestCount}</strong></span>
          <span>Lời mời học <strong className="block text-sm text-foreground">{counts.notificationUnreadCount}</strong></span>
          <span>Tin nhắn <strong className="block text-sm text-foreground">{counts.unreadMessageCount}</strong></span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => setAddOpen(true)}><UserPlus />Thêm bạn</DropdownMenuItem>
        {incoming.length > 0 && <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Lời mời đến</DropdownMenuLabel>
            {incoming.map((request) => <div key={request.id} className="px-1.5 py-2"><p className="text-sm font-medium">{request.username ?? "Bạn học"}</p><div className="mt-2 flex gap-2"><button className="text-xs font-semibold text-primary" onClick={() => void respond(request.id, "accept")}>Chấp nhận</button><button className="text-xs text-muted-foreground" onClick={() => void respond(request.id, "decline")}>Từ chối</button></div></div>)}
          </DropdownMenuGroup>
        </>}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Đang online</DropdownMenuLabel>
          {online.length ? online.map((friend) => <FriendActionMenu key={friend.userId} userId={friend.userId} username={friend.username} avatarUrl={friend.avatarUrl} presence={friend.presence} onStudyTogether={() => studyTogether(friend)} onMessage={() => openChat(friend)} onRefresh={refreshFriends} onStatus={setStatus} />) : <p className="px-1.5 py-2 text-sm text-muted-foreground">Chưa có bạn nào online.</p>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>Ngoại tuyến</DropdownMenuLabel>
          {offline.length ? offline.map((friend) => <FriendActionMenu key={friend.userId} userId={friend.userId} username={friend.username} avatarUrl={friend.avatarUrl} presence={friend.presence} onStudyTogether={() => studyTogether(friend)} onMessage={() => openChat(friend)} onRefresh={refreshFriends} onStatus={setStatus} />) : <p className="px-1.5 py-2 text-sm text-muted-foreground">Chưa có bạn nào ngoại tuyến.</p>}
        </DropdownMenuGroup>
        <p className="sr-only" aria-live="polite">{status}</p>
      </DropdownMenuContent>
    </DropdownMenu>
    <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} onSent={() => void refresh()} />
    <DirectMessageDialog friend={messageFriend} open={chatOpen} onOpenChange={setChatOpen} onMessageReceived={refreshFriends} onConversationRead={refreshFriends} />
  </>;
}
