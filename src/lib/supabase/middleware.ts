import { createServerClient } from "@supabase/ssr";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireSupabasePublicEnv } from "./env";
import type { Database } from "@/types/supabase";

type SupabaseDbClient = ReturnType<typeof createServerClient<Database, "public">>;

type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<NextResponse["cookies"]["set"]>[2];
};

/**
 * Middleware Supabase client using cookie-based auth.
 *
 * Pass in the incoming `NextRequest` and a `NextResponse` that you plan to
 * return. Any auth cookie updates will be written onto the response.
 */
export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
): SupabaseDbClient {
  const { url, anonKey } = requireSupabasePublicEnv();
  return createServerClient<Database, "public">(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });
}

export function createNextResponse() {
  return NextResponse.next();
}

