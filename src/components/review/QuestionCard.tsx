"use client";

import type { Question } from "@/types/question";
import { formatParseConfidence } from "@/lib/review/formatParseConfidence";
import { MathText } from "@/components/math/MathText";
import { McqOptionsPreview } from "@/components/review/McqOptionsPreview";
import { QuestionEditor } from "@/components/review/QuestionEditor";
import { StoredImage } from "@/components/media/StoredImage";
import { Button } from "@/components/buttons/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
export type QuestionCardProps = {
  studySetId: string;
  question: Question;
  index: number;
  isEditing: boolean;
  onToggleEdit: () => void;
  onSave: (q: Question) => void;
  onCancel: () => void;
  onDelete: () => void;
  onSetCorrectIndex?: (index: 0 | 1 | 2 | 3) => void;
};

export function QuestionCard({
  studySetId,
  question,
  index,
  isEditing,
  onToggleEdit,
  onSave,
  onCancel,
  onDelete,
  onSetCorrectIndex,
}: QuestionCardProps) {
  const confidenceLine = formatParseConfidence(question.parseConfidence);
  const pageMeta =
    question.sourcePageIndex !== undefined && question.sourcePageIndex >= 1
      ? `Page ${question.sourcePageIndex}`
      : null;

  return (
    <Card
      id={`review-q-${question.id}`}
      className="scroll-mt-24 overflow-hidden shadow-md"
    >
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="font-heading text-sm font-bold text-primary">
              #{String(index).padStart(2, "0")}
            </h3>
            {pageMeta ? (
              <span className="font-label text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {pageMeta}
              </span>
            ) : null}
          </div>
          {confidenceLine ? (
            <p className="text-xs font-medium text-muted-foreground">
              {confidenceLine}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {!isEditing ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto px-0 text-primary"
              onClick={onToggleEdit}
            >
              Edit
            </Button>
          ) : null}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-destructive"
            onClick={onDelete}
          >
            Remove
          </Button>
        </div>
      </CardHeader>

      {isEditing ? (
        <CardContent className="pt-0">
          <QuestionEditor
            studySetId={studySetId}
            question={question}
            onSave={onSave}
            onCancel={onCancel}
          />
        </CardContent>
      ) : (
        <CardContent className="space-y-3 pt-0 text-sm text-card-foreground">
          <MathText
            source={question.question}
            className="block text-sm leading-snug text-card-foreground"
          />
          {question.questionImageId ? (
            <StoredImage
              mediaId={question.questionImageId}
              alt=""
            />
          ) : null}
          <McqOptionsPreview
            question={question}
            onSetCorrectIndex={onSetCorrectIndex}
            renderAfterOption={(i) => {
              const oid = question.optionImageIds?.[i];
              return oid ? <StoredImage mediaId={oid} alt="" /> : null;
            }}
          />
        </CardContent>
      )}
    </Card>
  );
}
