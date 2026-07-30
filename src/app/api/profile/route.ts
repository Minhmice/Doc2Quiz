import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/requireApiUser";
import { validateProfileText } from "@/lib/profile/profileValidation";
import { validateUsername } from "@/lib/profile/usernameValidation";
import { mapSocialRouteError, setProfileUsername } from "@/lib/server/friends/friends";

function fallbackName(email: string | undefined) {
  return email?.split("@")[0] || "Student";
}

function mapSocialError(error: unknown) {
  const mapped = mapSocialRouteError(error);
  if (!mapped) return null;
  const headers =
    mapped.retryAfterSeconds !== undefined
      ? { "Retry-After": String(mapped.retryAfterSeconds) }
      : undefined;
  return NextResponse.json(mapped.body, { status: mapped.status, headers });
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const { supabase, user } = auth;
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name,avatar_path,bio,username")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let avatarUrl: string | null = null;
  if (data?.avatar_path) {
    const signed = await supabase.storage.from("doc2quiz").createSignedUrl(data.avatar_path, 60 * 60);
    if (!signed.error) avatarUrl = signed.data.signedUrl;
  }

  const { data: sets, error: setsError } = await supabase
    .from("study_sets")
    .select("id,title,content_kind,pipeline_stage,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (setsError) return NextResponse.json({ error: setsError.message }, { status: 500 });

  const studySets = sets ?? [];
  return NextResponse.json({
    data: {
      displayName: data?.display_name || fallbackName(user.email),
      bio: data?.bio || "",
      username: data?.username ?? null,
      avatarUrl,
      avatarPath: data?.avatar_path || null,
      profileExists: Boolean(data),
      stats: {
        total: studySets.length,
        quiz: studySets.filter((set) => set.content_kind === "quiz").length,
        flashcards: studySets.filter((set) => set.content_kind === "flashcards").length,
        ready: studySets.filter((set) => set.pipeline_stage === "quiz" || set.pipeline_stage === "flashcards").length,
      },
      studySets,
    },
  });
}

export async function PATCH(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: {
    displayName?: unknown;
    bio?: unknown;
    avatarPath?: unknown;
    username?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.username !== undefined) {
    const usernameError = validateUsername(body.username);
    if (usernameError) {
      return NextResponse.json({ error: usernameError }, { status: 400 });
    }

    try {
      const usernameResult = await setProfileUsername(auth.supabase, String(body.username));
      if (
        body.displayName === undefined &&
        body.bio === undefined &&
        body.avatarPath === undefined
      ) {
        return NextResponse.json({ data: { username: usernameResult.username } });
      }
    } catch (error) {
      const mapped = mapSocialError(error);
      if (mapped) return mapped;
      console.error("profile username route error");
      return NextResponse.json({ error: "internal_error" }, { status: 500 });
    }
  }

  if (body.displayName === undefined && body.bio === undefined && body.avatarPath === undefined) {
    return NextResponse.json({ error: "No profile fields to update" }, { status: 400 });
  }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : body.displayName;
  const bio = typeof body.bio === "string" ? body.bio.trim() : body.bio;
  const textError = validateProfileText(displayName, bio);
  if (textError) return NextResponse.json({ error: textError }, { status: 400 });
  if (
    body.avatarPath !== undefined &&
    (typeof body.avatarPath !== "string" || !body.avatarPath.startsWith(`${auth.user.id}/profile/avatar.`))
  ) {
    return NextResponse.json({ error: "Invalid avatar path" }, { status: 400 });
  }

  const patch: Record<string, string | null> = { id: auth.user.id };
  if (body.displayName !== undefined) patch.display_name = (displayName as string) || null;
  if (body.bio !== undefined) patch.bio = (bio as string) || null;
  if (body.avatarPath !== undefined) patch.avatar_path = body.avatarPath as string | null;

  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert(patch)
    .select("display_name,bio,avatar_path,username")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export const runtime = "nodejs";
