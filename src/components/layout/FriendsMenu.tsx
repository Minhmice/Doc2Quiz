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
import { createSocialCountsController, emptySocialCountsSnapshot, type SocialCountsSnapshot } from "@/lib/client/socialCounts";
import { openDirectConversation } from "@/lib/client/messages";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale/LocaleProvider";

export function FriendsMenu() {
  const { messages } = useLocale();
  const router = useRouter();
  const [friends, setFriends] = useState<AcceptedFriendSummary[]>([]);
  const [incoming, setIncoming] = useState<IncomingFriendRequestSummary[]>([]);
  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [messageFriend, setMessageFriend] = useState<AcceptedFriendSummary | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [counts, setCounts] = useState<SocialCountsSnapshot>(emptySocialCountsSnapshot);
  const refresh = useCallback(async () => {
    try {
      const [nextFriends, nextIncoming] = await Promise.all([listAcceptedFriends(), fetchIncomingFriendRequests()]);
      setFriends(nextFriends); setIncoming(nextIncoming.requests);
    } catch { setStatus(messages.friends.unavailable); }
  }, []);
  useEffect(() => { if (open) void refresh(); }, [open, refresh]);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let active = true;
    let cleanup: () => void = () => undefined;
    const timer = window.setTimeout(() => {
      void supabase.auth.getUser().then(({ data }) => {
        if (!active || !data.user?.id) return;
        const nextCleanup = createSocialCountsController({ supabase, userId: data.user.id, onSnapshot: setCounts });
        if (active) cleanup = nextCleanup;
        else nextCleanup();
      });
    }, 2000);
    return () => {
      active = false;
      window.clearTimeout(timer);
      cleanup();
    };
  }, []);
  const respond = async (id: string, action: "accept" | "decline") => {
    try { await respondFriendRequest(id, action); await refresh(); }
    catch { setStatus(messages.friendActions.failed); }
  };
  const online = friends.filter((friend) => friend.presence === "online");
  const offline = friends.filter((friend) => friend.presence !== "online");
  const aggregateCount = counts.notificationUnreadCount + counts.incomingRequestCount + counts.unreadMessageCount;
  const openChat = (friend: AcceptedFriendSummary) => {
    setOpen(false);
    if (window.matchMedia("(max-width: 767px)").matches) {
      void openDirectConversation(friend.userId).then(({ conversationId }) => router.push(`/friends/messages/${conversationId}`)).catch(() => setStatus(messages.friends.conversationUnavailable));
      return;
    }
    setMessageFriend(friend); setChatOpen(true);
  };
  const refreshFriends = useCallback(() => { void refresh(); }, [refresh]);
  const studyTogether = (friend: AcceptedFriendSummary) => {
    setOpen(false);
    router.push(`/friends?studyWith=${friend.userId}`);
  };

  return <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger aria-label={messages.friends.aria} className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "relative size-10")}>
        <img src="/friends-add-icon.png" alt="" className="size-5 object-contain" />
        <span className="sr-only">{messages.friends.aria}</span>
        {aggregateCount ? <span className="absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground">{aggregateCount}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <div className="grid grid-cols-2 gap-1 px-2 py-2 text-center text-[11px] text-muted-foreground">
          <button type="button" className="min-h-11 cursor-pointer rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => router.push("/friends?destination=requests")}>{messages.friends.requests} <strong className="block text-sm text-foreground">{counts.incomingRequestCount}</strong></button>
          <button type="button" className="min-h-11 cursor-pointer rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => router.push("/friends?destination=invites")}>{messages.friends.studyInvites} <strong className="block text-sm text-foreground">{counts.notificationUnreadCount}</strong></button>
          <button type="button" className="min-h-11 cursor-pointer rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => router.push("/friends?destination=friends")}>{messages.friends.activeFriends} <strong className="block text-sm text-foreground">{friends.filter(friend=>friend.presence === "online").length}</strong></button>
          <button type="button" className="min-h-11 cursor-pointer rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => router.push("/friends?destination=messages")}>{messages.friends.messages} <strong className="block text-sm text-foreground">{counts.unreadMessageCount}</strong></button>
        </div>
        <DropdownMenuItem onClick={() => router.push("/friends?destination=friends")}>{messages.friends.viewAll}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" onClick={() => setAddOpen(true)}><UserPlus />{messages.friends.addFriend}</DropdownMenuItem>
        {incoming.length > 0 && <>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>{messages.friends.incoming}</DropdownMenuLabel>
            {incoming.map((request) => <div key={request.id} className="px-1.5 py-2"><p className="text-sm font-medium">{request.username ?? messages.friends.student}</p><div className="mt-2 flex gap-2"><button className="text-xs font-semibold text-primary" onClick={() => void respond(request.id, "accept")}>{messages.friends.accept}</button><button className="text-xs text-muted-foreground" onClick={() => void respond(request.id, "decline")}>{messages.friends.decline}</button></div></div>)}
          </DropdownMenuGroup>
        </>}
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{messages.friends.onlineHeading}</DropdownMenuLabel>
          {online.length ? online.map((friend) => <FriendActionMenu key={friend.userId} userId={friend.userId} username={friend.username} avatarUrl={friend.avatarUrl} presence={friend.presence} onStudyTogether={() => studyTogether(friend)} onMessage={() => openChat(friend)} onRefresh={refreshFriends} onStatus={setStatus} />) : <p className="px-1.5 py-2 text-sm text-muted-foreground">{messages.friends.noOnline}</p>}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuLabel>{messages.friends.offlineHeading}</DropdownMenuLabel>
          {offline.length ? offline.map((friend) => <FriendActionMenu key={friend.userId} userId={friend.userId} username={friend.username} avatarUrl={friend.avatarUrl} presence={friend.presence} onStudyTogether={() => studyTogether(friend)} onMessage={() => openChat(friend)} onRefresh={refreshFriends} onStatus={setStatus} />) : <p className="px-1.5 py-2 text-sm text-muted-foreground">{messages.friends.noOffline}</p>}
        </DropdownMenuGroup>
        <p className="sr-only" aria-live="polite">{status}</p>
      </DropdownMenuContent>
    </DropdownMenu>
    <AddFriendDialog open={addOpen} onOpenChange={setAddOpen} onSent={() => void refresh()} />
    <DirectMessageDialog friend={messageFriend} open={chatOpen} onOpenChange={setChatOpen} onMessageReceived={refreshFriends} onConversationRead={refreshFriends} />
  </>;
}
