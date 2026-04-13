import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, LayoutDashboard, Library, Plus, Settings } from "lucide-react";
import { newRoot } from "@/lib/routes/studySetPaths";
import { cn } from "@/lib/utils";

export type DashboardMobileBottomNavProps = Readonly<{
  className?: string;
}>;

export function DashboardMobileBottomNav({
  className,
}: DashboardMobileBottomNavProps) {
  const pathname = usePathname() ?? "";

  const dashActive = pathname === "/dashboard";
  const libActive = pathname === "/dashboard"; /* hash not in pathname — subtle */

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 flex h-16 items-center justify-around border-t border-border/30 bg-card/95 shadow-[0_-4px_20px_rgba(0,0,0,0.04)] backdrop-blur-md md:hidden dark:bg-card/95",
        className,
      )}
      aria-label="Mobile primary"
    >
      <Link
        href="/dashboard"
        className={cn(
          "flex cursor-pointer flex-col items-center gap-0.5 font-label text-[10px] font-bold uppercase transition-colors",
          dashActive ? "text-[color:var(--d2q-accent)]" : "text-[color:var(--d2q-blue)]",
        )}
      >
        <LayoutDashboard className="size-6" aria-hidden />
        Dash
      </Link>
      <Link
        href="/dashboard#library"
        className={cn(
          "flex cursor-pointer flex-col items-center gap-0.5 font-label text-[10px] uppercase transition-colors",
          libActive ? "text-[color:var(--d2q-blue)]" : "text-muted-foreground",
        )}
      >
        <Library className="size-6" aria-hidden />
        Library
      </Link>
      <Link
        href={newRoot()}
        className="-mt-10 flex size-12 cursor-pointer items-center justify-center rounded-full bg-[color:var(--d2q-accent)] text-primary-foreground shadow-lg transition-transform active:scale-95 dark:text-primary-foreground"
        aria-label="Create new study set"
      >
        <Plus className="size-6" aria-hidden />
      </Link>
      <Link
        href="/dashboard#stats"
        className="flex cursor-pointer flex-col items-center gap-0.5 font-label text-[10px] uppercase text-[color:var(--d2q-blue)] transition-colors"
      >
        <BarChart3 className="size-6" aria-hidden />
        Stats
      </Link>
      <Link
        href="/settings"
        className="flex cursor-pointer flex-col items-center gap-0.5 font-label text-[10px] uppercase text-[color:var(--d2q-blue)] transition-colors"
      >
        <Settings className="size-6" aria-hidden />
        Set
      </Link>
    </nav>
  );
}
