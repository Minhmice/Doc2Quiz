import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "./server";

export async function requireUser() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const h = await headers();
    const path = h.get("x-next-pathname");
    const next =
      path && path.startsWith("/") && !path.startsWith("//")
        ? `?next=${encodeURIComponent(path)}`
        : "";
    redirect(`/login${next}`);
  }

  return user;
}
