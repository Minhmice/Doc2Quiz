import { redirect } from "next/navigation";

export default async function StudySetPracticeRedirectPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  redirect(`/sets/${id}/play`);
}
