import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { GeneratedQuestion } from "@/lib/pipeline/quizSchemas";

export type ApprovedQuestionInsertRow = {
  id: string;
  user_id: string;
  study_set_id: string;
  prompt: string;
  choices: [string, string, string, string];
  correct_index: 0 | 1 | 2 | 3;
  explanation: string | null;
  tags: string[];
  source: {
    concept_id: string;
    section_key?: string;
    source_excerpt?: string;
    fact_ids: string[];
    semantic_intent: string;
    answer_text: string;
    prompt_version: string;
    generated_at: string;
    resolution?: GeneratedQuestion["resolution"];
  };
};

export function mapGeneratedQuestionToRow(
  question: GeneratedQuestion,
  meta: {
    id: string;
    userId: string;
    studySetId: string;
    promptVersion: string;
  },
): ApprovedQuestionInsertRow {
  return {
    id: meta.id,
    user_id: meta.userId,
    study_set_id: meta.studySetId,
    prompt: question.prompt,
    choices: question.choices,
    correct_index: question.correct_index,
    explanation: question.explanation ?? null,
    tags: question.concept_id ? [question.concept_id] : [],
    source: {
      concept_id: question.concept_id,
      section_key: question.section_key,
      source_excerpt: question.source_excerpt,
      fact_ids: question.fact_ids,
      semantic_intent: question.semantic_intent,
      answer_text: question.answer_text,
      prompt_version: meta.promptVersion,
      generated_at: new Date().toISOString(),
      ...(question.resolution ? { resolution: question.resolution } : {}),
    },
  };
}

export function mapQuizOutputToRows(
  questions: GeneratedQuestion[],
  meta: {
    userId: string;
    studySetId: string;
    promptVersion: string;
  },
): ApprovedQuestionInsertRow[] {
  return questions.map((question) =>
    mapGeneratedQuestionToRow(question, {
      id: createRandomUuid(),
      userId: meta.userId,
      studySetId: meta.studySetId,
      promptVersion: meta.promptVersion,
    }),
  );
}
