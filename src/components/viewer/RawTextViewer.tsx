type RawTextViewerProps = {
  text: string | null;
  pageCount: number | null;
};

export function RawTextViewer({ text, pageCount }: RawTextViewerProps) {
  if (text === null) {
    return (
      <section
        className="mt-8 flex min-h-0 flex-1 flex-col rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
        aria-label="Extracted text"
      >
        <p className="text-sm text-neutral-500">
          Extracted text will appear here after you upload a PDF.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mt-8 flex min-h-0 max-h-[min(70vh,calc(100vh-20rem))] flex-col rounded-lg border border-neutral-200 bg-white shadow-sm"
      aria-label="Extracted text"
    >
      {pageCount !== null && pageCount > 0 ? (
        <div className="shrink-0 border-b border-neutral-100 px-4 py-2 text-sm text-neutral-600">
          {pageCount} {pageCount === 1 ? "page" : "pages"}
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <pre className="break-words font-mono text-sm leading-relaxed whitespace-pre-wrap text-neutral-800">
          {text}
        </pre>
      </div>
    </section>
  );
}
