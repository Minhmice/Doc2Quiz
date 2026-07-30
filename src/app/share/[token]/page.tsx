import { cookies } from "next/headers";

import { PublicShareStudy, PublicShareUnavailable } from "@/components/shares/PublicShareStudy";
import { LocaleProvider } from "@/components/locale/LocaleProvider";
import { isLocale, LOCALE_COOKIE_KEY } from "@/lib/locale/localeStorage";
import { DEFAULT_LOCALE } from "@/lib/locale/messages";
import { PublicShareError, resolvePublicShare } from "@/lib/server/shares/publicShare";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export default async function PublicSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get(LOCALE_COOKIE_KEY)?.value;
  const initialLocale = isLocale(localeCookie) ? localeCookie : DEFAULT_LOCALE;

  let content;
  try {
    const share = await resolvePublicShare(createSupabaseAdminClient(), token);
    content = <PublicShareStudy share={share} />;
  } catch (error) {
    if (error instanceof PublicShareError) {
      content = <PublicShareUnavailable />;
    } else {
      throw error;
    }
  }

  return (
    <div className="min-h-dvh overflow-y-auto bg-background text-foreground">
      <LocaleProvider initialLocale={initialLocale}>{content}</LocaleProvider>
    </div>
  );
}
