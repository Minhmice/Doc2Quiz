import Link from "next/link";
import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent } from "react";
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
import { useLocale } from "@/components/locale/LocaleProvider";
import { LocalizedSlangLine } from "@/components/locale/LocalizedCopy";
import { cn } from "@/lib/utils";
import {
  playHref,
  openEditorHref,
  reviewMistakesHref,
} from "@/lib/dashboard/studySetDashboardLinks";
import { quizReview } from "@/lib/routes/studySetPaths";
import type { StudySetMeta } from "@/types/studySet";

export type DashboardStudySetCardVariant = "needs_edit" | "ready" | "in_progress";

export type DashboardStudySetCardProps = Readonly<{
  meta: StudySetMeta;
  editorStagingCount: number;
  approvedCount: number;
  hasMistakes: boolean;
  variant: DashboardStudySetCardVariant;
  updatedLabel: string;
  onRename: () => void;
  onDelete: () => void;
}>;

function KindIcon({ meta }: Readonly<{ meta: StudySetMeta }>) {
  if (meta.contentKind === "flashcards") {
    return <Sparkles className="size-4 shrink-0 text-[color:var(--d2q-blue)]" aria-hidden />;
  }
  if (meta.contentKind === "quiz") {
    return <FileText className="size-4 shrink-0 text-[color:var(--d2q-blue)]" aria-hidden />;
  }
  return <School className="size-4 shrink-0 text-[color:var(--d2q-blue)]" aria-hidden />;
}

function statusClassName(variant: DashboardStudySetCardVariant): string {
  if (variant === "needs_edit") return "bg-[color:var(--chart-4)] text-white";
  if (variant === "ready") return "bg-[color:var(--d2q-blue)] text-white";
  return "bg-[color:var(--d2q-accent)] text-primary-foreground";
}

function stopCardNavigation(event: MouseEvent | KeyboardEvent) {
  event.stopPropagation();
}

export function DashboardStudySetCard({
  meta,
  editorStagingCount,
  approvedCount,
  hasMistakes,
  variant,
  updatedLabel,
  onRename,
  onDelete,
}: DashboardStudySetCardProps) {
  const router = useRouter();
  const { locale, messages } = useLocale();
  const copy = messages.dashboard;
  const total = editorStagingCount + approvedCount;
  const pctComplete =
    total > 0 ? Math.round((approvedCount / total) * 100) : 0;
  const play = playHref(meta);
  const needsContinueSetup =
    approvedCount === 0 &&
    (meta.pipelineStage === "canonical" || meta.pipelineStage === "mode_selected");
  const review = needsContinueSetup
    ? quizReview(meta.id)
    : openEditorHref(meta);
  const reviewMenuLabel = needsContinueSetup
    ? copy.actions.continueSetup
    : copy.actions.review;
  const mistakesHref = reviewMistakesHref(meta);

  const primaryHref = variant === "needs_edit" ? review : play;
  const primaryLabel = variant === "needs_edit" ? copy.actions.openEditor
    : variant === "in_progress" ? copy.actions.resumePractice
    : meta.contentKind === "flashcards" ? copy.actions.startFlashcards : copy.actions.startQuiz;
  const formattedTotal = new Intl.NumberFormat(locale).format(total);
  const formattedPercent = new Intl.NumberFormat(locale).format(pctComplete);
  const kind = meta.contentKind === "flashcards" ? copy.kinds.flashcards : meta.contentKind === "quiz" ? copy.kinds.quiz : copy.kinds.studySet;
  const unitCount = meta.contentKind === "flashcards" ? copy.units.cards(formattedTotal) : copy.units.questions(formattedTotal);
  const showMistakeDrill =
    mistakesHref != null &&
    hasMistakes &&
    approvedCount > 0 &&
    meta.contentKind === "quiz";

  const borderHover =
    variant === "needs_edit"
      ? "hover:border-primary/50"
      : "hover:border-[color:var(--d2q-blue)]/50";

  const openPrimary = () => {
    router.push(primaryHref);
  };

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }
    event.preventDefault();
    openPrimary();
  };

  return (
    <article
      className={cn(
        "group flex h-full cursor-pointer flex-col rounded-lg border border-border/40 bg-card transition-colors duration-200",
        borderHover,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      )}
      tabIndex={0}
      role="group"
      aria-label={`${primaryLabel}: ${meta.title}`}
      onClick={openPrimary}
      onKeyDown={onCardKeyDown}
    >
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold leading-none",
              statusClassName(variant),
            )}
          >
            {copy.statuses[variant]}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">{updatedLabel}</span>
        </div>

        <div className="mb-2 flex min-w-0 items-center gap-1.5 text-xs font-medium text-[color:var(--d2q-blue)]">
          <KindIcon meta={meta} />
          <span>{kind}</span>
        </div>

        <h3
          className="mb-3 min-h-[2.5rem] line-clamp-2 text-balance text-lg font-bold leading-snug text-accent-foreground"
          title={meta.title}
        >
          {meta.title}
        </h3>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-medium text-muted-foreground">
          <span className="flex items-center gap-1">
            <Layers className="size-3.5 shrink-0" aria-hidden />
            {unitCount}
          </span>
          {variant === "ready" ? (
            <span className="flex items-center gap-1 text-[color:var(--d2q-blue)]">
              <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
              {copy.readyPractice}
            </span>
          ) : variant === "in_progress" ? (
            <span className="flex items-center gap-1 text-primary">
              <TrendingUp className="size-3.5 shrink-0" aria-hidden />
              {copy.percentDone(formattedPercent)}
            </span>
          ) : (
            <span className="flex items-center gap-1 text-primary">
              <TrendingUp className="size-3.5 shrink-0" aria-hidden />
              {copy.percentComplete(formattedPercent)}
            </span>
          )}
        </div>
        <LocalizedSlangLine context="badge" eventKey={`${meta.id}:${variant}`} className="mt-2 text-xs leading-relaxed text-muted-foreground" />

        <div
          className="mt-4 flex flex-col gap-2"
          onClick={stopCardNavigation}
          onKeyDown={stopCardNavigation}
        >
          <Link
            href={primaryHref}
            className={cn(
              "w-full rounded-md py-2.5 text-center text-xs font-semibold transition-colors duration-200",
              variant === "needs_edit"
                ? "bg-muted text-accent-foreground hover:bg-primary hover:text-primary-foreground"
                : "bg-[color:var(--d2q-blue)] text-white hover:bg-[color:var(--d2q-blue)]/85",
            )}
            onClick={stopCardNavigation}
          >
            {primaryLabel}
          </Link>
          <div className="flex min-h-11 flex-wrap items-center gap-2">
            {showMistakeDrill ? (
              <Link
                href={mistakesHref}
                className="inline-flex min-h-11 items-center text-xs font-medium text-[color:var(--d2q-blue)] underline-offset-2 hover:underline"
                onClick={stopCardNavigation}
              >
                {copy.actions.drillMistakes}
              </Link>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className={cn(
                  "ml-auto inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                )}
                aria-label={copy.actions.moreFor(meta.title)}
                onClick={stopCardNavigation}
              >
                <MoreHorizontal className="size-4" aria-hidden />
                <span className="sr-only">{copy.actions.more}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44">
                <DropdownMenuItem
                  className="cursor-pointer"
                  onClick={() => router.push(review)}
                >
                  {reviewMenuLabel}
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={onRename}>
                  {copy.actions.rename}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  className="cursor-pointer"
                  onClick={onDelete}
                >
                  {copy.actions.delete}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </article>
  );
}
