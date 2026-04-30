import { z } from "zod";

const confidenceSchema = z.number().min(0).max(1);
const pageRefsSchema = z.array(z.number().int().positive()).optional();

export const quizGenItemSchema = z.object({
  question: z.string().min(1),
  options: z.tuple([
    z.string(),
    z.string(),
    z.string(),
    z.string(),
  ]),
  correctIndex: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
  explanation: z.string().optional(),
  pageRefs: pageRefsSchema,
  confidence: confidenceSchema,
  /** Required — every MCQ cites ≥1 canonical unit id. */
  sourceUnitIds: z.array(z.string().min(1)).min(1),
});

export const flashcardGenItemSchema = z.object({
  front: z.string().min(1),
  back: z.string().min(1),
  pageRefs: pageRefsSchema,
  confidence: confidenceSchema,
  sourceUnitIds: z.array(z.string().min(1)).min(1),
});

export const quizGenPayloadSchema = z.object({
  items: z.array(quizGenItemSchema),
});

export const flashcardGenPayloadSchema = z.object({
  items: z.array(flashcardGenItemSchema),
});

export type QuizGenItem = z.infer<typeof quizGenItemSchema>;
export type FlashcardGenItem = z.infer<typeof flashcardGenItemSchema>;
