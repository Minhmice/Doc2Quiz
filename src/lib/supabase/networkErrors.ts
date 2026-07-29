const NETWORK_PATTERN =
  /failed to fetch|fetch failed|networkerror|network request failed|connect timeout|und_err_connect_timeout/i;

export function isSupabaseNetworkError(message: string): boolean {
  return NETWORK_PATTERN.test(message);
}

/** Actionable copy when Supabase REST/storage calls fail at the network layer. */
export function formatSupabaseNetworkError(message: string): string {
  if (!isSupabaseNetworkError(message)) {
    return message;
  }
  return (
    "Cannot reach Supabase (connection timed out or failed). " +
    "Check NEXT_PUBLIC_SUPABASE_URL in .env and your network/VPN, then retry. " +
    "Very large documents are truncated before save; if this persists, try a smaller file."
  );
}
