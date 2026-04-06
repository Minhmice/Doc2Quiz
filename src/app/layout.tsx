import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans, Syne, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { AppRootProviders } from "@/components/providers/app-root-providers";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
});

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "Doc2Quiz",
  description: "Turn study PDFs into local quiz banks you can review and finish",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          dmSans.variable,
          syne.variable,
          geist.variable,
          dmSans.className,
          "min-h-screen bg-background text-foreground",
        )}
      >
        <AppRootProviders>{children}</AppRootProviders>
      </body>
    </html>
  );
}
