import { z } from "zod";

const conceptIdSchema = z.string().regex(/^concept_\d{3}$/);

const sectionKeySchema = z.string().regex(/^sec_\d{3}$/);

export const flashcardLearningGoalSchema = z.enum([
  "memorize",
  "understand",
  "exam_preparation",
]);

export const flashcardCoverageSchema = z.union([
  z.literal("entire_document"),
  z.object({
    sectionKeys: z.array(sectionKeySchema).min(1),
  }),
]);

export const flashcardAmountSchema = z.union([
  z.literal("recommended"),
  z.object({
    count: z.number().int().min(5).max(60),
  }),
]);

export const flashcardGenerateBodySchema = z.object({
  learningGoal: flashcardLearningGoalSchema,
  coverage: flashcardCoverageSchema,
  amount: flashcardAmountSchema,
});

export const flashcardFormatSchema = z.enum([
  "term_definition",
  "question_answer",
  "cloze",
  "mixed",
]);

export const flashcardConceptSchema = z.object({
  concept_id: conceptIdSchema,
  label: z.string().min(1),
  section_key: sectionKeySchema.optional(),
  importance: z.enum(["high", "medium", "low"]).optional(),
});

export const generatedFlashcardSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  format: flashcardFormatSchema.optional(),
  concept_id: conceptIdSchema.optional(),
  section_key: sectionKeySchema.optional(),
  source_excerpt: z.string().optional(),
});

export const flashcardGeneratorOutputSchema = z.object({
  detected_format: flashcardFormatSchema,
  recommended_count: z.number().int().min(1).max(60),
  concepts: z.array(flashcardConceptSchema).min(1),
  cards: z.array(generatedFlashcardSchema).min(1),
  warnings: z.array(z.string()).default([]),
});

export type FlashcardGeneratorOutput = z.infer<
  typeof flashcardGeneratorOutputSchema
>;
export type GeneratedFlashcard = z.infer<typeof generatedFlashcardSchema>;
export type FlashcardGenerateBody = z.infer<typeof flashcardGenerateBodySchema>;
