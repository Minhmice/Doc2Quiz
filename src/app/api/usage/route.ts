import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/api/requireApiUser";
import { getUserUsage } from "@/lib/server/quota/getUserUsage";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const studySetId = new URL(request.url).searchParams.get("studySetId") ?? undefined;

  try {
    return NextResponse.json(await getUserUsage({ ...auth, studySetId }));
  } catch (error) {
    console.error("usage route error", error);
    return NextResponse.json({ error: "internal_error", message: "Unable to load usage." }, { status: 500 });
  }
}
