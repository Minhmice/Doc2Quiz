"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { listAcceptedFriends, listAcceptedFriendPage, listBlockedUserPage, listFriendRequestPage, type AcceptedFriendSummary, type Page } from "@/lib/client/friends";
import { listConversationPage } from "@/lib/client/messages";
import { listStudyChallenges } from "@/lib/client/studyTogether";
import { StudyChallengeDialog } from "@/components/friends/StudyChallengeDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const FRIEND_DESTINATIONS = ["friends", "requests", "invites", "messages", "blocked"] as const;
export type FriendDestination = typeof FRIEND_DESTINATIONS[number];
export const normalizeFriendDestination = (value: string | null): FriendDestination => FRIEND_DESTINATIONS.includes(value as FriendDestination) ? value as FriendDestination : "friends";
const labels: Record<FriendDestination, string> = { friends: "Friends", requests: "Requests", invites: "Invites", messages: "Messages", blocked: "Blocked" };
const id = (d: FriendDestination, row: Record<string, unknown>) => String(row[d === "friends" || d === "blocked" ? "userId" : d === "requests" ? "requestId" : d === "invites" ? "sessionId" : "conversationId"]);

export function FriendsHub({ destination, studyWith = null }: { destination: FriendDestination; studyWith?: string | null }) {
  const router = useRouter();
  const [page, setPage] = useState<Page<Record<string, unknown>>>({ items: [], nextCursor: null, hasMore: false });
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialogOpen, setDialogOpen] = useState(Boolean(studyWith));
  const [recipient, setRecipient] = useState<AcceptedFriendSummary | null>(null);
  const load = useCallback(async (cursor?: string) => {
    setState("loading");
    try {
      const next = await (destination === "friends" ? listAcceptedFriendPage(cursor) : destination === "requests" ? listFriendRequestPage("incoming", cursor) : destination === "invites" ? listStudyChallenges(cursor) : destination === "messages" ? listConversationPage(cursor) : listBlockedUserPage(cursor)) as Page<Record<string, unknown>>;
      setPage((old) => cursor ? { ...next, items: [...old.items, ...next.items.filter((row) => !old.items.some((item) => id(destination, item) === id(destination, row)))] } : next);
      setState("ready");
    } catch { setState("error"); }
  }, [destination]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!studyWith) { setDialogOpen(false); return; }
    let active = true;
    void listAcceptedFriends().then((friends) => {
      if (!active) return;
      const friend = friends.find((item) => item.userId === studyWith) ?? null;
      setRecipient(friend);
      setDialogOpen(Boolean(friend));
    }).catch(() => { if (active) { setRecipient(null); setDialogOpen(false); } });
    return () => { active = false; };
  }, [studyWith]);
  const closeDialog = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setRecipient(null);
      router.replace(`/friends?destination=${destination}`, { scroll: false });
    }
  };
  return <main className="mx-auto w-full max-w-5xl min-w-0 px-4 py-6 sm:px-6"><h1 className="text-2xl font-bold">Friends</h1><nav aria-label="Friends destinations" className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-2">{FRIEND_DESTINATIONS.map((d) => <Link key={d} href={`/friends?destination=${d}`} aria-current={d === destination ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm ${d === destination ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{labels[d]}</Link>)}</nav><section aria-live="polite" className="mt-6 space-y-3">{state === "loading" && !page.items.length ? <p>Loading…</p> : null}{state === "error" ? <Button type="button" variant="outline" onClick={() => void load()}>Retry</Button> : null}{state === "ready" && !page.items.length ? <p className="text-muted-foreground">Nothing here yet.</p> : page.items.map((row) => <Card key={id(destination, row)} className="min-w-0"><CardContent className="p-4"><p className="truncate font-medium">{String(row.username ?? row.title ?? row.preview ?? "Study friend")}</p>{destination === "messages" ? <Link className="text-sm text-primary" href={`/friends/messages/${row.conversationId}`}>Open conversation</Link> : null}</CardContent></Card>)}{page.hasMore && page.nextCursor ? <Button type="button" variant="outline" onClick={() => void load(page.nextCursor!)} disabled={state === "loading"}>Load more</Button> : page.items.length ? <p className="text-sm text-muted-foreground">End of list</p> : null}</section>{recipient ? <StudyChallengeDialog open={dialogOpen} onOpenChange={closeDialog} recipientId={recipient.userId} /> : null}</main>;
}
