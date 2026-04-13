import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { Question } from "@/types/question";
import type { QuizVisionItem } from "@/types/visionParse";

export function quizVisionItemToQuestion(
  item: QuizVisionItem,
  defaultSourcePage?: number,
): Question {
  return {
    id: createRandomUuid(),
    question: item.question,
    options: item.options,
    correctIndex: item.correctIndex,
    parseConfidence: item.confidence,
    parseStructureValid: true,
    sourcePageIndex: item.sourcePages?.[0] ?? defaultSourcePage,
    ...(item.includePageImage === false ? { includePageImage: false } : {}),
  };
}
