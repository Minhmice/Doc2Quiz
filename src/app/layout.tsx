import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppRootProviders } from "@/components/providers/app-root-providers";

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
  description: "Turn study PDFs into local study sets you can review and finish",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="h-dvh overflow-hidden">
      <body
        className={cn(
          manrope.variable,
          spaceGrotesk.variable,
          manrope.className,
          "h-dvh min-h-0 overflow-hidden bg-background text-foreground",
        )}
      >
        <AppRootProviders>{children}</AppRootProviders>
      </body>
    </html>
  );
}
