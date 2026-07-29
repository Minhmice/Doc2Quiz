import { z } from "zod";

import { semanticIntentSchema } from "@/lib/pipeline/canonicalSchemas";

const conceptIdSchema = z.string().regex(/^concept_\d{3}$/);

const sectionKeySchema = z.string().regex(/^sec_\d{3}$/);

export const conceptSchema = z.object({
  concept_id: conceptIdSchema,
  label: z.string().min(1),
  section_key: sectionKeySchema,
  importance: z.enum(["high", "medium", "low"]).optional(),
});

export const generatedQuestionSchema = z.object({
  concept_id: conceptIdSchema,
  prompt: z.string().min(1),
  choices: z
    .tuple([
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
      z.string().min(1),
    ])
    .refine(
      (choices) => new Set(choices.map((c) => c.trim().toLowerCase())).size === 4,
      "Choices must be distinct from each other",
    ),
  correct_index: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  explanation: z
    .string()
    .min(1, "Explanation is required for each question")
    .optional()
    .default(""),
  section_key: sectionKeySchema,
  source_excerpt: z.string().min(1),
  fact_ids: z
    .array(z.string().regex(/^(?:fact|sourceq)_\d{3}$/))
    .min(1)
    .refine((ids) => new Set(ids).size === ids.length, "fact_ids must be unique"),
  semantic_intent: semanticIntentSchema,
  answer_text: z.string().min(1),
  resolution: z.object({
    basis: z.enum(["model_knowledge", "source_answer"]),
    confidence: z.enum(["high", "medium", "low"]),
    citations: z.array(z.object({
      title: z.string().min(1),
      url: z.string().url(),
      snippet: z.string().min(1),
    })),
  }).optional(),
});

export const quizGeneratorOutputSchema = z.object({
  recommended_count: z.number().int().min(1).max(40),
  concepts: z.array(conceptSchema).min(1),
  questions: z.array(generatedQuestionSchema).min(1),
  warnings: z.array(z.string()).default([]),
});

export const quizModelQuestionSchema = z.object({
  fact_id: z.string().regex(/^fact_\d{3}$/).optional(),
  fact_ids: z.array(z.string().regex(/^fact_\d{3}$/)).min(1).optional(),
  prompt: z.string().min(1),
  choices: z.tuple([
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
    z.string().min(1),
  ]),
  correct_index: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  context_mode: z.enum(["none", "source_excerpt"]).optional().default("none"),
  semantic_intent: semanticIntentSchema.optional(),
}).refine(
  (question) => question.fact_id !== undefined || question.fact_ids !== undefined,
  "fact_id is required",
);

export const quizModelOutputSchema = z.object({
  recommended_count: z.number().int().min(1).max(40).optional(),
  questions: z.array(quizModelQuestionSchema).min(1),
  warnings: z.array(z.string()).default([]),
  concepts: z.array(conceptSchema).optional(),
});

export const quizGenerateBodySchema = z.object({
  questionCount: z.number().int().min(1).max(40).optional(),
});

export type QuizGeneratorOutput = z.infer<typeof quizGeneratorOutputSchema>;
export type GeneratedQuestion = z.infer<typeof generatedQuestionSchema>;
export type QuizModelOutput = z.infer<typeof quizModelOutputSchema>;
export type QuizModelQuestion = z.infer<typeof quizModelQuestionSchema>;
export type QuizGenerateBody = z.infer<typeof quizGenerateBodySchema>;
