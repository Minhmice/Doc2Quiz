import { notFound } from "next/navigation";

export default function DevOcrLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_DEV_OCR_LAB !== "true"
  ) {
    notFound();
  }
  return children;
}
