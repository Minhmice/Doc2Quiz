type StudySetFlowPageShellProps = Readonly<{
  studySetId: string;
  children: React.ReactNode;
  variant?: "default" | "flush";
}>;

export function StudySetFlowPageShell({
  studySetId,
  children,
  variant = "default",
}: StudySetFlowPageShellProps) {
  void studySetId;
  if (variant === "flush") {
    return <div className="w-full">{children}</div>;
  }
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 lg:max-w-6xl">
      {children}
    </div>
  );
}
