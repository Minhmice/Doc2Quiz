import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  CollaborationError,
  createWorkspaceInvitation,
  listWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from "@/lib/server/workspaces/collaboration";
import {
  requireWorkspacePermission,
  WorkspacePermissionError,
} from "@/lib/server/workspaces/permissions";

const createInvitationSchema = z.object({
  recipientUserId: z.string().uuid(),
  role: z.enum(["editor", "viewer"]),
});

const revokeInvitationSchema = z.object({
  invitationId: z.string().uuid(),
});

function mapCollaborationError(error: CollaborationError) {
  const status =
    error.code === "forbidden"
      ? 403
      : error.code === "invalid" || error.code === "invitation_exists"
        ? 400
        : 404;
  return NextResponse.json({ error: error.code }, { status });
}

function mapPermissionError(error: WorkspacePermissionError) {
  const status = error.code === "forbidden" ? 403 : 404;
  return NextResponse.json({ error: error.code }, { status });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { workspaceId } = await ctx.params;

  try {
    await requireWorkspacePermission(
      auth.supabase,
      workspaceId,
      "manage_members",
      auth.user.id,
    );
    const invitations = await listWorkspaceInvitations(auth.supabase, workspaceId);
    return NextResponse.json({ data: invitations });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace invitations list route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { workspaceId } = await ctx.params;

  let body: z.infer<typeof createInvitationSchema>;
  try {
    body = createInvitationSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    await requireWorkspacePermission(
      auth.supabase,
      workspaceId,
      "manage_members",
      auth.user.id,
    );
    const data = await createWorkspaceInvitation(
      auth.supabase,
      workspaceId,
      body.recipientUserId,
      body.role,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace invitations create route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ workspaceId: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { workspaceId } = await ctx.params;

  let body: z.infer<typeof revokeInvitationSchema>;
  try {
    body = revokeInvitationSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    await requireWorkspacePermission(
      auth.supabase,
      workspaceId,
      "manage_members",
      auth.user.id,
    );
    const data = await revokeWorkspaceInvitation(
      auth.supabase,
      body.invitationId,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace invitations revoke route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
