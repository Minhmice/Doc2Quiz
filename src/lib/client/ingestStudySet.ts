/**
 * Legacy study-set ingest client.
 * New owned create flow uses `ingestWorkspaceSource` → POST /api/workspaces/ingest.
 * Keep this module for existing study-set routes until 09-07/09-08 adapters retire it.
 */
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import { createStudySetEarlyMeta } from "@/lib/client/studySetDb";
import type { IngestJsonBody } from "@/lib/pipeline/ingestSchemas";
import {
  isSupportedMimeType,
  type SupportedMimeType,
} from "@/lib/pipeline/validation";
import type { StudyContentKind } from "@/types/studySet";

export type IngestUiStep =
  | "idle"
  | "validating"
  | "uploading"
  | "converting"
  | "done"
  | "error";

const MULTIPART_THRESHOLD_BYTES = 10 * 1024 * 1024;
const DOC2QUIZ_BUCKET = "doc2quiz";

export type IngestSourceInput =
  | { kind: "file"; file: File }
  | { kind: "paste"; text: string }
  | { kind: "youtube"; url: string };

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

async function postIngestJson(
  studySetId: string,
  body: IngestJsonBody,
): Promise<void> {
  const res = await fetch(`/api/study-sets/${studySetId}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      payload.message ??
        payload.error ??
        "Conversion failed. Try a different file or paste the text directly.",
    );
  }
}

async function postIngestMultipart(
  studySetId: string,
  file: File,
): Promise<void> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/study-sets/${studySetId}/ingest`, {
    method: "POST",
    body: form,
  });
  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  if (!res.ok) {
    throw new Error(
      payload.message ??
        payload.error ??
        "Conversion failed. Try a different file or paste the text directly.",
    );
  }
}

/** @deprecated Use `ingestWorkspaceSource`; retained only for legacy study-set callers. */
export async function ingestStudySetSource(params: {
  input: IngestSourceInput;
  contentKind: StudyContentKind;
  title?: string;
  onStep?: (step: IngestUiStep) => void;
}): Promise<string> {
  const { input, contentKind, onStep } = params;
  const title =
    params.title ??
    (input.kind === "file"
      ? input.file.name.replace(/\.[^.]+$/, "") || "New study set"
      : contentKind === "flashcards"
        ? "New flip study"
        : "New practice set");

  onStep?.("validating");

  const studySetId = await createStudySetEarlyMeta({ title, contentKind });
  const userId = await requireUserId();
  const supabase = createSupabaseBrowserClient();

  try {
    if (input.kind === "file") {
      const file = input.file;
      const mimeType = resolveMimeType(file);

      if (file.size > MULTIPART_THRESHOLD_BYTES) {
        onStep?.("uploading");
        const storagePath = `${userId}/${studySetId}/${sanitizeFilename(file.name)}`;
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
        await postIngestJson(studySetId, {
          kind: "file_ref",
          storagePath,
          mimeType,
          filename: file.name,
          sizeBytes: file.size,
        });
      } else {
        onStep?.("converting");
        await postIngestMultipart(studySetId, file);
      }
    } else if (input.kind === "paste") {
      onStep?.("converting");
      await postIngestJson(studySetId, {
        kind: "paste",
        text: input.text,
      });
    } else {
      onStep?.("converting");
      await postIngestJson(studySetId, {
        kind: "youtube",
        url: input.url,
      });
    }

    onStep?.("done");
    return studySetId;
  } catch (error) {
    onStep?.("error");
    if (error instanceof TypeError) {
      throw new Error("Connection lost. Check your network and try again.");
    }
    throw error;
  }
}
