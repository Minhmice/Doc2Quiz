import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { listWorkspaceSummaries } from "@/lib/workspaces/workspaceSummary";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) {
    return auth.error as Response;
  }

  try {
    const data = await listWorkspaceSummaries({
      supabase: auth.supabase,
      userId: auth.user.id,
    });
    return NextResponse.json({ data });
  } catch (error) {
    console.error("workspace list route error", error);
    return NextResponse.json(
      {
        error: "internal_error",
        message:
          error instanceof Error
            ? error.message
            : "Failed to list workspaces.",
      },
      { status: 500 },
    );
  }
}

export const runtime = "nodejs";
