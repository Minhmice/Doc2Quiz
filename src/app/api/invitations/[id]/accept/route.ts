import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  acceptWorkspaceInvitation,
  CollaborationError,
} from "@/lib/server/workspaces/collaboration";

function mapCollaborationError(error: CollaborationError) {
  const status =
    error.code === "forbidden"
      ? 403
      : error.code === "expired" || error.code === "invalid"
        ? 400
        : 404;
  return NextResponse.json({ error: error.code }, { status });
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id: invitationId } = await ctx.params;

  try {
    const data = await acceptWorkspaceInvitation(auth.supabase, invitationId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("invitation accept route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
