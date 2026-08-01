import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api/requireApiUser";
import { isOwnProfileAvatarPath, validateProfileText } from "@/lib/profile/profileValidation";
import { validateUsername } from "@/lib/profile/usernameValidation";
import { isThemePreference, themePreferenceOrDefault } from "@/lib/profile/themePreference";
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
    .select("display_name,avatar_path,bio,username,onboarding_version,onboarding_completed_at,coach_mode,study_identity,commitment,preferred_study_time,theme_preference")
    .eq("id", user.id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let avatarUrl: string | null = null;
  let avatarStatus: "available" | "avatar_unavailable" | null = null;
  if (data?.avatar_path) {
    const signed = await supabase.storage.from("doc2quiz").createSignedUrl(data.avatar_path, 60 * 60);
    if (signed.error || !signed.data?.signedUrl) avatarStatus = "avatar_unavailable";
    else {
      avatarUrl = signed.data.signedUrl;
      avatarStatus = "available";
    }
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
      avatarStatus,
      themePreference: themePreferenceOrDefault(data?.theme_preference),
      onboarding: {
        version: data?.onboarding_version ?? null,
        completedAt: data?.onboarding_completed_at ?? null,
        coachMode: data?.coach_mode ?? null,
        studyIdentity: data?.study_identity ?? null,
        commitment: data?.commitment ?? null,
        preferredStudyTime: data?.preferred_study_time ?? null,
      },
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
    onboardingVersion?: unknown;
    onboardingCompleted?: unknown;
    coachMode?: unknown;
    studyIdentity?: unknown;
    commitment?: unknown;
    preferredStudyTime?: unknown;
    themePreference?: unknown;
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
        body.avatarPath === undefined &&
        body.themePreference === undefined
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

  const onboardingKeys = ["onboardingVersion", "onboardingCompleted", "coachMode", "studyIdentity", "commitment", "preferredStudyTime"] as const;
  const hasOnboarding = onboardingKeys.some((key) => body[key] !== undefined);
  if (body.displayName === undefined && body.bio === undefined && body.avatarPath === undefined && body.themePreference === undefined && !hasOnboarding) {
    return NextResponse.json({ error: "No profile fields to update" }, { status: 400 });
  }
  if (body.themePreference !== undefined && !isThemePreference(body.themePreference)) return NextResponse.json({ error: "Invalid theme preference" }, { status: 400 });
  if (body.coachMode !== undefined && !["aggressive", "balanced", "chill"].includes(String(body.coachMode))) return NextResponse.json({ error: "Invalid coach mode" }, { status: 400 });
  if (body.studyIdentity !== undefined && !["exams", "university", "certifications", "work_skills", "personal_learning", "unknown"].includes(String(body.studyIdentity))) return NextResponse.json({ error: "Invalid study identity" }, { status: 400 });
  if (body.commitment !== undefined && !["casual", "serious", "locked_in"].includes(String(body.commitment))) return NextResponse.json({ error: "Invalid commitment" }, { status: 400 });
  if (body.preferredStudyTime !== undefined && !["morning", "afternoon", "evening", "flexible"].includes(String(body.preferredStudyTime))) return NextResponse.json({ error: "Invalid preferred study time" }, { status: 400 });
  for (const key of ["studyIdentity", "commitment"] as const) if (body[key] !== undefined && typeof body[key] !== "string") return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
  if (body.onboardingVersion !== undefined && body.onboardingVersion !== 1) return NextResponse.json({ error: "Invalid onboarding version" }, { status: 400 });
  if (body.onboardingCompleted !== undefined && typeof body.onboardingCompleted !== "boolean") return NextResponse.json({ error: "Invalid onboarding completion" }, { status: 400 });

  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : body.displayName;
  const bio = typeof body.bio === "string" ? body.bio.trim() : body.bio;
  const textError = validateProfileText(displayName, bio);
  if (textError) return NextResponse.json({ error: textError }, { status: 400 });
  if (body.avatarPath !== undefined && !isOwnProfileAvatarPath(body.avatarPath, auth.user.id)) {
    return NextResponse.json({ error: "Invalid avatar path" }, { status: 400 });
  }

  const patch: Record<string, string | number | null> = { id: auth.user.id };
  if (body.displayName !== undefined) patch.display_name = (displayName as string) || null;
  if (body.bio !== undefined) patch.bio = (bio as string) || null;
  if (body.avatarPath !== undefined) patch.avatar_path = body.avatarPath as string | null;
  if (body.onboardingVersion !== undefined) patch.onboarding_version = body.onboardingVersion as number;
  if (body.onboardingCompleted !== undefined) patch.onboarding_completed_at = body.onboardingCompleted ? new Date().toISOString() : null;
  if (body.coachMode !== undefined) patch.coach_mode = String(body.coachMode);
  if (body.studyIdentity !== undefined) patch.study_identity = String(body.studyIdentity).trim() || null;
  if (body.commitment !== undefined) patch.commitment = String(body.commitment).trim() || null;
  if (body.preferredStudyTime !== undefined) patch.preferred_study_time = String(body.preferredStudyTime);
  if (body.themePreference !== undefined) patch.theme_preference = body.themePreference;

  const { data, error } = await auth.supabase
    .from("profiles")
    .upsert(patch)
    .select("display_name,bio,avatar_path,username,onboarding_version,onboarding_completed_at,coach_mode,study_identity,commitment,preferred_study_time,theme_preference")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export const runtime = "nodejs";
