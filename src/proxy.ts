import { type NextRequest, NextResponse } from "next/server";

import { updateSession } from "@/lib/supabase/middlewareClient";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.searchParams.get("review") === "mistakes") {
    return new NextResponse(null, { status: 404 });
  }
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|mathjax|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
