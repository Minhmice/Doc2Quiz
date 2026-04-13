import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  FileText,
  Layers,
  MoreHorizontal,
  School,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  playHref,
  reviewDraftHref,
  reviewMistakesHref,
} from "@/lib/dashboard/studySetDashboardLinks";
import { StudySetCardPdfCover } from "@/components/dashboard/StudySetCardPdfCover";
import type { StudySetMeta } from "@/types/studySet";

export type DashboardStudySetCardVariant = "draft" | "ready" | "in_progress";

export type DashboardStudySetCardProps = Readonly<{
  meta: StudySetMeta;
  draftCount: number;
  approvedCount: number;
  hasMistakes: boolean;
  variant: DashboardStudySetCardVariant;
  gradientClass: string;
  updatedLabel: string;
  onRename: () => void;
  onDelete: () => void;
}>;

function kindLabel(meta: StudySetMeta): string {
  if (meta.contentKind === "flashcards") {
    return "Flashcards";
  }
  if (meta.contentKind === "quiz") {
    return "Quiz set";
  }
  return "Study set";
}

function KindIcon({ meta }: Readonly<{ meta: StudySetMeta }>) {
  if (meta.contentKind === "flashcards") {
    return <Sparkles className="size-4 text-[color:var(--d2q-blue)]" aria-hidden />;
  }
  if (meta.contentKind === "quiz") {
    return <FileText className="size-4 text-[color:var(--d2q-blue)]" aria-hidden />;
  }
  return <School className="size-4 text-[color:var(--d2q-blue)]" aria-hidden />;
}

function statusBadge(variant: DashboardStudySetCardVariant): {
  label: string;
  className: string;
} {
  if (variant === "draft") {
    return {
      label: "Draft",
      className: "bg-[color:var(--chart-4)] text-white",
    };
  }
  if (variant === "ready") {
    return {
      label: "Ready",
      className: "bg-[color:var(--d2q-blue)] text-white",
    };
  }
  return {
    label: "In progress",
    className: "bg-[color:var(--d2q-accent)] text-primary-foreground",
  };
}

function unitLabel(meta: StudySetMeta): string {
  return meta.contentKind === "flashcards" ? "Cards" : "Qs";
}

export function DashboardStudySetCard({
  meta,
  draftCount,
  approvedCount,
  hasMistakes,
  variant,
  gradientClass,
  updatedLabel,
  onRename,
  onDelete,
}: DashboardStudySetCardProps) {
  const router = useRouter();
  const badge = statusBadge(variant);
  const total = draftCount + approvedCount;
  const pctComplete =
    total > 0 ? Math.round((approvedCount / total) * 100) : 0;
  const play = playHref(meta);
  const review = reviewDraftHref(meta);
  const mistakesHref = reviewMistakesHref(meta);

  const primaryHref = variant === "draft" ? review : play;
  const primaryLabel =
    variant === "draft"
      ? "Review draft"
      : variant === "ready"
        ? meta.contentKind === "flashcards"
          ? "Study flashcards"
          : "Take quiz"
        : "Resume";

  const borderHover =
    variant === "draft"
      ? "hover:border-primary/50"
      : "hover:border-[color:var(--d2q-blue)]/50";

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-border/30 bg-card shadow-sm transition-all duration-300",
        borderHover,
        "hover:shadow-md",
      )}
    >
      <div
        className={cn(
          "relative h-20 overflow-hidden rounded-t-lg bg-gradient-to-br",
          gradientClass,
        )}
      >
        <StudySetCardPdfCover
          studySetId={meta.id}
          className="pointer-events-none absolute inset-0"
        />
        <div className="absolute left-3 top-3 z-10">
          <span
            className={cn(
              "px-2 py-0.5 font-label text-[8px] font-bold uppercase tracking-widest",
              badge.className,
            )}
          >
            {badge.label}
          </span>
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <KindIcon meta={meta} />
            <span className="font-label text-[9px] font-bold uppercase tracking-widest text-[color:var(--d2q-blue)]">
              {kindLabel(meta)}
            </span>
          </div>
          <span className="shrink-0 font-label text-[9px] uppercase text-muted-foreground opacity-80">
            {updatedLabel}
          </span>
        </div>
        <h4 className="mb-2 line-clamp-2 text-lg font-bold leading-tight text-accent-foreground transition-colors duration-200 group-hover:text-primary">
          {meta.title}
        </h4>
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="size-3.5 shrink-0" aria-hidden />
            {total} {unitLabel(meta)}
          </span>
          {variant === "ready" ? (
            <span className="flex items-center gap-1 text-[color:var(--d2q-blue)]">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              Mastered
            </span>
          ) : variant === "in_progress" ? (
            <span className="flex items-center gap-1 text-primary">
              <TrendingUp className="size-3.5 shrink-0" aria-hidden />
              {pctComplete}% done
            </span>
          ) : (
            <span className="flex items-center gap-1 text-primary">
              <TrendingUp className="size-3.5 shrink-0" aria-hidden />
              {pctComplete}% complete
            </span>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2">
          <Link
            href={primaryHref}
            className={cn(
              "w-full cursor-pointer py-2.5 text-center font-label text-[10px] font-black uppercase tracking-widest transition-colors duration-200",
              variant === "draft"
                ? "bg-muted text-accent-foreground group-hover:bg-primary group-hover:text-primary-foreground"
                : "bg-[color:var(--d2q-blue)] text-white hover:bg-[color:var(--chart-4)]",
            )}
          >
            {primaryLabel}
          </Link>
          <div className="flex flex-wrap gap-2">
            {mistakesHref && hasMistakes && approvedCount > 0 ? (
              <Link
                href={mistakesHref}
                className="cursor-pointer text-center font-label text-[9px] font-bold uppercase tracking-wider text-[color:var(--d2q-blue)] underline-offset-2 hover:underline"
              >
                Review mistakes
              </Link>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="ml-auto inline-flex cursor-pointer items-center gap-1 rounded-sm px-1 font-label text-[9px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`More actions for ${meta.title}`}
              >
                <MoreHorizontal className="size-4" aria-hidden />
                More
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push(review)}
                >
                  Edit draft
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={onRename}>
                  Rename
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={onDelete}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </article>
  );
}
