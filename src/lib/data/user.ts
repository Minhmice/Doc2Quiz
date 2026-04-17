"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export async function requireBrowserUserId(): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  const userId = data.user?.id;
  if (!userId) {
    throw new Error("Not authenticated.");
  }
  return userId;
}

