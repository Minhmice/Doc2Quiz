import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "./env";
import type { Database } from "@/types/supabase";

type SupabaseDbClient = ReturnType<typeof createServerClient<Database, "public">>;

/**
 * Server Component / Route Handler Supabase client using cookie-based auth.
 *
 * IMPORTANT: This reads/writes auth cookies via Next's `cookies()` store.
 */
export async function createSupabaseServerClient(): Promise<SupabaseDbClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = requireSupabasePublicEnv();

  return createServerClient<Database, "public">(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

