"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listAcceptedFriends, listAcceptedFriendPage, listBlockedUserPage, listFriendRequestPage, type AcceptedFriendSummary, type Page } from "@/lib/client/friends";
import type { PresenceBucket } from "@/lib/social/presenceTypes";
import { listConversationPage } from "@/lib/client/messages";
import { listStudyChallenges } from "@/lib/client/studyTogether";
import { StudyChallengeDialog } from "@/components/friends/StudyChallengeDialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocale } from "@/components/locale/LocaleProvider";
import type { MessageCatalog } from "@/lib/locale/types";
import { friendProfileHref } from "@/lib/profile/usernameValidation";

export const FRIEND_DESTINATIONS = ["friends", "requests", "invites", "messages", "blocked"] as const;
export type FriendDestination = typeof FRIEND_DESTINATIONS[number];
export type FriendPresenceDestination = "online" | "offline";

export const normalizeFriendDestination = (value: string | null): FriendDestination => FRIEND_DESTINATIONS.includes(value as FriendDestination) ? value as FriendDestination : "friends";
export const normalizeFriendPresenceDestination = (value: string | null | undefined): FriendPresenceDestination => value === "online" ? "online" : "offline";

const emptyPage: Page<Record<string, unknown>> = { items: [], nextCursor: null, hasMore: false };
const id = (d: FriendDestination, row: Record<string, unknown>) => String(row[d === "friends" || d === "blocked" ? "userId" : d === "requests" ? "requestId" : d === "invites" ? "sessionId" : "conversationId"]);
const destinationKeys: Record<FriendDestination, keyof MessageCatalog["friends"]["destinations"]> = { friends: "friends", requests: "requests", invites: "invites", messages: "messages", blocked: "blocked" };
const PRESENCE_THRESHOLD_MS = 5 * 60_000;
const PRESENCE_REFRESH_MS = 60_000;

type PresenceRefreshTarget = { addEventListener: (type: string, listener: () => void) => void; removeEventListener: (type: string, listener: () => void) => void };
type PresenceDocumentTarget = PresenceRefreshTarget & { visibilityState: string };
type PresenceTimer = ReturnType<typeof setTimeout>;

type PresenceRefreshOptions = {
  onRefresh: () => void;
  getNextTransitionAt: () => number | null;
  windowTarget?: PresenceRefreshTarget;
  documentTarget?: PresenceDocumentTarget;
  setTimeout?: typeof setTimeout;
  clearTimeout?: typeof clearTimeout;
};

export function getFriendsPresenceTransitionAt(items: readonly Record<string, unknown>[]): number | null {
  const transitions = items.flatMap((item) => {
    if (item.presence !== "online" || typeof item.lastActiveAt !== "string") return [];
    const timestamp = Date.parse(item.lastActiveAt);
    return Number.isFinite(timestamp) ? [timestamp + PRESENCE_THRESHOLD_MS] : [];
  });
  return transitions.length ? Math.min(...transitions) : null;
}

export function createFriendsPresenceRefreshController(options: PresenceRefreshOptions) {
  const windowTarget = options.windowTarget ?? (typeof window === "undefined" ? undefined : window as unknown as PresenceRefreshTarget);
  const documentTarget = options.documentTarget ?? (typeof document === "undefined" ? undefined : document as unknown as PresenceDocumentTarget);
  const setTimeoutFn = options.setTimeout ?? setTimeout;
  const clearTimeoutFn = options.clearTimeout ?? clearTimeout;
  let running = false;
  let cadenceTimer: PresenceTimer | null = null;
  let transitionTimer: PresenceTimer | null = null;

  const clearTimers = () => {
    if (cadenceTimer !== null) clearTimeoutFn(cadenceTimer);
    if (transitionTimer !== null) clearTimeoutFn(transitionTimer);
    cadenceTimer = null;
    transitionTimer = null;
  };
  const scheduleTransition = () => {
    if (!running) return;
    if (transitionTimer !== null) clearTimeoutFn(transitionTimer);
    const transitionAt = options.getNextTransitionAt();
    if (transitionAt === null) return;
    const delay = Math.max(transitionAt - Date.now(), transitionAt <= Date.now() ? 1_000 : 0);
    transitionTimer = setTimeoutFn(() => {
      transitionTimer = null;
      if (!running) return;
      options.onRefresh();
    }, delay);
  };
  const triggerRefresh = () => {
    if (!running) return;
    options.onRefresh();
    scheduleTransition();
  };
  const scheduleCadence = () => {
    if (!running) return;
    cadenceTimer = setTimeoutFn(() => {
      cadenceTimer = null;
      triggerRefresh();
      scheduleCadence();
    }, PRESENCE_REFRESH_MS);
  };
  const focus = () => triggerRefresh();
  const visibilityChange = () => { if (documentTarget?.visibilityState === "visible") triggerRefresh(); };

  return {
    start() {
      if (running) return;
      running = true;
      windowTarget?.addEventListener("focus", focus);
      documentTarget?.addEventListener("visibilitychange", visibilityChange);
      scheduleCadence();
      scheduleTransition();
    },
    reschedule() {
      scheduleTransition();
    },
    stop() {
      running = false;
      windowTarget?.removeEventListener("focus", focus);
      documentTarget?.removeEventListener("visibilitychange", visibilityChange);
      clearTimers();
    },
  };
}

export function FriendsHub({ destination, studyWith = null }: { destination: FriendDestination; studyWith?: string | null }) {
  const { messages } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const presence = normalizeFriendPresenceDestination(destination === "friends" ? searchParams.get("presence") : null);
  const [page, setPage] = useState<Page<Record<string, unknown>>>(emptyPage);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [dialogOpen, setDialogOpen] = useState(Boolean(studyWith));
  const [recipient, setRecipient] = useState<AcceptedFriendSummary | null>(null);
  const requestSequenceRef = useRef(0);
  const pageRef = useRef(page);
  const refreshControllerRef = useRef<ReturnType<typeof createFriendsPresenceRefreshController> | null>(null);

  const load = useCallback(async (cursor?: string) => {
    const requestSequence = ++requestSequenceRef.current;
    setState("loading");
    try {
      const next = await (destination === "friends" ? listAcceptedFriendPage(presence, cursor) : destination === "requests" ? listFriendRequestPage("incoming", cursor) : destination === "invites" ? listStudyChallenges(cursor) : destination === "messages" ? listConversationPage(cursor) : listBlockedUserPage(cursor)) as Page<Record<string, unknown>>;
      if (requestSequence !== requestSequenceRef.current) return;
      setPage((old) => cursor ? { ...next, items: [...old.items, ...next.items.filter((row) => !old.items.some((item) => id(destination, item) === id(destination, row)))] } : next);
      setState("ready");
    } catch {
      if (requestSequence === requestSequenceRef.current) setState("error");
    }
  }, [destination, presence]);

  useEffect(() => {
    pageRef.current = page;
    refreshControllerRef.current?.reschedule();
  }, [page]);

  useEffect(() => {
    requestSequenceRef.current += 1;
    setPage(emptyPage);
    setState("loading");
    let active = true;
    const controller = destination === "friends" ? createFriendsPresenceRefreshController({
      onRefresh: () => { if (active) void load(); },
      getNextTransitionAt: () => getFriendsPresenceTransitionAt(pageRef.current.items),
    }) : null;
    refreshControllerRef.current = controller;
    controller?.start();
    void load();
    return () => {
      active = false;
      requestSequenceRef.current += 1;
      controller?.stop();
      if (refreshControllerRef.current === controller) refreshControllerRef.current = null;
    };
  }, [destination, presence, load]);

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
  const selectPresence = (next: FriendPresenceDestination) => {
    if (next === presence) return;
    requestSequenceRef.current += 1;
    setPage(emptyPage);
    setState("loading");
    router.replace(`/friends?destination=friends&presence=${next}`, { scroll: false });
  };

  return <main className="mx-auto w-full max-w-5xl min-w-0 px-4 py-6 sm:px-6"><h1 className="text-2xl font-bold">{messages.friends.title}</h1>{destination === "friends" ? <div className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-1" role="tablist" aria-label={messages.friends.presence}><button type="button" role="tab" aria-selected={presence === "online"} onClick={() => selectPresence("online")} className={presence === "online" ? "shrink-0 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground" : "shrink-0 rounded-full bg-muted px-4 py-2 text-sm"}>{messages.friends.online}</button><button type="button" role="tab" aria-selected={presence === "offline"} onClick={() => selectPresence("offline")} className={presence === "offline" ? "shrink-0 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground" : "shrink-0 rounded-full bg-muted px-4 py-2 text-sm"}>{messages.friends.offline}</button></div> : null}<nav aria-label={messages.friends.aria} className="mt-4 flex max-w-full gap-2 overflow-x-auto pb-2">{FRIEND_DESTINATIONS.map((d) => <Link key={d} href={d === "friends" ? `/friends?destination=friends&presence=${presence}` : `/friends?destination=${d}`} aria-current={d === destination ? "page" : undefined} className={`shrink-0 rounded-full px-4 py-2 text-sm ${d === destination ? "bg-primary text-primary-foreground" : "bg-muted"}`}>{messages.friends.destinations[destinationKeys[d] as keyof typeof messages.friends.destinations]}</Link>)}</nav><section aria-live="polite" className="mt-6 space-y-3">{state === "loading" && !page.items.length ? <p>{messages.friends.loading}</p> : null}{state === "error" ? <Button type="button" variant="outline" onClick={() => void load()}>{messages.friends.retry}</Button> : null}{state === "ready" && !page.items.length ? <p className="text-muted-foreground">{messages.friends.empty}</p> : page.items.map((row) => <Card key={id(destination, row)} className="min-w-0"><CardContent className="p-4">{destination === "friends" ? <Link href={friendProfileHref(String(row.userId), typeof row.username === "string" ? row.username : null)} className="flex items-center gap-3"><span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-sm font-bold text-muted-foreground">{typeof row.avatarUrl === "string" ? <img src={row.avatarUrl} alt="" className="size-full object-cover" /> : (typeof row.username === "string" ? row.username[0]?.toUpperCase() : "?")}</span><span className="truncate font-medium">{String(row.username ?? messages.friends.studyFriend)}</span></Link> : <p className="truncate font-medium">{String(row.username ?? row.title ?? row.preview ?? messages.friends.studyFriend)}</p>}{destination === "messages" ? <Link className="text-sm text-primary" href={`/friends/messages/${row.conversationId}`}>{messages.friends.openConversation}</Link> : null}</CardContent></Card>)}{page.hasMore && page.nextCursor ? <Button type="button" variant="outline" onClick={() => void load(page.nextCursor!)} disabled={state === "loading"}>{messages.friends.loadMore}</Button> : page.items.length ? <p className="text-sm text-muted-foreground">{messages.friends.endOfList}</p> : null}</section>{recipient ? <StudyChallengeDialog open={dialogOpen} onOpenChange={closeDialog} recipientId={recipient.userId} /> : null}</main>;
}
