export const presenceBuckets = ["online", "active_15m", "active_today", "offline", "unknown"] as const;
export type PresenceBucket = (typeof presenceBuckets)[number];

export const presenceSources = ["redis", "last_known", "unknown"] as const;
export type PresenceSource = (typeof presenceSources)[number];

export type PresenceActivity = "idle" | "studying" | "chatting";
export type FriendPresenceDto = Readonly<{
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  presence: PresenceBucket;
  source: PresenceSource;
  activity: PresenceActivity | null;
  lastActiveAt: string | null;
  presenceRank: number;
}>;

export type PresenceCursor = Readonly<{
  v: 2;
  d: "friends";
  p: "online" | "offline";
  k: readonly [number, string, string];
}>;

export type PresencePage = Readonly<{
  items: readonly FriendPresenceDto[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}>;
