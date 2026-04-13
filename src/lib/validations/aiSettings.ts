import { z } from "zod";

function isPlausibleHttpUrl(baseUrl: string): boolean {
  const t = baseUrl.trim();
  if (!t) {
    return true;
  }
  try {
    const u = new URL(t);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export const aiSettingsSchema = z
  .object({
    baseUrl: z.string(),
    modelId: z.string(),
    key: z.string(),
  })
  .refine((data) => isPlausibleHttpUrl(data.baseUrl), {
    path: ["baseUrl"],
    message: "Enter a valid http(s) URL or leave blank for the default host.",
  })
  .refine(
    (data) => !data.baseUrl.trim() || data.modelId.trim().length > 0,
    {
      path: ["modelId"],
      message: "Model id is required when API base URL is set.",
    },
  );

export type AiSettingsFormValues = z.infer<typeof aiSettingsSchema>;
