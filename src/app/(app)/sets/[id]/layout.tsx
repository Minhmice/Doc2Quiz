import { SetSubNav } from "@/components/layout/SetSubNav";

export default async function StudySetLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}>) {
  const { id } = await params;
  return (
    <div>
      <SetSubNav studySetId={id} />
      {children}
    </div>
  );
}
