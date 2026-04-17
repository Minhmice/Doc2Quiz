"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "./env";
import type { Database } from "@/types/supabase";

type SupabaseDbClient = ReturnType<typeof createBrowserClient<Database, "public">>;

let browserClient: SupabaseDbClient | null = null;

/**
 * Client Component Supabase client.
 *
 * Uses `@supabase/ssr` browser client so the auth cookie/session stays aligned
 * with the server-side client helpers.
 */
export function createSupabaseBrowserClient(): SupabaseDbClient {
  if (browserClient) return browserClient;
  const { url, anonKey } = requireSupabasePublicEnv();
  browserClient = createBrowserClient<Database, "public">(url, anonKey);
  return browserClient;
}

