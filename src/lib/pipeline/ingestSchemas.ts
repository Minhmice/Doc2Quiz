import { z } from "zod";

import { SUPPORTED_MIME_TYPES } from "@/lib/pipeline/validation";

const mimeEnum = z.enum(
  SUPPORTED_MIME_TYPES as unknown as [string, ...string[]],
);

export const ingestJsonBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("paste"),
    text: z.string().min(1),
  }),
  z.object({
    kind: z.literal("youtube"),
    url: z.string().url(),
  }),
  z.object({
    kind: z.literal("file_ref"),
    storagePath: z.string().min(1),
    mimeType: mimeEnum,
    filename: z.string().min(1),
    sizeBytes: z.number().int().positive(),
  }),
]);

export type IngestJsonBody = z.infer<typeof ingestJsonBodySchema>;
