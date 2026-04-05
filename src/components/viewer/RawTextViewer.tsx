type RawTextViewerProps = {
  text: string | null;
  pageCount: number | null;
  /** True when PDF loaded but text layer is empty (likely scanned). */
  isScannedNoText?: boolean;
};

export function RawTextViewer({
  text,
  pageCount,
  isScannedNoText = false,
}: RawTextViewerProps) {
  if (text === null) {
    return (
      <section
        className="mt-8 flex min-h-0 flex-1 flex-col rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface)] p-6 shadow-md shadow-black/15"
        aria-label="Extracted text"
      >
        <p className="text-sm text-[var(--d2q-muted)]">
          Extracted text will appear here after you upload a PDF.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mt-8 flex min-h-0 max-h-[min(70vh,calc(100vh-20rem))] flex-col rounded-lg border border-[var(--d2q-border)] bg-[var(--d2q-surface)] shadow-md shadow-black/15"
      aria-label="Extracted text"
    >
      {pageCount !== null && pageCount > 0 ? (
        <div className="shrink-0 border-b border-[var(--d2q-border)] px-4 py-2 text-sm text-[var(--d2q-muted)]">
          {pageCount} {pageCount === 1 ? "page" : "pages"}
        </div>
      ) : null}
      {isScannedNoText ? (
        <div className="shrink-0 border-b border-orange-500/30 bg-orange-950/35 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium text-amber-200">No selectable text in this PDF</p>
          <p className="mt-1 text-amber-100/90">
            The file may be scanned or image-only. In the{" "}
            <strong className="font-semibold">AI question parsing</strong> section
            below, choose <strong className="font-semibold">OpenAI</strong> or{" "}
            <strong className="font-semibold">Custom</strong> (vision-capable model),
            then use <strong className="font-semibold">Parse with vision</strong> to
            read pages as images. Each page uses one API call (costs more tokens).
          </p>
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <pre className="break-words font-mono text-sm leading-relaxed whitespace-pre-wrap text-[var(--d2q-text)]">
          {text.trim().length > 0 ? text : "—"}
        </pre>
      </div>
    </section>
  );
}
