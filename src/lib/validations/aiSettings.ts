import { z } from "zod";

export const aiSettingsSchema = z
  .object({
    provider: z.enum(["openai", "anthropic", "custom"]),
    url: z.string(),
    model: z.string(),
    key: z.string(),
  })
  .refine((data) => data.provider !== "custom" || data.url.trim().length > 0, {
    path: ["url"],
    message: "Enter the full chat-completions URL for Custom.",
  })
  .refine((data) => data.provider !== "custom" || data.model.trim().length > 0, {
    path: ["model"],
    message: "Enter a model id for Custom.",
  });

export type AiSettingsFormValues = z.infer<typeof aiSettingsSchema>;
