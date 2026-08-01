import { z } from "zod";

import {
  flashcardAmountSchema,
  flashcardCoverageSchema,
  flashcardLearningGoalSchema,
} from "@/lib/pipeline/flashcardSchemas";
import { SUPPORTED_MIME_TYPES } from "@/lib/pipeline/validation";

const mimeEnum = z.enum(
  SUPPORTED_MIME_TYPES as unknown as [string, ...string[]],
);

/** JSON body for POST /api/workspaces/ingest and document version replacement. */
const workspaceIngestWorkspaceSchema = z.object({
  workspaceId: z.string().uuid().optional(),
});

export const workspaceIngestJsonBodySchema = z.discriminatedUnion("kind", [
  workspaceIngestWorkspaceSchema.extend({
    kind: z.literal("paste"),
    text: z.string().min(1),
  }),
  workspaceIngestWorkspaceSchema.extend({
    kind: z.literal("youtube"),
    url: z.string().url(),
  }),
  workspaceIngestWorkspaceSchema.extend({
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

/** POST /api/workspaces/[workspaceId]/outputs/quiz — IDs only, no markdown/checksums. */
export const workspaceQuizGenerateBodySchema = z
  .object({
    canonicalVersionIds: z.array(z.string().uuid()).min(1),
    questionCount: z.number().int().min(1).max(40).optional(),
  })
  .strict();

export type WorkspaceQuizGenerateBody = z.infer<
  typeof workspaceQuizGenerateBodySchema
>;

/** POST /api/workspaces/[workspaceId]/outputs/flashcards — IDs + wizard options only. */
export const workspaceFlashcardGenerateBodySchema = z
  .object({
    canonicalVersionIds: z.array(z.string().uuid()).min(1),
    learningGoal: flashcardLearningGoalSchema,
    coverage: flashcardCoverageSchema,
    amount: flashcardAmountSchema,
  })
  .strict();

export type WorkspaceFlashcardGenerateBody = z.infer<
  typeof workspaceFlashcardGenerateBodySchema
>;
