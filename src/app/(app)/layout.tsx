import { redirect } from "next/navigation";
import { AppProviders } from "@/components/layout/AppProviders";
import { requireUser } from "@/lib/supabase/auth-guard";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await requireUser();
  const supabase = await createSupabaseServerClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  return <AppProviders>{children}</AppProviders>;
}
