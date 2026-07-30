import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { SupabaseClient } from "@supabase/supabase-js";

import { checksumCanonicalMarkdown } from "@/lib/provenance/checksum";
import {
  convertPasteWithMarkItDown,
  convertUrlWithMarkItDown,
  convertWithMarkItDown,
  MARKITDOWN_VERSION,
} from "@/lib/pipeline/markitdown";
import { truncateRawMarkdown } from "@/lib/pipeline/rawMarkdownLimit";
import type { SupportedMimeType } from "@/lib/pipeline/validation";
import {
  validateFileUpload,
  validatePasteInput,
  validateYoutubeUrl,
} from "@/lib/pipeline/validation";
import {
  formatSupabaseNetworkError,
  isSupabaseNetworkError,
} from "@/lib/supabase/networkErrors";
import {
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
} from "@/lib/workspaces/errors";

export {
  WorkspaceIngestConversionError,
  WorkspaceIngestValidationError,
} from "@/lib/workspaces/errors";

const DOC2QUIZ_BUCKET = "doc2quiz";

export type WorkspaceIngestPastePayload = {
  kind: "paste";
  text: string;
};

export type WorkspaceIngestYoutubePayload = {
  kind: "youtube";
  url: string;
};

export type WorkspaceIngestFileRefPayload = {
  kind: "file_ref";
  storagePath: string;
  mimeType: SupportedMimeType;
  filename: string;
  sizeBytes: number;
};

export type WorkspaceIngestMultipartFilePayload = {
  kind: "multipart_file";
  file: File;
};

export type WorkspaceIngestPayload =
  | WorkspaceIngestPastePayload
  | WorkspaceIngestYoutubePayload
  | WorkspaceIngestFileRefPayload
  | WorkspaceIngestMultipartFilePayload;

export type WorkspaceIngestResult = {
  workspaceId: string;
  documentId: string;
  documentVersionId: string;
  versionNumber: number;
  conversionStatus: "ok" | "failed";
  rawMarkdownLength: number;
  title: string;
};

type ConversionProvenance = {
  input_type: "file" | "paste" | "youtube";
  source_url?: string | null;
  conversion_status: "ok" | "failed";
  conversion_error?: string | null;
  markitdown_version: string;
  raw_markdown_storage_path?: string | null;
  warnings?: string[];
};

type RpcResult = {
  workspaceId: string;
  documentId: string;
  documentVersionId: string;
  versionNumber: number;
};

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-()+\s]/g, "_").trim();
  return cleaned || "upload";
}

export function buildImmutableStoragePath(
  workspaceId: string,
  documentId: string,
  versionId: string,
  filename: string,
): string {
  return `${workspaceId}/${documentId}/${versionId}/${sanitizeFilename(filename)}`;
}

export function deriveSourceTitle(payload: WorkspaceIngestPayload): string {
  if (payload.kind === "multipart_file") {
    const name = payload.file.name.replace(/\.[^.]+$/, "").trim();
    return name || "Uploaded source";
  }
  if (payload.kind === "file_ref") {
    const name = payload.filename.replace(/\.[^.]+$/, "").trim();
    return name || "Uploaded source";
  }
  if (payload.kind === "paste") {
    return "Pasted source";
  }
  return "YouTube source";
}

/** Reject staging paths outside `{userId}/ingest-staging/{id}/{filename}`. */
export function validateWorkspaceStagingPath(
  storagePath: string,
  userId: string,
): string | null {
  const expectedPrefix = `${userId}/ingest-staging/`;
  if (!storagePath.startsWith(expectedPrefix)) {
    return "Invalid staging storage path.";
  }
  const remainder = storagePath.slice(expectedPrefix.length);
  if (!remainder || remainder.includes("..")) {
    return "Invalid staging storage path.";
  }
  const parts = remainder.split("/");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return "Invalid staging storage path.";
  }
  return null;
}

async function writeTempFile(bytes: Buffer, extension: string): Promise<string> {
  const path = join(tmpdir(), `workspace-ingest-${randomUUID()}${extension}`);
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
    throw new WorkspaceIngestValidationError(
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
  const { error } = await supabase.storage.from(DOC2QUIZ_BUCKET).upload(
    storagePath,
    bytes,
    {
      upsert: true,
      contentType,
    },
  );

  if (error) {
    throw new WorkspaceIngestValidationError(error.message);
  }
}

async function uploadRawMarkdownArchive(
  supabase: SupabaseClient,
  storagePath: string,
  markdown: string,
): Promise<void> {
  const { error } = await supabase.storage.from(DOC2QUIZ_BUCKET).upload(
    storagePath,
    Buffer.from(markdown, "utf8"),
    {
      upsert: true,
      contentType: "text/markdown; charset=utf-8",
    },
  );

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }
}

async function callCreateVersionRpc(
  supabase: SupabaseClient,
  args: {
    workspaceId: string | null;
    documentId: string | null;
    workspaceTitle: string;
    documentTitle: string;
    sourceKind: "upload" | "paste" | "url" | "legacy";
    originalStoragePath: string | null;
    originalFilename: string | null;
    originalMimeType: string | null;
    sourceUrl: string | null;
    rawMarkdown: string;
    rawMarkdownChecksum: string | null;
    conversionProvenance: ConversionProvenance;
  },
): Promise<RpcResult> {
  const { data, error } = await supabase.rpc(
    "create_workspace_document_version",
    {
      p_workspace_id: args.workspaceId,
      p_document_id: args.documentId,
      p_workspace_title: args.workspaceTitle,
      p_document_title: args.documentTitle,
      p_source_kind: args.sourceKind,
      p_original_storage_path: args.originalStoragePath,
      p_original_filename: args.originalFilename,
      p_original_mime_type: args.originalMimeType,
      p_source_url: args.sourceUrl,
      p_raw_markdown: args.rawMarkdown,
      p_raw_markdown_checksum: args.rawMarkdownChecksum,
      p_conversion_provenance: args.conversionProvenance,
    },
  );

  if (error) {
    const message = error.message;
    if (isSupabaseNetworkError(message)) {
      throw new Error(formatSupabaseNetworkError(message));
    }
    throw new Error(message);
  }

  const result = data as RpcResult | null;
  if (
    !result?.workspaceId ||
    !result.documentId ||
    !result.documentVersionId ||
    typeof result.versionNumber !== "number"
  ) {
    throw new Error("create_workspace_document_version returned invalid payload.");
  }

  return result;
}

async function setOriginalStoragePath(
  supabase: SupabaseClient,
  documentVersionId: string,
  storagePath: string,
): Promise<void> {
  const { error } = await supabase
    .from("document_versions")
    .update({ original_storage_path: storagePath })
    .eq("id", documentVersionId);

  if (error) {
    throw new Error(formatSupabaseNetworkError(error.message));
  }
}

/**
 * Workspace-native first ingest / replacement. Does not call legacy `runIngest`.
 * Validates before RPC. Failed conversion still persists an explicit failed version.
 */
export async function runWorkspaceIngest(params: {
  supabase: SupabaseClient;
  userId: string;
  payload: WorkspaceIngestPayload;
  workspaceId?: string | null;
  documentId?: string | null;
}): Promise<WorkspaceIngestResult> {
  const {
    supabase,
    userId,
    payload,
    workspaceId = null,
    documentId = null,
  } = params;

  let inputType: ConversionProvenance["input_type"] = "file";
  let sourceUrl: string | null = null;
  let sourceKind: "upload" | "paste" | "url" = "upload";
  let originalFilename: string | null = null;
  let originalMimeType: string | null = null;
  let stagingPath: string | null = null;
  let originalBytes: Buffer | null = null;
  let tempInputPath: string | null = null;

  const title = deriveSourceTitle(payload);

  try {
    if (payload.kind === "paste") {
      const validationError = validatePasteInput(payload.text);
      if (validationError) {
        throw new WorkspaceIngestValidationError(validationError);
      }
      inputType = "paste";
      sourceKind = "paste";
    } else if (payload.kind === "youtube") {
      const validationError = validateYoutubeUrl(payload.url);
      if (validationError) {
        throw new WorkspaceIngestValidationError(validationError);
      }
      inputType = "youtube";
      sourceKind = "url";
      sourceUrl = payload.url.trim();
    } else if (payload.kind === "file_ref") {
      const pathError = validateWorkspaceStagingPath(
        payload.storagePath,
        userId,
      );
      if (pathError) {
        throw new WorkspaceIngestValidationError(pathError);
      }
      const fileError = validateFileUpload(payload.mimeType, payload.sizeBytes);
      if (fileError) {
        throw new WorkspaceIngestValidationError(fileError);
      }
      stagingPath = payload.storagePath;
      originalFilename = payload.filename;
      originalMimeType = payload.mimeType;
      inputType = "file";
      sourceKind = "upload";

      originalBytes = await downloadStorageObject(supabase, stagingPath);
      const ext = originalFilename.includes(".")
        ? originalFilename.slice(originalFilename.lastIndexOf("."))
        : "";
      tempInputPath = await writeTempFile(originalBytes, ext || ".bin");
    } else {
      const fileError = validateFileUpload(
        payload.file.type,
        payload.file.size,
      );
      if (fileError) {
        throw new WorkspaceIngestValidationError(fileError);
      }
      originalFilename = payload.file.name;
      originalMimeType = payload.file.type as SupportedMimeType;
      inputType = "file";
      sourceKind = "upload";
      originalBytes = Buffer.from(await payload.file.arrayBuffer());
      const ext = originalFilename.includes(".")
        ? originalFilename.slice(originalFilename.lastIndexOf("."))
        : "";
      tempInputPath = await writeTempFile(originalBytes, ext || ".bin");
    }

    const baseProvenance: ConversionProvenance = {
      input_type: inputType,
      source_url: sourceUrl,
      conversion_status: "ok",
      conversion_error: null,
      markitdown_version: MARKITDOWN_VERSION,
    };

    let rawMarkdown: string;
    try {
      if (payload.kind === "paste") {
        rawMarkdown = await convertPasteWithMarkItDown(payload.text);
      } else if (payload.kind === "youtube") {
        rawMarkdown = await convertUrlWithMarkItDown(payload.url.trim());
      } else if (tempInputPath) {
        rawMarkdown = await convertWithMarkItDown(tempInputPath);
      } else {
        throw new WorkspaceIngestConversionError(
          "No input available for conversion.",
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Conversion failed.";
      const failedProvenance: ConversionProvenance = {
        ...baseProvenance,
        conversion_status: "failed",
        conversion_error: message,
      };

      await callCreateVersionRpc(supabase, {
        workspaceId,
        documentId,
        workspaceTitle: title,
        documentTitle: title,
        sourceKind,
        originalStoragePath: null,
        originalFilename,
        originalMimeType,
        sourceUrl,
        rawMarkdown: "",
        rawMarkdownChecksum: null,
        conversionProvenance: failedProvenance,
      });

      throw new WorkspaceIngestConversionError(message);
    }

    const {
      markdown: storedMarkdown,
      truncated,
      warnings: truncationWarnings,
    } = truncateRawMarkdown(rawMarkdown);

    const provenance: ConversionProvenance = {
      ...baseProvenance,
      conversion_status: "ok",
      conversion_error: null,
      warnings:
        truncationWarnings.length > 0 ? truncationWarnings : undefined,
    };

    const rpcResult = await callCreateVersionRpc(supabase, {
      workspaceId,
      documentId,
      workspaceTitle: title,
      documentTitle: title,
      sourceKind,
      originalStoragePath: null,
      originalFilename,
      originalMimeType,
      sourceUrl,
      rawMarkdown: storedMarkdown,
      rawMarkdownChecksum: checksumCanonicalMarkdown(storedMarkdown),
      conversionProvenance: provenance,
    });

    if (originalBytes && originalFilename && originalMimeType) {
      const immutablePath = buildImmutableStoragePath(
        rpcResult.workspaceId,
        rpcResult.documentId,
        rpcResult.documentVersionId,
        originalFilename,
      );
      await uploadOriginalFile(
        supabase,
        immutablePath,
        originalBytes,
        originalMimeType,
      );
      await setOriginalStoragePath(
        supabase,
        rpcResult.documentVersionId,
        immutablePath,
      );
    }

    if (truncated) {
      const archivePath = buildImmutableStoragePath(
        rpcResult.workspaceId,
        rpcResult.documentId,
        rpcResult.documentVersionId,
        "raw.markdown",
      );
      await uploadRawMarkdownArchive(supabase, archivePath, rawMarkdown);
      provenance.raw_markdown_storage_path = archivePath;
    }

    return {
      workspaceId: rpcResult.workspaceId,
      documentId: rpcResult.documentId,
      documentVersionId: rpcResult.documentVersionId,
      versionNumber: rpcResult.versionNumber,
      conversionStatus: "ok",
      rawMarkdownLength: storedMarkdown.length,
      title,
    };
  } finally {
    await removeTempFile(tempInputPath);
  }
}
