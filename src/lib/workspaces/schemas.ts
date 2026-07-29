import { z } from "zod";

import { SUPPORTED_MIME_TYPES } from "@/lib/pipeline/validation";

const mimeEnum = z.enum(
  SUPPORTED_MIME_TYPES as unknown as [string, ...string[]],
);

/** JSON body for POST /api/workspaces/ingest and document version replacement. */
export const workspaceIngestJsonBodySchema = z.discriminatedUnion("kind", [
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

export type WorkspaceIngestJsonBody = z.infer<
  typeof workspaceIngestJsonBodySchema
>;

/** Workspace rename / subtitle — never source bytes. */
export const workspacePatchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    subtitle: z.union([z.string(), z.null()]).optional(),
  })
  .refine((value) => value.title !== undefined || value.subtitle !== undefined, {
    message: "No valid fields to update",
  });

export type WorkspacePatch = z.infer<typeof workspacePatchSchema>;

/** Document display metadata — rejects source/raw fields. */
export const documentPatchSchema = z
  .object({
    title: z.string().trim().min(1).optional(),
    description: z.union([z.string(), z.null()]).optional(),
  })
  .strict()
  .refine(
    (value) => value.title !== undefined || value.description !== undefined,
    { message: "No valid fields to update" },
  );

export type DocumentPatch = z.infer<typeof documentPatchSchema>;

/** Soft-delete version body requires the version id in the path or query. */
export const softDeleteVersionParamsSchema = z.object({
  documentVersionId: z.string().uuid(),
});

export type SoftDeleteVersionParams = z.infer<
  typeof softDeleteVersionParamsSchema
>;
