import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import { createSupabaseBrowserClient } from "@/lib/client/supabase";
import type { ApprovedFlashcardBank } from "@/types/flashcard";
import type { ApprovedBank, Question } from "@/types/question";
import type {
  StudyContentKind,
  StudySetDocumentRecord,
  StudySetMeta,
  PipelineStage,
} from "@/types/studySet";

export type { ApprovedBank, ApprovedFlashcardBank };
export type { StudySetMeta, StudySetDocumentRecord, StudyContentKind };

type StudySetRow = {
  id: string;
  user_id: string;
  title: string;
  subtitle: string | null;
  pipeline_stage: PipelineStage;
  content_kind: StudyContentKind | null;
  created_at: string;
  updated_at: string;
};

const STUDY_SET_META_SELECT =
  "id,user_id,title,subtitle,pipeline_stage,content_kind,created_at,updated_at";

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
    pipelineStage: row.pipeline_stage,
  };
  if (row.subtitle) {
    meta.subtitle = row.subtitle;
  }
  if (row.content_kind) {
    meta.contentKind = row.content_kind;
  }
  return meta;
}

type ApprovedQuestionRow = {
  id: string;
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  source: unknown;
};

function questionToRow(q: Question): {
  prompt: string;
  choices: string[];
  correct_index: number;
  explanation: string | null;
  tags: string[];
  source: Record<string, unknown>;
} {
  const source: Record<string, unknown> = {};
  if (q.sourceChunkId) {
    source.concept_id = q.sourceChunkId;
  }
  return {
    prompt: q.question,
    choices: q.options as unknown as string[],
    correct_index: q.correctIndex,
    explanation: q.explanation ?? null,
    tags: q.sourceChunkId ? [q.sourceChunkId] : [],
    source,
  };
}

function rowToQuestion(row: ApprovedQuestionRow): Question {
  const source =
    row.source && typeof row.source === "object"
      ? (row.source as { concept_id?: string })
      : {};
  const question: Question = {
    id: row.id,
    question: row.prompt,
    options: row.choices as Question["options"],
    correctIndex: row.correct_index as Question["correctIndex"],
  };
  if (row.explanation) {
    question.explanation = row.explanation;
  }
  if (source.concept_id) {
    question.sourceChunkId = source.concept_id;
  }
  return question;
}

type ApprovedFlashcardRow = {
  id: string;
  front: string;
  back: string;
  tags: string[];
  source: unknown;
};

function rowToFlashcardItem(row: ApprovedFlashcardRow): {
  id: string;
  front: string;
  back: string;
} {
  return {
    id: row.id,
    front: row.front,
    back: row.back,
  };
}

export async function getApprovedFlashcardBank(
  studySetId: string,
): Promise<ApprovedFlashcardBank | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("approved_flashcards")
    .select("id,front,back,tags,source,updated_at")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .order("updated_at", { ascending: true });
  assertNoError(error, "getApprovedFlashcardBank failed");
  const rows = (data ?? []) as ApprovedFlashcardRow[];
  if (rows.length === 0) {
    return null;
  }
  const items = rows.map(rowToFlashcardItem);
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
    .select("id,tags,source")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId);
  assertNoError(exErr, "approved_flashcards list failed");
  const existingById = new Map(
    (existingRows ?? []).map((r) => {
      const row = r as { id: string; tags: string[]; source: unknown };
      return [row.id, row] as const;
    }),
  );
  const existingIds = new Set(existingById.keys());

  const upserts = bank.items.map((it) => {
    const id =
      it.id && it.id.trim().length > 0 ? it.id : createRandomUuid();
    const existing = existingById.get(id);
    return {
      id,
      user_id: userId,
      study_set_id: studySetId,
      front: it.front,
      back: it.back,
      tags: existing?.tags ?? [],
      source: existing?.source ?? {},
      updated_at: bank.savedAt,
    };
  });

  if (upserts.length > 0) {
    const { error: upErr } = await supabase
      .from("approved_flashcards")
      .upsert(upserts, {
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
}

export async function listStudySetMetas(): Promise<StudySetMeta[]> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("study_sets")
    .select(STUDY_SET_META_SELECT)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  assertNoError(error, "listStudySetMetas failed");
  return ((data ?? []) as StudySetRow[]).map(metaFromRow);
}

export async function getStudySetMeta(
  id: string,
): Promise<StudySetMeta | undefined> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("study_sets")
    .select(STUDY_SET_META_SELECT)
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  assertNoError(error, "getStudySetMeta failed");
  return data ? metaFromRow(data as StudySetRow) : undefined;
}

export async function putStudySetMeta(meta: StudySetMeta): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { error } = await supabase
    .from("study_sets")
    .update({
      title: meta.title,
      subtitle: meta.subtitle ?? null,
      pipeline_stage: meta.pipelineStage,
      content_kind: meta.contentKind ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", meta.id)
    .eq("user_id", userId);
  assertNoError(error, "putStudySetMeta failed");
}

export async function deleteStudySet(id: string): Promise<void> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { error } = await supabase
    .from("study_sets")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  assertNoError(error, "deleteStudySet failed");
}

export async function getDocument(
  _studySetId: string,
): Promise<StudySetDocumentRecord | undefined> {
  return undefined;
}

export async function putDocument(_doc: StudySetDocumentRecord): Promise<void> {}

export async function ensureStudySetDb(): Promise<void> {}

export async function getApprovedBank(
  studySetId: string,
): Promise<ApprovedBank | null> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("approved_questions")
    .select("id,prompt,choices,correct_index,explanation,source,updated_at")
    .eq("user_id", userId)
    .eq("study_set_id", studySetId)
    .order("updated_at", { ascending: true });
  assertNoError(error, "getApprovedBank failed");
  const rows = (data ?? []) as ApprovedQuestionRow[];
  if (rows.length === 0) {
    return null;
  }
  const questions = rows.map(rowToQuestion);
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
  const existingIds = new Set(
    (existingRows ?? []).map((r) => (r as { id: string }).id),
  );

  const upserts = bank.questions.map((q) => ({
    id: q.id,
    user_id: userId,
    study_set_id: studySetId,
    ...questionToRow(q),
    updated_at: bank.savedAt,
  }));

  if (upserts.length > 0) {
    const { error: upErr } = await supabase
      .from("approved_questions")
      .upsert(upserts, {
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
}

export function newStudySetId(): string {
  return createRandomUuid();
}

export async function createStudySetEarlyMeta(input: {
  title: string;
  subtitle?: string;
  contentKind?: StudyContentKind;
}): Promise<string> {
  const supabase = createSupabaseBrowserClient();
  const userId = await requireUserId();
  const id = createRandomUuid();
  const now = new Date().toISOString();
  const { error } = await supabase.from("study_sets").insert({
    id,
    user_id: userId,
    title: input.title,
    subtitle: input.subtitle ?? null,
    pipeline_stage: "input",
    content_kind: input.contentKind ?? null,
    created_at: now,
    updated_at: now,
  });
  assertNoError(error, "createStudySetEarlyMeta failed");
  return id;
}

export async function createStudySet(input: {
  title: string;
  subtitle?: string;
  extractedText: string;
  contentKind?: StudyContentKind;
}): Promise<string> {
  return createStudySetEarlyMeta({
    title: input.title,
    subtitle: input.subtitle,
    contentKind: input.contentKind,
  });
}

export async function touchStudySetMeta(
  id: string,
  patch: Partial<
    Pick<StudySetMeta, "title" | "subtitle" | "pipelineStage" | "sourceFileName">
  >,
): Promise<void> {
  const existing = await getStudySetMeta(id);
  if (!existing) {
    throw new Error("Study set not found");
  }
  await putStudySetMeta({
    ...existing,
    ...patch,
    title: patch.title ?? existing.title,
    pipelineStage: patch.pipelineStage ?? existing.pipelineStage,
  });
}
