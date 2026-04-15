import { buttonVariants } from "@/components/buttons/button";
import { cn } from "@/lib/utils";

/** Top bar: global “new set” — compact primary (same shell as shadcn `Button`). */
export const topBarCreateSetLinkClassName = cn(
  buttonVariants({ variant: "default", size: "default" }),
  "inline-flex h-9 shrink-0 cursor-pointer items-center px-3 font-label text-[10px] font-bold uppercase tracking-widest shadow-sm sm:px-4 sm:text-xs",
);

const heroTall = "h-auto min-h-11 shrink-0 px-6 py-3 sm:min-h-12";

/** Hero: primary accent actions (resume, etc.). */
export const dashboardHeroAccentPrimaryLinkClassName = cn(
  buttonVariants({ variant: "default", size: "lg" }),
  heroTall,
  "cursor-pointer border-transparent bg-[color:var(--d2q-accent)] font-label text-xs font-bold uppercase tracking-widest text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground dark:text-primary-foreground",
);

/** Hero: zero-state primary — same base as accent primary, sentence case. */
export const dashboardHeroFirstSetLinkClassName = cn(
  buttonVariants({ variant: "default", size: "lg" }),
  heroTall,
  "cursor-pointer border-transparent bg-[color:var(--d2q-accent)] text-sm font-semibold tracking-tight text-primary-foreground shadow-md hover:bg-primary hover:text-primary-foreground normal-case dark:text-primary-foreground",
);

/** Hero: secondary accent (e.g. open editor). */
export const dashboardHeroBluePrimaryLinkClassName = cn(
  buttonVariants({ variant: "default", size: "lg" }),
  heroTall,
  "cursor-pointer border-transparent bg-[color:var(--d2q-blue)] font-label text-xs font-bold uppercase tracking-widest text-white shadow-md hover:bg-accent-foreground",
);

/** Hero: secondary “Create new set” when library non-empty. */
export const dashboardHeroOutlineCreateLinkClassName = cn(
  buttonVariants({ variant: "outline", size: "lg" }),
  heroTall,
  "cursor-pointer border-2 border-accent-foreground bg-transparent font-label text-xs font-bold uppercase tracking-widest text-accent-foreground hover:bg-accent-foreground hover:text-background",
);
