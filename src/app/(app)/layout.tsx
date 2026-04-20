import { AppProviders } from "@/components/layout/AppProviders";
import { requireUser } from "@/lib/supabase/auth-guard";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireUser();
  return <AppProviders>{children}</AppProviders>;
}
