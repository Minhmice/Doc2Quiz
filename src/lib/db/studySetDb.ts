import { generateStudySetTitle } from "@/lib/ai/generateStudySetTitle";
import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import {
  fileSummary,
  normalizeUnknownError,
  pipelineLog,
} from "@/lib/logging/pipelineLogger";
import { extractPdfText } from "@/lib/pdf/extractPdfText";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { ApprovedBank, Question } from "@/types/question";
import type {
  ApprovedFlashcardBank,
  FlashcardVisionItem,
} from "@/types/visionParse";
import type {
  ParseProgressRecord,
  StudyContentKind,
  StudySetDocumentRecord,
  StudySetMeta,
} from "@/types/studySet";

const STORAGE_BUCKET = "doc2quiz";

type StudySetRow = {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  status: StudySetMeta["status"];
  content_kind: StudyContentKind | null;
  source_file_name: string | null;
  page_count: number | null;
  ocr_provider: string | null;
  ocr_status: string | null;
  created_at: string;
  updated_at: string;
  parse_progress?: unknown | null;
};

const STUDY_SET_META_SELECT_WITH_PARSE_PROGRESS =
  "id,user_id,title,subtitle,status,content_kind,source_file_name,page_count,ocr_provider,ocr_status,created_at,updated_at,parse_progress";

const STUDY_SET_META_SELECT_WITHOUT_PARSE_PROGRESS =
  "id,user_id,title,subtitle,status,content_kind,source_file_name,page_count,ocr_provider,ocr_status,created_at,updated_at";

function isMissingParseProgressColumnError(error: unknown): boolean {
  const msg = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("parse_progress") &&
    (msg.includes("does not exist") ||
      msg.includes("could not find") ||
      msg.includes("schema cache"))
  );
}

type StudySetInsertRow = {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  status: StudySetMeta["status"];
  content_kind: StudyContentKind | null;
  source_file_name: string | null;
  page_count: number | null;
  created_at: string;
  updated_at: string;
};

async function insertStudySetRowAllowLegacyDb(
  supabase: ReturnType<typeof createSupabaseBrowserClient>,
  row: StudySetInsertRow,
): Promise<void> {
  let { error } = await supabase.from("study_sets").insert({
    ...row,
    parse_progress: {},
  });
  if (error && isMissingParseProgressColumnError(error)) {
    const retry = await supabase.from("study_sets").insert(row);
    error = retry.error;
  }
  assertNoError(error, "study_sets insert failed");
}

type StudySetDocumentRow = {
  id: string;
  user_id: string;
  study_set_id: string;
  extracted_text: string;
  page_count: number | null;
  source_file_name: string | null;
  source_pdf_asset_id: string | null;
  extracted_at: string | null;
  updated_at: string;
};

type MediaAssetRow = {
  id: string;
  user_id: string;
  study_set_id: string;
  document_id: string | null;
  kind: "page_image" | "attachment";
  bucket: string;
  object_path: string;
  mime_type: string | null;
  byte_size: number | null;
  page_number: number | null;
};

const pdfBufferCache = new Map<string, ArrayBuffer>();

function assertNoError(err: unknown, message: string): void {
  if (!err) {
    return;
  }
  const e = err as { message?: string };
  throw new Error(e.message ?? message);
}

async function requireUserId(): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  assertNoError(error, "auth.getUser failed");
  if (!user) {
    throw new Error("Not authenticated");
  }
  return user.id;
}

function metaFromRow(row: StudySetRow): StudySetMeta {
  const meta: StudySetMeta = {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
  };
  if (row.subtitle) {
    meta.subtitle = row.subtitle;
  }
  if (row.source_file_name) {
    meta.sourceFileName = row.source_file_name;
  }
  if (row.page_count !== null && row.page_count !== undefined) {
    meta.pageCount = row.page_count;
  }
  if (row.content_kind) {
    meta.contentKind = row.content_kind;
  }
  if (row.ocr_provider) {
    meta.ocrProvider = row.ocr_provider;
  }
  if (row.ocr_status) {
    meta.ocrStatus = row.ocr_status as StudySetMeta["ocrStatus"];
  }
  return meta;
}

async function downloadStorageObject(
  bucket: string,
  objectPath: string,
): Promise<ArrayBuffer> {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.storage
    .from(bucket)
    .download(objectPath);
  assertNoError(error, "storage.download failed");
  if (!data) {
    throw new Error("storage.download returned empty body");
  }
  return await data.arrayBuffer();
}

async function uploadStorageObject(params: {
  bucket: string;
  objectPath: string;
  bytes: Uint8Array;
  contentType: string;
}): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(params.bucket).upload(params.objectPath, params.bytes, {
    upsert: true,
    contentType: params.contentType,
  });
  assertNoError(error, "storage.upload failed");
}

async function deleteStorageObject(bucket: string, objectPath: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const { error } = await supabase.storage.from(bucket).remove([objectPath]);
  if (error) {
    pipelineLog("STUDY_SET", "storage-delete", "warn", "storage.remove failed", {
      bucket,
      objectPath,
      ...normalizeUnknownError(error),
      raw: error,
    });
  }
}

async function listMediaAssetsForStudySet(studySetId: string): Promise<MediaAssetRow[]> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("media_assets")
    .select(
      "id,user_id,study_set_id,document_id,kind,bucket,object_path,mime_type,byte_size,page_number",
    )
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  assertNoError(error, "media_assets list failed");
  return (data ?? []) as MediaAssetRow[];
}

function questionToRow(q: Question): Record<string, unknown> {
  return {
    prompt: q.question,
    choices: q.options as unknown as string[],
    correct_index: q.correctIndex,
    explanation: null,
    tags: [],
    source: q as unknown as Record<string, unknown>,
  };
}

function rowToQuestion(row: {
  id: string;
  prompt: string;
  choices: string[];
  correct_index: number;
  source: unknown;
}): Question {
  const fromSource =
    row.source && typeof row.source === "object"
      ? (row.source as Partial<Question>)
      : {};
  const base: Question = {
    id: row.id,
    question: row.prompt,
    options: row.choices as Question["options"],
    correctIndex: row.correct_index as Question["correctIndex"],
  };
  return { ...base, ...fromSource, id: row.id, question: row.prompt, options: base.options, correctIndex: base.correctIndex };
}

function isLegacyFlashcardCarrierQuestion(q: Question): boolean {
  return (
    q.correctIndex === 0 &&
    q.options[1] === "—" &&
    q.options[2] === "—" &&
    q.options[3] === "—"
  );
}

async function migrateLegacyFlashcardCarrierToApprovedFlashcards(
  studySetId: string,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const metaRes = await supabase
    .from("study_sets")
    .select("content_kind")
    .eq("user_id", userId)
    .eq("id", studySetId)
    .maybeSingle();
  assertNoError(metaRes.error, "study_sets select failed");
  const contentKind = (metaRes.data as { content_kind: StudyContentKind | null } | null)
    ?.content_kind;
  if (contentKind !== "flashcards") {
    return;
  }

  const bank = await getApprovedBank(studySetId);
  if (!bank || bank.questions.length === 0) {
    return;
  }
  if (!bank.questions.every(isLegacyFlashcardCarrierQuestion)) {
    return;
  }

  const items: FlashcardVisionItem[] = bank.questions
    .map((q) => ({
      kind: "flashcard" as const,
      id: q.id,
      front: q.question.trim(),
      back: (q.options[q.correctIndex] ?? "").trim(),
      confidence: typeof q.parseConfidence === "number" ? q.parseConfidence : 0.5,
      sourcePages:
        q.sourcePageIndex !== undefined && q.sourcePageIndex >= 1
          ? [q.sourcePageIndex]
          : undefined,
    }))
    .filter((c) => c.front.length > 0 && c.back.length > 0);
  const savedAt = new Date().toISOString();
  await putApprovedFlashcardBankForStudySet(studySetId, {
    version: 1,
    savedAt,
    items,
  });
}

export async function ensureStudySetDb(): Promise<void> {
  await requireUserId();
}

export async function listStudySetMetas(): Promise<StudySetMeta[]> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  let { data, error } = await supabase
    .from("study_sets")
    .select(STUDY_SET_META_SELECT_WITH_PARSE_PROGRESS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error && isMissingParseProgressColumnError(error)) {
    const retry = await supabase
      .from("study_sets")
      .select(STUDY_SET_META_SELECT_WITHOUT_PARSE_PROGRESS)
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });
    data = retry.data as typeof data;
    error = retry.error;
  }
  assertNoError(error, "listStudySetMetas failed");
  return ((data ?? []) as StudySetRow[]).map(metaFromRow);
}

export async function getStudySetMeta(id: string): Promise<StudySetMeta | undefined> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  let { data, error } = await supabase
    .from("study_sets")
    .select(STUDY_SET_META_SELECT_WITH_PARSE_PROGRESS)
    .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();
    if (error && isMissingParseProgressColumnError(error)) {
      const retry = await supabase
        .from("study_sets")
        .select(STUDY_SET_META_SELECT_WITHOUT_PARSE_PROGRESS)
        .eq("user_id", userId)
        .eq("id", id)
        .maybeSingle();
      data = retry.data as typeof data;
    error = retry.error;
  }
  assertNoError(error, "getStudySetMeta failed");
  if (!data) {
    return undefined;
  }
  return metaFromRow(data as StudySetRow);
}

export async function putStudySetMeta(meta: StudySetMeta): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { error } = await supabase
    .from("study_sets")
    .update({
      title: meta.title,
      subtitle: meta.subtitle ?? null,
      status: meta.status,
      content_kind: meta.contentKind ?? null,
      source_file_name: meta.sourceFileName ?? null,
      page_count: meta.pageCount ?? null,
      ocr_provider: meta.ocrProvider ?? null,
      ocr_status: meta.ocrStatus ?? null,
      updated_at: meta.updatedAt,
    })
    .eq("user_id", userId)
    .eq("id", meta.id);
  assertNoError(error, "putStudySetMeta failed");
}

export async function clearOcrMetaFields(id: string): Promise<void> {
  const existing = await getStudySetMeta(id);
  if (!existing) {
    return;
  }
  const next: StudySetMeta = {
    ...existing,
    updatedAt: new Date().toISOString(),
  };
  delete (next as Record<string, unknown>).ocrProvider;
  delete (next as Record<string, unknown>).ocrStatus;
  await putStudySetMeta(next);
}

export async function deleteStudySet(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();

  const assets = await listMediaAssetsForStudySet(id);
  for (const a of assets) {
    await deleteStorageObject(a.bucket, a.object_path);
  }

  const { error } = await supabase.from("study_sets").delete().eq("user_id", userId).eq("id", id);
  assertNoError(error, "deleteStudySet failed");
  pdfBufferCache.delete(id);
}

export async function getDocument(
  studySetId: string,
): Promise<StudySetDocumentRecord | undefined> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("study_set_documents")
    .select(
      "id,user_id,study_set_id,extracted_text,page_count,source_file_name,source_pdf_asset_id,extracted_at,updated_at",
    )
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .maybeSingle();
  assertNoError(error, "getDocument failed");
  if (!data) {
    return undefined;
  }
  const row = data as StudySetDocumentRow;
  const doc: StudySetDocumentRecord = {
    studySetId: row.study_set_id,
    extractedText: row.extracted_text,
    pdfFileName: row.source_file_name ?? undefined,
  };

  if (row.source_pdf_asset_id) {
    const { data: asset, error: aErr } = await supabase
      .from("media_assets")
      .select("bucket,object_path")
      .eq("user_id", userId)
      .eq("id", row.source_pdf_asset_id)
      .maybeSingle();
    assertNoError(aErr, "media_assets lookup failed");
    if (asset) {
      const cached = pdfBufferCache.get(studySetId);
      if (cached) {
        doc.pdfArrayBuffer = cached;
      } else {
        const buf = await downloadStorageObject(
          (asset as { bucket: string; object_path: string }).bucket,
          (asset as { bucket: string; object_path: string }).object_path,
        );
        pdfBufferCache.set(studySetId, buf);
        doc.pdfArrayBuffer = buf;
      }
    }
  }

  return doc;
}

export async function putDocument(doc: StudySetDocumentRecord): Promise<void> {
  pipelineLog("STUDY_SET", "document-put", "info", "putDocument start", {
    studySetId: doc.studySetId,
    pdfFileName: doc.pdfFileName,
    hasPdfBuffer: Boolean(doc.pdfArrayBuffer),
    pdfBufferByteLength: doc.pdfArrayBuffer?.byteLength,
    extractedTextChars: doc.extractedText.length,
  });
  try {
    const supabase = createSupabaseBrowserClient();
    const userId = await requireUserId();

    const { data: existing, error: exErr } = await supabase
      .from("study_set_documents")
      .select(
        "id,user_id,study_set_id,extracted_text,page_count,source_file_name,source_pdf_asset_id,extracted_at,updated_at",
      )
      .eq("user_id", userId)
      .eq("study_set_id", doc.studySetId)
      .maybeSingle();
    assertNoError(exErr, "study_set_documents lookup failed");
    const existingRow = existing as StudySetDocumentRow | null;

    let documentId = existingRow?.id;
    let pdfAssetId = existingRow?.source_pdf_asset_id ?? null;

    if (doc.pdfArrayBuffer && doc.pdfArrayBuffer.byteLength > 0) {
      pdfBufferCache.set(doc.studySetId, doc.pdfArrayBuffer);
      const bytes = new Uint8Array(doc.pdfArrayBuffer);
      const objectPath = `${userId}/${doc.studySetId}/source.pdf`;

      if (!pdfAssetId) {
        pdfAssetId = createRandomUuid();
        const { error: insA } = await supabase.from("media_assets").insert({
          id: pdfAssetId,
          user_id: userId,
          study_set_id: doc.studySetId,
          document_id: documentId ?? null,
          kind: "attachment",
          bucket: STORAGE_BUCKET,
          object_path: objectPath,
          mime_type: "application/pdf",
          byte_size: bytes.byteLength,
          page_number: null,
          metadata: {},
        });
        assertNoError(insA, "media_assets insert (pdf) failed");
      } else {
        const { error: updA } = await supabase
          .from("media_assets")
          .update({
            mime_type: "application/pdf",
            byte_size: bytes.byteLength,
            object_path: objectPath,
            bucket: STORAGE_BUCKET,
          })
          .eq("user_id", userId)
          .eq("id", pdfAssetId);
        assertNoError(updA, "media_assets update (pdf) failed");
      }

      await uploadStorageObject({
        bucket: STORAGE_BUCKET,
        objectPath,
        bytes,
        contentType: "application/pdf",
      });
    }

    const nowIso = new Date().toISOString();
    if (!documentId) {
      documentId = createRandomUuid();
      const { error: insD } = await supabase.from("study_set_documents").insert({
        id: documentId,
        user_id: userId,
        study_set_id: doc.studySetId,
        extracted_text: doc.extractedText,
        page_count: null,
        source_file_name: doc.pdfFileName ?? null,
        source_pdf_asset_id: pdfAssetId,
        extracted_at: nowIso,
      });
      assertNoError(insD, "study_set_documents insert failed");

      if (pdfAssetId) {
        const { error: linkErr } = await supabase
          .from("media_assets")
          .update({ document_id: documentId })
          .eq("user_id", userId)
          .eq("id", pdfAssetId);
        assertNoError(linkErr, "media_assets link document_id failed");
      }
    } else {
      const { error: updD } = await supabase
        .from("study_set_documents")
        .update({
          extracted_text: doc.extractedText,
          source_file_name: doc.pdfFileName ?? null,
          source_pdf_asset_id: pdfAssetId,
          extracted_at: nowIso,
        })
        .eq("user_id", userId)
        .eq("id", documentId);
      assertNoError(updD, "study_set_documents update failed");
    }

    pipelineLog("STUDY_SET", "document-put", "info", "putDocument success", {
      studySetId: doc.studySetId,
    });
  } catch (raw) {
    pipelineLog("STUDY_SET", "document-put", "error", "putDocument failed", {
      studySetId: doc.studySetId,
      ...normalizeUnknownError(raw),
      raw,
    });
    throw raw;
  }
}

export async function getParseProgressRecord(
  studySetId: string,
): Promise<ParseProgressRecord | undefined> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("study_sets")
    .select("parse_progress")
    .eq("user_id", userId)
    .eq("id", studySetId)
    .maybeSingle();
  if (error && isMissingParseProgressColumnError(error)) {
    return undefined;
  }
  assertNoError(error, "getParseProgressRecord failed");
  if (!data) {
    return undefined;
  }
  const raw = (data as { parse_progress: unknown }).parse_progress;
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const p = raw as Partial<ParseProgressRecord>;
  if (
    p.studySetId !== studySetId ||
    typeof p.updatedAt !== "string" ||
    typeof p.running !== "boolean" ||
    typeof p.phase !== "string" ||
    typeof p.current !== "number" ||
    typeof p.total !== "number"
  ) {
    return undefined;
  }
  return p as ParseProgressRecord;
}

export async function putParseProgressRecord(record: ParseProgressRecord): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { error } = await supabase
    .from("study_sets")
    .update({ parse_progress: record })
    .eq("user_id", userId)
    .eq("id", record.studySetId);
  if (error && isMissingParseProgressColumnError(error)) {
    return;
  }
  assertNoError(error, "putParseProgressRecord failed");
}

export async function getApprovedFlashcardBank(
  studySetId: string,
): Promise<ApprovedFlashcardBank | null> {
  await migrateLegacyFlashcardCarrierToApprovedFlashcards(studySetId);

  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("approved_flashcards")
    .select("id,front,back,tags,source,updated_at")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .order("updated_at", { ascending: true });
  assertNoError(error, "getApprovedFlashcardBank failed");
  const rows = data ?? [];
  if (rows.length === 0) {
    return null;
  }
  const items: FlashcardVisionItem[] = (rows as {
    id: string;
    front: string;
    back: string;
    source: unknown;
  }[]).map((r) => {
    const fromSource =
      r.source && typeof r.source === "object"
        ? (r.source as Partial<FlashcardVisionItem>)
        : {};
    const base: FlashcardVisionItem = {
      kind: "flashcard",
      id: r.id,
      front: r.front,
      back: r.back,
      confidence: 0.5,
    };
    const merged = { ...base, ...fromSource, kind: "flashcard" as const, id: r.id, front: r.front, back: r.back };
    return merged;
  });
  const savedAt = new Date().toISOString();
  return { version: 1, savedAt, items };
}

export async function putApprovedFlashcardBankForStudySet(
  studySetId: string,
  bank: ApprovedFlashcardBank,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();

  const { data: existingRows, error: exErr } = await supabase
    .from("approved_flashcards")
    .select("id")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  assertNoError(exErr, "approved_flashcards list failed");
  const existingIds = new Set((existingRows ?? []).map((r) => (r as { id: string }).id));

  const upserts = bank.items.map((it) => {
    const id =
      it.id && it.id.trim().length > 0 ? it.id : createRandomUuid();
    const source = it as unknown as Record<string, unknown>;
    return {
      id,
      user_id: userId,
      study_set_id: studySetId,
      front: it.front,
      back: it.back,
      tags: [],
      source,
      updated_at: bank.savedAt,
    };
  });

  if (upserts.length > 0) {
    const { error: upErr } = await supabase.from("approved_flashcards").upsert(upserts, {
      onConflict: "id",
    });
    assertNoError(upErr, "approved_flashcards upsert failed");
  } else {
    const { error: delAll } = await supabase
      .from("approved_flashcards")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId);
    assertNoError(delAll, "approved_flashcards delete-all failed");
  }

  const keep = new Set(upserts.map((u) => u.id));
  const toDelete = [...existingIds].filter((id) => !keep.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("approved_flashcards")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId)
      .in("id", toDelete);
    assertNoError(delErr, "approved_flashcards delete failed");
  }

  // Flashcard lane should not leave quiz rows behind.
  const { error: delQ } = await supabase
    .from("approved_questions")
    .delete()
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  assertNoError(delQ, "approved_questions delete (flashcards) failed");
}

export async function getApprovedBank(studySetId: string): Promise<ApprovedBank | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("approved_questions")
    .select("id,prompt,choices,correct_index,source,updated_at")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .order("updated_at", { ascending: true });
  assertNoError(error, "getApprovedBank failed");
  const rows = data ?? [];
  if (rows.length === 0) {
    return null;
  }
  const questions = (rows as {
    id: string;
    prompt: string;
    choices: string[];
    correct_index: number;
    source: unknown;
  }[]).map(rowToQuestion);
  const savedAt = new Date().toISOString();
  return { version: 1, savedAt, questions };
}

export async function putApprovedBankForStudySet(
  studySetId: string,
  bank: ApprovedBank,
): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();

  const { data: existingRows, error: exErr } = await supabase
    .from("approved_questions")
    .select("id")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  assertNoError(exErr, "approved_questions list failed");
  const existingIds = new Set((existingRows ?? []).map((r) => (r as { id: string }).id));

  const upserts = bank.questions.map((q) => ({
    id: q.id,
    user_id: userId,
    study_set_id: studySetId,
    ...questionToRow(q),
    updated_at: bank.savedAt,
  }));

  if (upserts.length > 0) {
    const { error: upErr } = await supabase.from("approved_questions").upsert(upserts, {
      onConflict: "id",
    });
    assertNoError(upErr, "approved_questions upsert failed");
  } else {
    const { error: delAll } = await supabase
      .from("approved_questions")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId);
    assertNoError(delAll, "approved_questions delete-all failed");
  }

  const keep = new Set(upserts.map((u) => u.id));
  const toDelete = [...existingIds].filter((id) => !keep.has(id));
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase
      .from("approved_questions")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId)
      .in("id", toDelete);
    assertNoError(delErr, "approved_questions delete failed");
  }

  if (bank.questions.length > 0) {
    const { error: delFc } = await supabase
      .from("approved_flashcards")
      .delete()
      .eq("user_id", userId)
      .eq("study_set_id", studySetId);
    assertNoError(delFc, "approved_flashcards delete (quiz) failed");
  }
}

export async function putMediaBlob(studySetId: string, blob: Blob): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const id = createRandomUuid();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const objectPath = `${userId}/${studySetId}/media/${id}`;

  const { data: docRow, error: docErr } = await supabase
    .from("study_set_documents")
    .select("id")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .maybeSingle();
  assertNoError(docErr, "study_set_documents lookup failed");
  const documentId = (docRow as { id: string } | null)?.id ?? null;

  const { error: insA } = await supabase.from("media_assets").insert({
    id,
    user_id: userId,
    study_set_id: studySetId,
    document_id: documentId,
    kind: "page_image",
    bucket: STORAGE_BUCKET,
    object_path: objectPath,
    mime_type: blob.type || "application/octet-stream",
    byte_size: bytes.byteLength,
    page_number: null,
    metadata: {},
  });
  assertNoError(insA, "media_assets insert failed");

  await uploadStorageObject({
    bucket: STORAGE_BUCKET,
    objectPath,
    bytes,
    contentType: blob.type || "application/octet-stream",
  });

  return id;
}

export async function getMediaBlob(mediaId: string): Promise<Blob | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("media_assets")
    .select("bucket,object_path,mime_type")
    .eq("user_id", userId)
    .eq("id", mediaId)
    .maybeSingle();
  assertNoError(error, "media_assets get failed");
  if (!data) {
    return null;
  }
  const row = data as { bucket: string; object_path: string; mime_type: string | null };
  const buf = await downloadStorageObject(row.bucket, row.object_path);
  return new Blob([buf], { type: row.mime_type ?? "application/octet-stream" });
}

export async function deleteMedia(mediaId: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("media_assets")
    .select("bucket,object_path")
    .eq("user_id", userId)
    .eq("id", mediaId)
    .maybeSingle();
  assertNoError(error, "media_assets select failed");
  if (!data) {
    return;
  }
  const row = data as { bucket: string; object_path: string };
  await deleteStorageObject(row.bucket, row.object_path);
  const { error: delErr } = await supabase.from("media_assets").delete().eq("user_id", userId).eq("id", mediaId);
  assertNoError(delErr, "media_assets delete failed");
}

export function newStudySetId(): string {
  return createRandomUuid();
}

export async function createStudySetEarlyMeta(input: {
  title: string;
  subtitle?: string;
  sourceFileName?: string;
  pageCount?: number;
  extractedText?: string;
  contentKind?: StudyContentKind;
}): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const id = newStudySetId();
  const now = new Date().toISOString();

  const { error: metaErr } = await supabase.from("study_sets").insert({
    id,
    user_id: userId,
    title: input.title,
    subtitle: input.subtitle ?? null,
    status: "draft",
    content_kind: input.contentKind ?? null,
    source_file_name: input.sourceFileName ?? null,
    page_count: input.pageCount ?? null,
    parse_progress: {},
    created_at: now,
    updated_at: now,
  });
  assertNoError(metaErr, "createStudySetEarlyMeta: study_sets insert failed");

  const docId = newStudySetId();
  const { error: docErr } = await supabase.from("study_set_documents").insert({
    id: docId,
    user_id: userId,
    study_set_id: id,
    extracted_text: input.extractedText ?? "",
    page_count: input.pageCount ?? null,
    source_file_name: input.sourceFileName ?? null,
    source_pdf_asset_id: null,
    extracted_at: now,
  });
  assertNoError(docErr, "createStudySetEarlyMeta: study_set_documents insert failed");

  pipelineLog("STUDY_SET", "create", "info", "createStudySetEarlyMeta", {
    studySetId: id,
    title: input.title,
    pageCount: input.pageCount,
    sourceFileName: input.sourceFileName,
    contentKind: input.contentKind,
  });

  return id;
}

export async function enrichStudySetDocumentFromLocalPdf(input: {
  studySetId: string;
  file: File;
  pageCount: number;
  titlePrefix?: string;
}): Promise<void> {
  const { studySetId, file, pageCount, titlePrefix } = input;
  const meta = await getStudySetMeta(studySetId);
  if (!meta) {
    pipelineLog("STUDY_SET", "enrich", "warn", "enrichStudySetDocumentFromLocalPdf: no meta (cancelled?)", {
      studySetId,
    });
    return;
  }
  try {
    pipelineLog("PDF", "extract-text", "info", "enrichStudySet: extractPdfText start", {
      studySetId,
      ...fileSummary(file),
      pageCount,
    });
    const extractedText = await extractPdfText(file);
    pipelineLog("PDF", "extract-text", "info", "enrichStudySet: extractPdfText done", {
      studySetId,
      extractedCharCount: extractedText.length,
    });

    let title = meta.title;
    let subtitle = meta.subtitle;
    try {
      const naming = await generateStudySetTitle(extractedText, file.name);
      title =
        titlePrefix !== undefined && titlePrefix.length > 0
          ? `${titlePrefix}${naming.title}`
          : naming.title;
      subtitle = naming.subtitle;
    } catch (raw) {
      pipelineLog("STUDY_SET", "enrich", "warn", "generateStudySetTitle failed; keeping provisional title", {
        studySetId,
        ...normalizeUnknownError(raw),
        raw,
      });
    }

    pipelineLog("PDF", "array-buffer", "info", "enrichStudySet: reading pdf arrayBuffer", {
      studySetId,
      ...fileSummary(file),
    });
    const pdfArrayBuffer = await file.arrayBuffer();
    await putDocument({
      studySetId,
      extractedText,
      pdfArrayBuffer,
      pdfFileName: file.name,
    });
    await touchStudySetMeta(studySetId, {
      title,
      subtitle,
      pageCount,
      sourceFileName: file.name,
    });
    pipelineLog("STUDY_SET", "enrich", "info", "enrichStudySetDocumentFromLocalPdf success", {
      studySetId,
    });
  } catch (raw) {
    pipelineLog("STUDY_SET", "enrich", "error", "enrichStudySetDocumentFromLocalPdf failed", {
      studySetId,
      ...normalizeUnknownError(raw),
      raw,
    });
  }
}

export async function createStudySet(input: {
  title: string;
  subtitle?: string;
  sourceFileName?: string;
  pageCount?: number;
  extractedText: string;
  pdfFile?: File | null;
  contentKind?: StudyContentKind;
}): Promise<string> {
  const id = newStudySetId();
  const now = new Date().toISOString();
  try {
    pipelineLog("STUDY_SET", "create", "info", "createStudySet start", {
      studySetId: id,
      title: input.title,
      pageCount: input.pageCount,
      sourceFileName: input.sourceFileName,
      ...fileSummary(input.pdfFile ?? undefined),
      reusedExtractedText: input.extractedText.trim().length > 0,
    });

    let extractedTextForDoc = input.extractedText;
    if (input.pdfFile && input.pdfFile.size > 0) {
      if (input.extractedText.trim().length > 0) {
        extractedTextForDoc = input.extractedText;
      } else {
        pipelineLog("PDF", "extract-text", "info", "createStudySet: running extractPdfText (no pre text)", {
          studySetId: id,
          ...fileSummary(input.pdfFile),
        });
        extractedTextForDoc = await extractPdfText(input.pdfFile);
      }
    }

    let pdfArrayBuffer: ArrayBuffer | undefined;
    if (input.pdfFile && input.pdfFile.size > 0) {
      pipelineLog("PDF", "array-buffer", "info", "createStudySet: reading pdf arrayBuffer", {
        studySetId: id,
        ...fileSummary(input.pdfFile),
      });
      pdfArrayBuffer = await input.pdfFile.arrayBuffer();
    }

    const supabase = createSupabaseBrowserClient();
    const userId = await requireUserId();

    await insertStudySetRowAllowLegacyDb(supabase, {
      id,
      user_id: userId,
      title: input.title,
      subtitle: input.subtitle ?? null,
      status: "draft",
      content_kind: input.contentKind ?? null,
      source_file_name: input.sourceFileName ?? null,
      page_count: input.pageCount ?? null,
      created_at: now,
      updated_at: now,
    });

    const docId = newStudySetId();
    const { error: docErr } = await supabase.from("study_set_documents").insert({
      id: docId,
      user_id: userId,
      study_set_id: id,
      extracted_text: "",
      page_count: input.pageCount ?? null,
      source_file_name: input.pdfFile?.name ?? input.sourceFileName ?? null,
      source_pdf_asset_id: null,
      extracted_at: now,
    });
    assertNoError(docErr, "createStudySet: study_set_documents insert failed");

    if (pdfArrayBuffer && pdfArrayBuffer.byteLength > 0 && input.pdfFile) {
      await putDocument({
        studySetId: id,
        extractedText: extractedTextForDoc,
        pdfArrayBuffer,
        pdfFileName: input.pdfFile.name,
      });
    } else {
      const { error: txtErr } = await supabase
        .from("study_set_documents")
        .update({
          extracted_text: extractedTextForDoc,
          extracted_at: now,
        })
        .eq("user_id", userId)
        .eq("id", docId);
      assertNoError(txtErr, "createStudySet: study_set_documents text update failed");
    }

    pipelineLog("STUDY_SET", "create", "info", "createStudySet success", {
      studySetId: id,
    });
    return id;
  } catch (raw) {
    pipelineLog("STUDY_SET", "create", "error", "createStudySet failed", {
      studySetId: id,
      ...normalizeUnknownError(raw),
      raw,
    });
    throw raw;
  }
}

export async function touchStudySetMeta(
  id: string,
  patch: Partial<
    Pick<
      StudySetMeta,
      | "title"
      | "subtitle"
      | "status"
      | "pageCount"
      | "sourceFileName"
      | "ocrProvider"
      | "ocrStatus"
      | "contentKind"
    >
  >,
): Promise<void> {
  const existing = await getStudySetMeta(id);
  if (!existing) {
    return;
  }
  await putStudySetMeta({
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}
