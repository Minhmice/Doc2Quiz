import type { Question } from "@/types/question";
import { McqOptionsPreview } from "@/components/review/McqOptionsPreview";
import { StoredImage } from "@/components/media/StoredImage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type QuestionPreviewListProps = {
  questions: Question[];
  onSetCorrectIndex?: (questionId: string, index: 0 | 1 | 2 | 3) => void;
};

export function QuestionPreviewList({
  questions,
  onSetCorrectIndex,
}: QuestionPreviewListProps) {
  if (questions.length === 0) {
    return null;
  }

  return (
    <ul className="mt-4 space-y-3" aria-label="Parsed questions preview">
      {questions.map((q, i) => (
        <li key={q.id}>
          <Card
            className="shadow-md"
            aria-label={`Question: ${q.question.slice(0, 80)}${q.question.length > 80 ? "…" : ""}`}
          >
            <CardContent className="space-y-2 pt-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Draft {i + 1}
                </Badge>
              </div>
              <p className="text-sm font-medium text-card-foreground">
                {q.question}
              </p>
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
                renderAfterOption={(i) => {
                  const oid = q.optionImageIds?.[i];
                  return oid ? <StoredImage mediaId={oid} alt="" /> : null;
                }}
                listClassName="mt-3 list-none space-y-2 p-0"
              />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
