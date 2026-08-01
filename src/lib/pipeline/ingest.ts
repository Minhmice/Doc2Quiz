import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  convertPasteWithMarkItDown,
  convertUrlWithMarkItDown,
  convertWithMarkItDown,
  MARKITDOWN_VERSION,
} from "@/lib/pipeline/markitdown";
import { truncateRawMarkdown } from "@/lib/pipeline/rawMarkdownLimit";
import type { SupportedMimeType } from "@/lib/pipeline/validation";
import {
  formatSupabaseNetworkError,
  isSupabaseNetworkError,
} from "@/lib/supabase/networkErrors";
import {
  validateFileUpload,
  validatePasteInput,
  validateStoragePath,
  validateYoutubeUrl,
} from "@/lib/pipeline/validation";

const DOC2QUIZ_BUCKET = "doc2quiz";
const SUPABASE_WRITE_MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildRawMarkdownStoragePath(userId: string, studySetId: string): string {
  return `${userId}/${studySetId}/raw.markdown`;
}

async function upsertCanonicalDocumentWithRetry(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  let lastError: { message: string } | null = null;

  for (let attempt = 1; attempt <= SUPABASE_WRITE_MAX_ATTEMPTS; attempt += 1) {
    const { error } = await supabase
      .from("canonical_documents")
      .upsert(row, { onConflict: "study_set_id" });

    if (!error) {
      return { error: null };
    }

    lastError = error;
    if (
      !isSupabaseNetworkError(error.message) ||
      attempt === SUPABASE_WRITE_MAX_ATTEMPTS
    ) {
      return { error };
    }

    await sleep(750 * attempt);
  }

  return { error: lastError };
}

export class IngestValidationError extends Error {
  readonly name = "IngestValidationError";
}

export class IngestConversionError extends Error {
  readonly name = "IngestConversionError";
}

export type IngestPastePayload = {
  kind: "paste";
  text: string;
};

export type IngestYoutubePayload = {
  kind: "youtube";
  url: string;
};

export type IngestFileRefPayload = {
  kind: "file_ref";
  storagePath: string;
  mimeType: SupportedMimeType;
  filename: string;
  sizeBytes: number;
};

export type IngestMultipartFilePayload = {
  kind: "multipart_file";
  file: File;
};

export type IngestPayload =
  | IngestPastePayload
  | IngestYoutubePayload
  | IngestFileRefPayload
  | IngestMultipartFilePayload;

export type IngestResult = {
  studySetId: string;
  pipelineStage: "raw";
  rawMarkdownLength: number;
};

type IngestMetadata = {
  input_type: "file" | "paste" | "youtube";
  source_url?: string | null;
  conversion_status: "ok" | "failed";
  conversion_error?: string | null;
  markitdown_version: string;
};

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-()+\s]/g, "_").trim();
  return cleaned || "upload";
}

function buildStoragePath(
  userId: string,
  studySetId: string,
  filename: string,
): string {
  return `${userId}/${studySetId}/${sanitizeFilename(filename)}`;
}

async function writeTempFile(bytes: Buffer, extension: string): Promise<string> {
  const path = join(tmpdir(), `ingest-${randomUUID()}${extension}`);
  await writeFile(path, bytes);
  return path;
}

async function removeTempFile(path: string | null): Promise<void> {
  if (!path) {
    return;
  }
  await unlink(path).catch(() => undefined);
}

async function downloadStorageObject(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(DOC2QUIZ_BUCKET)
    .download(storagePath);

  if (error || !data) {
    throw new IngestValidationError(
      error?.message ?? "Uploaded file not found in storage.",
    );
  }

  return Buffer.from(await data.arrayBuffer());
}

async function uploadOriginalFile(
  supabase: SupabaseClient,
  storagePath: string,
  bytes: Buffer,
  contentType: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(DOC2QUIZ_BUCKET)
    .upload(storagePath, bytes, {
      upsert: true,
      contentType,
    });

  if (error) {
    throw new IngestValidationError(error.message);
  }
}

async function uploadRawMarkdownArchive(
  supabase: SupabaseClient,
  storagePath: string,
  markdown: string,
): Promise<void> {
  const { error } = await supabase.storage
    .from(DOC2QUIZ_BUCKET)
    .upload(storagePath, Buffer.from(markdown, "utf8"), {
      upsert: true,
      contentType: "text/markdown; charset=utf-8",
    });

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }
}

async function persistConversionFailure(
  supabase: SupabaseClient,
  params: {
    userId: string;
    studySetId: string;
    metadata: IngestMetadata;
    originalStoragePath?: string | null;
    originalFilename?: string | null;
    originalMimeType?: string | null;
  },
  message: string,
): Promise<void> {
  await upsertCanonicalDocumentWithRetry(
    supabase,
    {
      user_id: params.userId,
      study_set_id: params.studySetId,
      original_storage_path: params.originalStoragePath ?? null,
      original_filename: params.originalFilename ?? null,
      original_mime_type: params.originalMimeType ?? null,
      raw_markdown: "",
      metadata: {
        ...params.metadata,
        conversion_status: "failed",
        conversion_error: message,
      },
    },
  );
}

/** @deprecated Use `runWorkspaceIngest`; retained for legacy pipeline tests only. */
export async function runIngest(params: {
  supabase: SupabaseClient;
  userId: string;
  studySetId: string;
  payload: IngestPayload;
}): Promise<IngestResult> {
  const { supabase, userId, studySetId, payload } = params;

  let inputType: IngestMetadata["input_type"] = "file";
  let sourceUrl: string | null = null;
  let storagePath: string | null = null;
  let originalFilename: string | null = null;
  let originalMimeType: string | null = null;
  let tempInputPath: string | null = null;

  const baseMetadata: IngestMetadata = {
    input_type: "file",
    conversion_status: "ok",
    conversion_error: null,
    markitdown_version: MARKITDOWN_VERSION,
  };

  try {
    if (payload.kind === "paste") {
      const validationError = validatePasteInput(payload.text);
      if (validationError) {
        throw new IngestValidationError(validationError);
      }
      inputType = "paste";
      baseMetadata.input_type = "paste";
    } else if (payload.kind === "youtube") {
      const validationError = validateYoutubeUrl(payload.url);
      if (validationError) {
        throw new IngestValidationError(validationError);
      }
      inputType = "youtube";
      sourceUrl = payload.url.trim();
      baseMetadata.input_type = "youtube";
      baseMetadata.source_url = sourceUrl;
    } else if (payload.kind === "file_ref") {
      const pathError = validateStoragePath(
        payload.storagePath,
        userId,
        studySetId,
      );
      if (pathError) {
        throw new IngestValidationError(pathError);
      }
      const fileError = validateFileUpload(
        payload.mimeType,
        payload.sizeBytes,
      );
      if (fileError) {
        throw new IngestValidationError(fileError);
      }
      storagePath = payload.storagePath;
      originalFilename = payload.filename;
      originalMimeType = payload.mimeType;
      inputType = "file";
      baseMetadata.input_type = "file";

      const bytes = await downloadStorageObject(supabase, storagePath);
      const ext = originalFilename.includes(".")
        ? originalFilename.slice(originalFilename.lastIndexOf("."))
        : "";
      tempInputPath = await writeTempFile(bytes, ext || ".bin");
    } else {
      const fileError = validateFileUpload(payload.file.type, payload.file.size);
      if (fileError) {
        throw new IngestValidationError(fileError);
      }
      originalFilename = payload.file.name;
      originalMimeType = payload.file.type as SupportedMimeType;
      storagePath = buildStoragePath(userId, studySetId, payload.file.name);
      inputType = "file";
      baseMetadata.input_type = "file";

      const bytes = Buffer.from(await payload.file.arrayBuffer());
      await uploadOriginalFile(
        supabase,
        storagePath,
        bytes,
        payload.file.type,
      );
      const ext = originalFilename.includes(".")
        ? originalFilename.slice(originalFilename.lastIndexOf("."))
        : "";
      tempInputPath = await writeTempFile(bytes, ext || ".bin");
    }

    let rawMarkdown: string;
    try {
      if (payload.kind === "paste") {
        rawMarkdown = await convertPasteWithMarkItDown(payload.text);
      } else if (payload.kind === "youtube") {
        rawMarkdown = await convertUrlWithMarkItDown(payload.url.trim());
      } else if (tempInputPath) {
        rawMarkdown = await convertWithMarkItDown(tempInputPath);
      } else {
        throw new IngestConversionError("No input available for conversion.");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Conversion failed.";
      await persistConversionFailure(
        supabase,
        {
          userId,
          studySetId,
          metadata: { ...baseMetadata, input_type: inputType, source_url: sourceUrl },
          originalStoragePath: storagePath,
          originalFilename,
          originalMimeType,
        },
        message,
      );
      throw new IngestConversionError(message);
    }

    const {
      markdown: storedMarkdown,
      truncated,
      warnings: truncationWarnings,
    } = truncateRawMarkdown(rawMarkdown);

    let rawMarkdownStoragePath: string | null = null;
    if (truncated) {
      rawMarkdownStoragePath = buildRawMarkdownStoragePath(userId, studySetId);
      await uploadRawMarkdownArchive(
        supabase,
        rawMarkdownStoragePath,
        rawMarkdown,
      );
    }

    const { error: docError } = await upsertCanonicalDocumentWithRetry(
      supabase,
      {
        user_id: userId,
        study_set_id: studySetId,
        original_storage_path: storagePath,
        original_filename: originalFilename,
        original_mime_type: originalMimeType,
        raw_markdown: storedMarkdown,
        metadata: {
          ...baseMetadata,
          input_type: inputType,
          source_url: sourceUrl,
          conversion_status: "ok",
          conversion_error: null,
          raw_markdown_storage_path: rawMarkdownStoragePath,
          warnings: truncationWarnings.length > 0 ? truncationWarnings : undefined,
        },
      },
    );

    if (docError) {
      throw new Error(formatSupabaseNetworkError(docError.message));
    }

    const { error: stageError } = await supabase
      .from("study_sets")
      .update({ pipeline_stage: "raw" })
      .eq("id", studySetId)
      .eq("user_id", userId);

    if (stageError) {
      throw new Error(formatSupabaseNetworkError(stageError.message));
    }

    return {
      studySetId,
      pipelineStage: "raw",
      rawMarkdownLength: storedMarkdown.length,
    };
  } finally {
    await removeTempFile(tempInputPath);
  }
}
