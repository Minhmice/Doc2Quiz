import { z } from "zod";

/** MCQ editor: stem + four non-empty options + correct index */
export const questionEditorSchema = z.object({
  question: z
    .string()
    .trim()
    .min(1, "Question is required")
    .min(10, "Question must be at least 10 characters"),
  option0: z.string().trim().min(1, "Option A is required"),
  option1: z.string().trim().min(1, "Option B is required"),
  option2: z.string().trim().min(1, "Option C is required"),
  option3: z.string().trim().min(1, "Option D is required"),
  correctIndex: z.union([
    z.literal(0),
    z.literal(1),
    z.literal(2),
    z.literal(3),
  ]),
});

export type QuestionEditorFormValues = z.infer<typeof questionEditorSchema>;
