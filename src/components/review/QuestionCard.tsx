"use client";

import type { Question } from "@/types/question";
import { MathText } from "@/components/math/MathText";
import { McqOptionsPreview } from "@/components/review/McqOptionsPreview";
import { QuestionEditor } from "@/components/review/QuestionEditor";
import { StoredImage } from "@/components/media/StoredImage";
import { Button } from "@/components/ui/button";
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
  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
        <h3 className="text-sm font-semibold text-card-foreground">{`Q${index}`}</h3>
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
        <CardContent className="space-y-2 pt-0 text-sm text-card-foreground">
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
