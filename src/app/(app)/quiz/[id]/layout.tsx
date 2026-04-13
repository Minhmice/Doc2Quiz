import { StudySetFlowPageShell } from "@/components/layout/StudySetFlowPageShell";

export default async function QuizStudySetLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return (
    <StudySetFlowPageShell studySetId={id} variant="flush">
      {children}
    </StudySetFlowPageShell>
  );
}
