import Link from "next/link";

export type DashboardDraftBannerProps = Readonly<{
  title: string;
  draftCount: number;
  reviewHref: string;
}>;

export function DashboardDraftBanner({
  title,
  draftCount,
  reviewHref,
}: DashboardDraftBannerProps) {
  return (
    <section className="overflow-hidden rounded-lg bg-[color:var(--chart-4)] text-white dark:bg-card dark:text-card-foreground dark:ring-1 dark:ring-border">
      <div className="flex flex-col items-center justify-between gap-4 px-6 py-4 md:flex-row md:px-8">
        <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
          <div
            className="hidden h-8 w-1 shrink-0 bg-[color:var(--d2q-accent)] md:block"
            aria-hidden
          />
          <div>
            <div className="mb-0.5 flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span className="bg-[color:var(--d2q-accent)] px-1.5 py-0.5 font-label text-[8px] font-bold uppercase tracking-tighter text-primary-foreground">
                Action required
              </span>
              <h3 className="text-lg font-bold tracking-tight">{title}</h3>
            </div>
            <p className="text-xs text-white/85 dark:text-muted-foreground">
              {draftCount} draft {draftCount === 1 ? "card" : "cards"} waiting for
              manual review.
            </p>
          </div>
        </div>
        <Link
          href={reviewHref}
          className="w-full cursor-pointer bg-[color:var(--d2q-accent)] px-8 py-2.5 text-center font-label text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-lg transition-colors duration-200 hover:bg-primary hover:text-primary-foreground active:scale-[0.98] md:w-auto"
        >
          Review now
        </Link>
      </div>
    </section>
  );
}
