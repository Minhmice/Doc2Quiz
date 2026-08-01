import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import type { WorkspaceIngestJsonBody } from "@/lib/workspaces/schemas";
import {
  isSupportedMimeType,
  type SupportedMimeType,
} from "@/lib/pipeline/validation";

export type IngestUiStep =
  | "idle"
  | "validating"
  | "uploading"
  | "converting"
  | "done"
  | "error";

export type WorkspaceIngestIdentity = {
  workspaceId: string;
  documentId: string;
  documentVersionId: string;
  versionNumber: number;
  conversionStatus: "ok" | "failed";
  rawMarkdownLength: number;
  title: string;
};

export type IngestSourceInput =
  | { kind: "file"; file: File }
  | { kind: "paste"; text: string }
  | { kind: "youtube"; url: string };

const MULTIPART_THRESHOLD_BYTES = 10 * 1024 * 1024;
const DOC2QUIZ_BUCKET = "doc2quiz";

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[/\\]/).pop() ?? "upload";
  const cleaned = base.replace(/[^\w.\-()+\s]/g, "_").trim();
  return cleaned || "upload";
}

function resolveMimeType(file: File): SupportedMimeType {
  if (isSupportedMimeType(file.type)) {
    return file.type;
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".pdf")) {
    return "application/pdf";
  }
  if (lower.endsWith(".txt")) {
    return "text/plain";
  }
  if (lower.endsWith(".csv")) {
    return "text/csv";
  }
  if (lower.endsWith(".html") || lower.endsWith(".htm")) {
    return "text/html";
  }
  if (lower.endsWith(".json")) {
    return "application/json";
  }
  if (lower.endsWith(".xml")) {
    return "application/xml";
  }
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".xlsx")) {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (lower.endsWith(".xls")) {
    return "application/vnd.ms-excel";
  }
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lower.endsWith(".png")) {
    return "image/png";
  }
  if (lower.endsWith(".wav")) {
    return "audio/wav";
  }
  if (lower.endsWith(".mp3")) {
    return "audio/mpeg";
  }
  return file.type as SupportedMimeType;
}

async function requireUserId(): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Not authenticated");
  }
  return user.id;
}

function mapNetworkError(error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error("Connection lost. Check your network and try again.");
  }
  if (error instanceof Error) {
    return error;
  }
  return new Error("Conversion failed. Try a different file or paste the text directly.");
}

async function parseIngestResponse(res: Response): Promise<WorkspaceIngestIdentity> {
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
    workspaceId?: string;
    documentId?: string;
    documentVersionId?: string;
    versionNumber?: number;
    conversionStatus?: "ok" | "failed";
    rawMarkdownLength?: number;
    title?: string;
  };

  if (!res.ok) {
    throw new Error(
      payload.message ??
        payload.error ??
        "Conversion failed. Try a different file or paste the text directly.",
    );
  }

  if (
    !payload.workspaceId ||
    !payload.documentId ||
    !payload.documentVersionId ||
    typeof payload.versionNumber !== "number"
  ) {
    throw new Error("Ingest response missing workspace identity.");
  }

  return {
    workspaceId: payload.workspaceId,
    documentId: payload.documentId,
    documentVersionId: payload.documentVersionId,
    versionNumber: payload.versionNumber,
    conversionStatus: payload.conversionStatus ?? "ok",
    rawMarkdownLength: payload.rawMarkdownLength ?? 0,
    title: payload.title ?? "Untitled",
  };
}

type WorkspaceIngestRequestBody = WorkspaceIngestJsonBody & {
  workspaceId?: string;
};

async function postIngestJson(
  body: WorkspaceIngestRequestBody,
): Promise<WorkspaceIngestIdentity> {
  const res = await fetch("/api/workspaces/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parseIngestResponse(res);
}

async function postIngestMultipart(
  file: File,
  workspaceId?: string,
): Promise<WorkspaceIngestIdentity> {
  const form = new FormData();
  form.append("file", file);
  if (workspaceId) {
    form.append("workspaceId", workspaceId);
  }
  const res = await fetch("/api/workspaces/ingest", {
    method: "POST",
    body: form,
  });
  return parseIngestResponse(res);
}

/**
 * First-upload client: posts to workspace ingest only.
 * Does not call createStudySetEarlyMeta — server creates workspace after validation.
 * Legacy study-set ingest remains in ingestStudySet.ts for existing routes.
 */
export async function ingestWorkspaceSource(params: {
  input: IngestSourceInput;
  workspaceId?: string;
  onStep?: (step: IngestUiStep) => void;
}): Promise<WorkspaceIngestIdentity> {
  const { input, workspaceId, onStep } = params;

  onStep?.("validating");

  try {
    if (input.kind === "file") {
      const file = input.file;
      const mimeType = resolveMimeType(file);

      if (file.size > MULTIPART_THRESHOLD_BYTES) {
        onStep?.("uploading");
        const userId = await requireUserId();
        const supabase = createSupabaseBrowserClient();
        const stagingId = crypto.randomUUID();
        const storagePath = `${userId}/ingest-staging/${stagingId}/${sanitizeFilename(file.name)}`;
        const { error } = await supabase.storage
          .from(DOC2QUIZ_BUCKET)
          .upload(storagePath, file, {
            contentType: mimeType,
            upsert: true,
          });
        if (error) {
          throw new Error(error.message);
        }

        onStep?.("converting");
        const result = await postIngestJson({
          kind: "file_ref",
          storagePath,
          mimeType,
          filename: file.name,
          sizeBytes: file.size,
          workspaceId,
        });
        onStep?.("done");
        return result;
      }

      onStep?.("converting");
      const result = await postIngestMultipart(file, workspaceId);
      onStep?.("done");
      return result;
    }

    if (input.kind === "paste") {
      onStep?.("converting");
      const result = await postIngestJson({
        kind: "paste",
        text: input.text,
        workspaceId,
      });
      onStep?.("done");
      return result;
    }

    onStep?.("converting");
      const result = await postIngestJson({
        kind: "youtube",
        url: input.url,
        workspaceId,
      });
    onStep?.("done");
    return result;
  } catch (error) {
    onStep?.("error");
    throw mapNetworkError(error);
  }
}
