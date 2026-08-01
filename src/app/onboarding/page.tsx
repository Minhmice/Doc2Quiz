import { requireUser } from "@/lib/supabase/auth-guard";
import { OnboardingClient } from "./OnboardingClient";

export default async function OnboardingPage() {
  await requireUser();
  return <OnboardingClient />;
}
