import {
  flashcardGenPayloadSchema,
  quizGenPayloadSchema,
} from "@/lib/server/generateFromFile/schemas";
import type { StudyContentKind } from "@/types/studySet";

function stripJsonFence(text: string): string {
  const t = text.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/im.exec(t);
  if (fence?.[1]) {
    return fence[1].trim();
  }
  return t;
}

export function parseGenerationPayload(
  contentKind: StudyContentKind,
  raw: string,
):
  | { ok: true; kind: "quiz"; items: ReturnType<typeof quizGenPayloadSchema.parse>["items"] }
  | { ok: true; kind: "flashcards"; items: ReturnType<typeof flashcardGenPayloadSchema.parse>["items"] }
  | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFence(raw));
  } catch {
    return { ok: false, error: "Response was not valid JSON." };
  }

  if (contentKind === "flashcards") {
    const r = flashcardGenPayloadSchema.safeParse(parsed);
    if (!r.success) {
      return { ok: false, error: r.error.message };
    }
    return { ok: true, kind: "flashcards", items: r.data.items };
  }

  const r = quizGenPayloadSchema.safeParse(parsed);
  if (!r.success) {
    return { ok: false, error: r.error.message };
  }
  return { ok: true, kind: "quiz", items: r.data.items };
}
