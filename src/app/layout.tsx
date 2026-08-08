import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import { ThemeProvider } from "@teispace/next-themes";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppRootProviders } from "@/components/providers/app-root-providers";
import { chunkLoadRecoveryScript } from "@/lib/dev/chunkLoadRecoveryScript";
import {
  DEFAULT_THEME_PREFERENCE,
  themePreferenceOrDefault,
  type ThemePreference,
} from "@/lib/profile/themePreference";
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

const DARK_THEME_PREFERENCES: ThemePreference[] = ["vscode-dark", "monokai", "high-contrast"];
const THEME_STORAGE_KEY = "doc2quiz-theme-preference";

async function getInitialThemePreference() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { preference: DEFAULT_THEME_PREFERENCE, authenticated: false };

  const { data } = await supabase
    .from("profiles")
    .select("theme_preference")
    .eq("id", user.id)
    .maybeSingle();
  return { preference: themePreferenceOrDefault(data?.theme_preference), authenticated: true };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const { preference: initialThemePreference, authenticated } = await getInitialThemePreference();
  const themeScript = `!function(){var p=${JSON.stringify(initialThemePreference)},a=${authenticated},k=${JSON.stringify(THEME_STORAGE_KEY)},v=["system","vscode-dark","vscode-light","monokai","high-contrast"];try{if(!a){var s=localStorage.getItem(k);if(v.includes(s))p=s}var t=p==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"vscode-dark":"vscode-light"):p,r=document.documentElement;r.dataset.theme=t;r.classList.toggle("dark",t!=="vscode-light")}catch(e){}}()`;

  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-theme={initialThemePreference === "system" ? undefined : initialThemePreference}
      className={cn("min-h-dvh", DARK_THEME_PREFERENCES.includes(initialThemePreference) && "dark")}
    >
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body
        className={cn(
          manrope.variable,
          spaceGrotesk.variable,
          manrope.className,
          "min-h-dvh bg-background text-foreground",
        )}
      >
        {process.env.NODE_ENV === "development" ? (
          <script
            dangerouslySetInnerHTML={{ __html: chunkLoadRecoveryScript }}
          />
        ) : null}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
          initialTheme={initialThemePreference === "system" ? "system" : initialThemePreference === "vscode-light" ? "light" : "dark"}
          noScript
          storage="none"
        >
          <AppRootProviders initialThemePreference={authenticated ? initialThemePreference : undefined}>{children}</AppRootProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
