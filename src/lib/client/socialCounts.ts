import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

export type SocialCounts = {
  notificationUnreadCount: number;
  incomingRequestCount: number;
  unreadMessageCount: number;
};

export type SocialCountsSnapshot = SocialCounts & { notifications: unknown[] };

type Overview = { incomingRequestCount?: unknown; unreadMessageCount?: unknown };
type NotificationPage = { notifications?: unknown[] };

async function readData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("social_unavailable");
  return ((await response.json()) as { data: T }).data;
}

export async function refreshSocialCounts(): Promise<SocialCountsSnapshot> {
  const [overview, notificationCount, notificationPage] = await Promise.all([
    readData<Overview>("/api/friends"),
    readData<{ count?: unknown }>("/api/friends/notifications/unread-count"),
    readData<NotificationPage>("/api/friends/notifications?limit=20"),
  ]);
  return {
    notificationUnreadCount: typeof notificationCount.count === "number" ? notificationCount.count : 0,
    incomingRequestCount: typeof overview.incomingRequestCount === "number" ? overview.incomingRequestCount : 0,
    unreadMessageCount: typeof overview.unreadMessageCount === "number" ? overview.unreadMessageCount : 0,
    notifications: Array.isArray(notificationPage.notifications) ? notificationPage.notifications : [],
  };
}

type ControllerOptions = {
  supabase: SupabaseClient;
  userId: string;
  onSnapshot: (snapshot: SocialCountsSnapshot) => void;
  reconcile?: () => Promise<SocialCountsSnapshot>;
  windowTarget?: Pick<Window, "addEventListener" | "removeEventListener">;
  documentTarget?: Pick<Document, "addEventListener" | "removeEventListener" | "visibilityState">;
};

export function createSocialCountsController(options: ControllerOptions): () => void {
  const reconcile = options.reconcile ?? refreshSocialCounts;
  const windowTarget = options.windowTarget ?? window;
  const documentTarget = options.documentTarget ?? document;
  let queued = false;
  let stopped = false;
  const schedule = () => {
    if (queued || stopped) return;
    queued = true;
    queueMicrotask(() => {
      queued = false;
      if (!stopped) void reconcile().then(options.onSnapshot).catch(() => undefined);
    });
  };
  const channels: RealtimeChannel[] = [
    options.supabase.channel(`social-notifications:${options.userId}`, { config: { private: true } }),
    options.supabase.channel(`social-requests:${options.userId}`, { config: { private: true } }),
    options.supabase.channel(`social-counts:${options.userId}`, { config: { private: true } }),
  ];
  for (const channel of channels) {
    channel.on("broadcast", { event: "*" }, schedule).subscribe((status) => {
      if (status === "SUBSCRIBED") schedule();
    });
  }
  const onFocus = () => schedule();
  const onVisibility = () => { if (documentTarget.visibilityState === "visible") schedule(); };
  windowTarget.addEventListener("focus", onFocus);
  documentTarget.addEventListener("visibilitychange", onVisibility);
  schedule();
  return () => {
    stopped = true;
    windowTarget.removeEventListener("focus", onFocus);
    documentTarget.removeEventListener("visibilitychange", onVisibility);
    for (const channel of channels) void options.supabase.removeChannel(channel);
  };
}
