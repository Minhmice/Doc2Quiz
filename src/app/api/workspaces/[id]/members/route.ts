import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  changeWorkspaceMemberRole,
  CollaborationError,
  listWorkspaceMembers,
  revokeWorkspaceMember,
} from "@/lib/server/workspaces/collaboration";
import {
  requireWorkspacePermission,
  WorkspacePermissionError,
} from "@/lib/server/workspaces/permissions";

const memberRoleSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["editor", "viewer"]),
});

function mapCollaborationError(error: CollaborationError) {
  const status =
    error.code === "forbidden" ? 403 : error.code === "invalid" ? 400 : 404;
  return NextResponse.json({ error: error.code }, { status });
}

function mapPermissionError(error: WorkspacePermissionError) {
  const status = error.code === "forbidden" ? 403 : 404;
  return NextResponse.json({ error: error.code }, { status });
}

export async function GET(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id: workspaceId } = await ctx.params;

  try {
    await requireWorkspacePermission(
      auth.supabase,
      workspaceId,
      "manage_members",
      auth.user.id,
    );
    const members = await listWorkspaceMembers(auth.supabase, workspaceId);
    return NextResponse.json({ data: members });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace members list route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id: workspaceId } = await ctx.params;

  let body: z.infer<typeof memberRoleSchema>;
  try {
    body = memberRoleSchema.parse(await request.json());
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
    const data = await changeWorkspaceMemberRole(
      auth.supabase,
      workspaceId,
      body.userId,
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
    console.error("workspace members patch route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { id: workspaceId } = await ctx.params;

  let body: { userId: string };
  try {
    body = z.object({ userId: z.string().uuid() }).parse(await request.json());
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
    const data = await revokeWorkspaceMember(
      auth.supabase,
      workspaceId,
      body.userId,
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace members delete route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
