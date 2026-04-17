import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./server";
import {
  createNextResponse,
  createSupabaseMiddlewareClient,
} from "./middleware";

export async function getUserOrNull(): Promise<User | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}

/**
 * Server Component auth guard.
 *
 * Use in layouts/pages:
 *   await requireUser({ redirectTo: "/login" })
 */
export async function requireUser(options?: { redirectTo?: string }) {
  const redirectTo = options?.redirectTo ?? "/login";
  const user = await getUserOrNull();
  if (!user) redirect(redirectTo);
  return user;
}

/**
 * Middleware auth guard.
 *
 * Example usage in `src/middleware.ts`:
 *   export async function middleware(req: NextRequest) {
 *     return await requireUserMiddleware(req, { redirectTo: "/login" })
 *   }
 */
export async function requireUserMiddleware(
  request: NextRequest,
  options?: { redirectTo?: string },
) {
  const redirectTo = options?.redirectTo ?? "/login";
  const response = createNextResponse();
  const supabase = createSupabaseMiddlewareClient(request, response);

  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    const url = request.nextUrl.clone();
    url.pathname = redirectTo;
    return NextResponse.redirect(url);
  }

  return response;
}

