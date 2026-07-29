/**
 * Normalize Supabase URL from env. Accepts host-only values (common copy-paste mistake).
 * - Trims whitespace and trailing slashes
 * - Prepends https:// when no protocol (http:// for localhost / 127.0.0.1)
 */
export function normalizeSupabaseUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is empty");
  }

  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    const host = url.split("/")[0] ?? url;
    const useHttp =
      /^localhost(:\d+)?$/i.test(host) || /^127\.0\.0\.1(:\d+)?$/.test(host);
    url = `${useHttp ? "http" : "https"}://${url}`;
  }

  return url.replace(/\/+$/, "");
}

export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  }
  return normalizeSupabaseUrl(url);
}

export function getSupabaseAnonKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }
  return key;
}

/** Server-only. Supports legacy typo SERVICE_SUPABASESERVICE_KEY in .env. */
export function getSupabaseServiceRoleKey(): string {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SERVICE_SUPABASESERVICE_KEY?.trim();
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY (service role, not anon key)",
    );
  }
  return key;
}

export function isSupabaseServiceRoleConfigured(): boolean {
  return Boolean(
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
      process.env.SERVICE_SUPABASESERVICE_KEY?.trim(),
  );
}
