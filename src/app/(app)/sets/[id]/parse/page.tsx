import { redirect } from "next/navigation";

export default async function StudySetParseRedirectPage({
  params,
}: Readonly<{
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  redirect(`/sets/${id}/source`);
}
