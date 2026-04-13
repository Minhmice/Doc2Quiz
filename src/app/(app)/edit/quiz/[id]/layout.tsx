import { StudySetFlowPageShell } from "@/components/layout/StudySetFlowPageShell";

export default async function EditQuizLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return <StudySetFlowPageShell studySetId={id}>{children}</StudySetFlowPageShell>;
}
