import { PageTransition } from "@/components/layout/PageTransition";

export default function AppSegmentTemplate({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PageTransition>{children}</PageTransition>;
}
