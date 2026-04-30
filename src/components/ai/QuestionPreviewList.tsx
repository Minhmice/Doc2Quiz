import type { Question } from "@/types/question";
import { MappingQualityBadge } from "@/components/review/MappingQualityBadge";
import { MathText } from "@/components/math/MathText";
import { McqOptionsPreview } from "@/components/review/McqOptionsPreview";
import { StoredImage } from "@/components/media/StoredImage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportMcqCardShell } from "@/components/edit/new/import/ImportMcqCardShell";
import { cn } from "@/lib/utils";

export type QuestionPreviewCardProps = Readonly<{
  question: Question;
  index: number;
  onSetCorrectIndex?: (questionId: string, index: 0 | 1 | 2 | 3) => void;
  /** Extra classes on the outer Card (e.g. import stream accent). */
  cardClassName?: string;
  /** Applies the import shell (review-like header + accent) when true. */
  variant?: "default" | "import";
}>;

export function QuestionPreviewCard({
  question: q,
  index: i,
  onSetCorrectIndex,
  cardClassName,
  variant = "default",
}: QuestionPreviewCardProps) {
  const label = `Item: ${q.question.slice(0, 80)}${q.question.length > 80 ? "…" : ""}`;

  if (variant === "import") {
    const displayIndex = i + 1;
    const pageMeta =
      q.sourcePageIndex !== undefined && q.sourcePageIndex >= 1
        ? `Page ${q.sourcePageIndex}`
        : null;

    return (
      <ImportMcqCardShell
        id={`review-q-${q.id}`}
        aria-label={label}
        headerLeft={
          <>
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="font-heading text-sm font-bold text-primary">
                #{String(displayIndex).padStart(2, "0")}
              </h3>
              {pageMeta ? (
                <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {pageMeta}
                </span>
              ) : null}
            </div>
          </>
        }
        headerRight={
          <>
            <span className="inline-flex h-auto items-center px-0 text-sm font-medium text-primary opacity-80 select-none">
              Edit
            </span>
            <span className="inline-flex h-auto items-center px-0 text-sm font-medium text-destructive opacity-80 select-none">
              Remove
            </span>
          </>
        }
        className={cardClassName}
      >
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Imported
          </Badge>
          <MappingQualityBadge question={q} />
        </div>
        <MathText
          source={q.question}
          className="block text-sm leading-snug text-card-foreground"
        />
        {q.questionImageId ? (
          <StoredImage mediaId={q.questionImageId} alt="" />
        ) : null}
        <McqOptionsPreview
          question={q}
          onSetCorrectIndex={
            onSetCorrectIndex
              ? (idx) => onSetCorrectIndex(q.id, idx)
              : undefined
          }
          renderAfterOption={(idx) => {
            const oid = q.optionImageIds?.[idx];
            return oid ? <StoredImage mediaId={oid} alt="" /> : null;
          }}
          listClassName="list-none space-y-2 p-0"
        />
      </ImportMcqCardShell>
    );
  }

  return (
    <Card className={cn("shadow-md", cardClassName)} aria-label={label}>
      <CardContent className="space-y-2 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="text-xs">
            Item {i + 1}
          </Badge>
          <MappingQualityBadge question={q} />
        </div>
        <MathText
          source={q.question}
          className="text-sm font-medium text-card-foreground"
        />
        {q.questionImageId ? (
          <StoredImage mediaId={q.questionImageId} alt="" />
        ) : null}
        <McqOptionsPreview
          question={q}
          onSetCorrectIndex={
            onSetCorrectIndex
              ? (idx) => onSetCorrectIndex(q.id, idx)
              : undefined
          }
          renderAfterOption={(idx) => {
            const oid = q.optionImageIds?.[idx];
            return oid ? <StoredImage mediaId={oid} alt="" /> : null;
          }}
          listClassName="mt-3 list-none space-y-2 p-0"
        />
      </CardContent>
    </Card>
  );
}

export type QuestionPreviewListProps = Readonly<{
  questions: Question[];
  onSetCorrectIndex?: (questionId: string, index: 0 | 1 | 2 | 3) => void;
  cardClassName?: string;
  variant?: "default" | "import";
}>;

export function QuestionPreviewList({
  questions,
  onSetCorrectIndex,
  cardClassName,
  variant = "default",
}: QuestionPreviewListProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <ul className="mt-4 space-y-3" aria-label="Parsed items preview">
      {questions.map((q, i) => (
        <li key={q.id}>
          <QuestionPreviewCard
            question={q}
            index={i}
            onSetCorrectIndex={onSetCorrectIndex}
            cardClassName={cardClassName}
            variant={variant}
          />
        </li>
      ))}
    </ul>
  );
}
