import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doc2Quiz",
  description: "Turn study PDFs into practice quizzes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#faf8f5] text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
