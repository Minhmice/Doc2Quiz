import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middlewareClient";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets: /mathjax/* is copied to public/; avoid running auth on large JS bundles.
    "/((?!_next/static|_next/image|favicon.ico|mathjax|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
