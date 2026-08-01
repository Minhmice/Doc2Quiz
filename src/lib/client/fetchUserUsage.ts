export type UserUsage = {
  plan: "free" | "pro";
  weeklyUsed: number;
  weeklyLimit: number;
  weeklyRemaining: number;
  bonusCredits: number;
  weekResetsAt: string;
  canGenerateThisSet?: boolean;
};

export async function fetchUserUsage(options?: {
  studySetId?: string;
  signal?: AbortSignal;
}): Promise<UserUsage> {
  const params = new URLSearchParams();
  if (options?.studySetId) {
    params.set("studySetId", options.studySetId);
  }
  const query = params.toString();
  const url = query ? `/api/usage?${query}` : "/api/usage";

  const response = await fetch(url, {
    cache: "no-store",
    signal: options?.signal,
  });
  if (!response.ok) {
    throw new Error("Unable to load usage.");
  }

  return (await response.json()) as UserUsage;
}

export function notifyUsageUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("doc2quiz:usage-updated"));
}
