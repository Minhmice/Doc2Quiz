/**
 * Shown while the heavy PDF import + parse client bundle loads (next/dynamic).
 */
export function ImportFlowSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
      aria-busy="true"
      aria-label="Loading import tools"
    >
      <div className="space-y-4 rounded-xl border border-border bg-card p-8">
        <div className="h-8 w-2/3 max-w-md animate-pulse rounded bg-muted" />
        <div className="h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
        <div className="mt-8 h-44 animate-pulse rounded-lg bg-muted/60" />
        <div className="flex gap-3 pt-2">
          <div className="h-10 w-36 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-28 animate-pulse rounded-md bg-muted/70" />
        </div>
      </div>
    </div>
  );
}
