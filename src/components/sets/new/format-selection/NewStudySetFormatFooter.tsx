export type NewStudySetFormatFooterProps = Readonly<{
  label?: string;
}>;

const DEFAULT_LABEL = "Precision Learning Engine v2.1";

export function NewStudySetFormatFooter({
  label = DEFAULT_LABEL,
}: NewStudySetFormatFooterProps) {
  return (
    <footer className="mt-12 flex items-center justify-between border-t border-border/10 pt-8">
      <div className="font-label text-[10px] uppercase tracking-[0.2em] text-border">
        {label}
      </div>
      <div className="flex gap-4" aria-hidden>
        <div className="size-2 rounded-full bg-chart-2" />
        <div className="size-2 rounded-full bg-border" />
        <div className="size-2 rounded-full bg-border" />
      </div>
    </footer>
  );
}
