import type {
  GeneratedQuestion,
  QuizGeneratorOutput,
} from "@/lib/pipeline/quizSchemas";

const MAX_QUESTIONS = 40;

export type DedupeAndCapResult = {
  questions: GeneratedQuestion[];
  recommendedCount: number;
  generatedCount: number;
  warnings: string[];
};

function normalizeFingerprintPart(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function questionFingerprint(question: GeneratedQuestion): string {
  return [
    normalizeFingerprintPart(question.prompt),
    ...question.choices.map(normalizeFingerprintPart).sort(),
  ].join("|");
}

function selectForConceptCoverage(
  questions: GeneratedQuestion[],
  targetCount: number,
): GeneratedQuestion[] {
  const groups = new Map<string, GeneratedQuestion[]>();
  for (const question of questions) {
    const key = question.concept_id.toLocaleLowerCase();
    groups.set(key, [...(groups.get(key) ?? []), question]);
  }

  const selected: GeneratedQuestion[] = [];
  let depth = 0;
  while (selected.length < targetCount) {
    let added = false;
    for (const group of groups.values()) {
      const question = group[depth];
      if (question) {
        selected.push(question);
        added = true;
        if (selected.length === targetCount) {
          return selected;
        }
      }
    }
    if (!added) {
      break;
    }
    depth += 1;
  }
  return selected;
}

export function dedupeAndCapQuestions(
  output: QuizGeneratorOutput,
  questionCountOverride?: number,
): DedupeAndCapResult {
  const seenQuestions = new Set<string>();
  const uniqueQuestions: GeneratedQuestion[] = [];
  for (const question of output.questions) {
    const fingerprint = questionFingerprint(question);
    if (!seenQuestions.has(fingerprint)) {
      seenQuestions.add(fingerprint);
      uniqueQuestions.push(question);
    }
  }

  const recommendedCount = Math.min(
    questionCountOverride ?? output.recommended_count,
    MAX_QUESTIONS,
  );
  const warnings = [...output.warnings];
  const questions = selectForConceptCoverage(
    uniqueQuestions,
    recommendedCount,
  );

  const generatedCount = questions.length;

  return {
    questions,
    recommendedCount,
    generatedCount,
    warnings,
  };
}
