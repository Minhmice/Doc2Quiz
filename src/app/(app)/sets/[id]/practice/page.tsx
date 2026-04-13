import { redirect } from "next/navigation";
import { quizPlay } from "@/lib/routes/studySetPaths";

export default async function StudySetPracticeRedirectPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  redirect(quizPlay(id));
}
