import { StepProgressBar } from "@/components/layout/StepProgressBar";

export default async function StudySetLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:max-w-6xl">
      <StepProgressBar studySetId={id} />
      {children}
    </div>
  );
}
