const NETWORK_PATTERN = /failed to fetch|fetch failed|networkerror|network request failed/i;

/** Map Supabase auth / fetch failures to actionable copy for login & signup forms. */
export function formatAuthClientError(
  err: unknown,
  fallback: string,
): string {
  const message =
    err && typeof err === "object" && "message" in err
      ? String((err as { message: unknown }).message)
      : err instanceof Error
        ? err.message
        : "";

  if (message && NETWORK_PATTERN.test(message)) {
    return (
      "Cannot reach Supabase (Failed to fetch). Check NEXT_PUBLIC_SUPABASE_URL " +
      "in .env — it must be a full URL like https://xxxx.supabase.co or " +
      "http://your-host (not just the hostname). Restart npm run dev after changing .env."
    );
  }

  if (message === "Email not confirmed") {
    return (
      "Email not confirmed. In Supabase Dashboard → Authentication → Providers → Email, " +
      "turn off “Confirm email” for local dev, or confirm the user in Authentication → Users."
    );
  }

  return message || fallback;
}
