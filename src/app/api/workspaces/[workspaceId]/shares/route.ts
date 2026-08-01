import { createHash, randomBytes } from "crypto";

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiUser } from "@/lib/api/requireApiUser";
import {
  CollaborationError,
  createWorkspaceShare,
  listWorkspaceShares,
  revokeWorkspaceShare,
} from "@/lib/server/workspaces/collaboration";
import {
  requireWorkspacePermission,
  WorkspacePermissionError,
} from "@/lib/server/workspaces/permissions";

const createShareSchema = z.object({
  targetKind: z.enum(["workspace", "quiz", "flashcard"]),
  targetId: z.string().uuid(),
});

const revokeShareSchema = z.object({
  shareId: z.string().uuid(),
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

function issueShareSecret() {
  const secret = randomBytes(32);
  const digest = createHash("sha256").update(secret).digest();
  const token = secret.toString("base64url");
  return { token, digest: new Uint8Array(digest) };
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
      "manage_shares",
      auth.user.id,
    );
    const shares = await listWorkspaceShares(auth.supabase, workspaceId);
    return NextResponse.json({ data: shares });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace shares list route error", error);
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

  let body: z.infer<typeof createShareSchema>;
  try {
    body = createShareSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    await requireWorkspacePermission(
      auth.supabase,
      workspaceId,
      "manage_shares",
      auth.user.id,
    );
    const targetId =
      body.targetKind === "workspace" ? workspaceId : body.targetId;
    const { token, digest } = issueShareSecret();
    const data = await createWorkspaceShare(
      auth.supabase,
      workspaceId,
      body.targetKind,
      targetId,
      digest,
    );
    return NextResponse.json({ data: { ...data, token } });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace shares create route error", error);
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

  let body: z.infer<typeof revokeShareSchema>;
  try {
    body = revokeShareSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }

  try {
    await requireWorkspacePermission(
      auth.supabase,
      workspaceId,
      "manage_shares",
      auth.user.id,
    );
    const data = await revokeWorkspaceShare(auth.supabase, body.shareId);
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof WorkspacePermissionError) {
      return mapPermissionError(error);
    }
    if (error instanceof CollaborationError) {
      return mapCollaborationError(error);
    }
    console.error("workspace shares revoke route error", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

export const runtime = "nodejs";
