import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@teispace/next-themes";
import { getTheme } from "@teispace/next-themes/server";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppRootProviders } from "@/components/providers/app-root-providers";
import { chunkLoadRecoveryScript } from "@/lib/dev/chunkLoadRecoveryScript";
import { themePreferenceOrDefault } from "@/lib/profile/themePreference";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Mint / blueprint typography — aligned with `example/` mocks */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-label",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Doc2Quiz",
  description: "Turn study notes into local quiz sets you can review and finish",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const initialTheme = await getTheme();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("theme_preference").eq("id", user.id).maybeSingle()
    : { data: null };
  const initialThemePreference = themePreferenceOrDefault(profile?.theme_preference);

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={initialThemePreference === "system" ? undefined : initialThemePreference}
      className={cn("h-dvh overflow-hidden", initialThemePreference !== "system" && initialThemePreference !== "vscode-light" && "dark")}
    >
      <body
        className={cn(
          manrope.variable,
          spaceGrotesk.variable,
          manrope.className,
          "h-dvh min-h-0 overflow-hidden bg-background text-foreground",
        )}
      >
        {process.env.NODE_ENV === "development" ? (
          <script
            dangerouslySetInnerHTML={{ __html: chunkLoadRecoveryScript }}
          />
        ) : null}
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          initialTheme={initialTheme ?? undefined}
        >
          <AppRootProviders initialThemePreference={initialThemePreference}>{children}</AppRootProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
