import { createRandomUuid } from "@/lib/ids/createRandomUuid";
import type { Question, QuestionPageMappingMethod } from "@/types/question";

const MAPPING_METHODS = new Set<QuestionPageMappingMethod>([
  "vision_provenance",
  "vision_single_page",
  "ocr_text_overlap",
  "layout_chunk",
  "unresolved",
]);

function parseMappingMethod(
  v: unknown,
): QuestionPageMappingMethod | undefined {
  return typeof v === "string" && MAPPING_METHODS.has(v as QuestionPageMappingMethod)
    ? (v as QuestionPageMappingMethod)
    : undefined;
}

function extractQuestionsArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) {
    return raw;
  }
  if (raw !== null && typeof raw === "object" && "questions" in raw) {
    const q = (raw as { questions: unknown }).questions;
    if (Array.isArray(q)) {
      return q;
    }
  }
  return [];
}

export type ValidateQuestionsOptions = {
  /** When true, reuse `id` from each item if it is a non-empty string (draft round-trip). */
  preserveIds?: boolean;
};

/**
 * Validates model JSON (top-level `{ questions: [...] }` or a raw array per D-12)
 * and returns only well-formed MCQs with new ids unless `preserveIds` is set for draft load.
 */
export function validateQuestionsFromJson(
  raw: unknown,
  options?: ValidateQuestionsOptions,
): Question[] {
  const items = extractQuestionsArray(raw);
  const out: Question[] = [];
  const preserveIds = options?.preserveIds === true;

  for (const item of items) {
    if (item === null || typeof item !== "object") {
      continue;
    }
    const rec = item as Record<string, unknown>;
    const question = rec.question;
    const options = rec.options;
    const correctIndex = rec.correctIndex;

    if (typeof question !== "string" || question.trim().length === 0) {
      continue;
    }
    if (!Array.isArray(options) || options.length !== 4) {
      continue;
    }
    if (
      !options.every(
        (o): o is string => typeof o === "string" && o.trim().length > 0,
      )
    ) {
      continue;
    }
    if (
      typeof correctIndex !== "number" ||
      !Number.isInteger(correctIndex) ||
      correctIndex < 0 ||
      correctIndex > 3
    ) {
      continue;
    }

    const existingId = rec.id;
    const id =
      preserveIds &&
      typeof existingId === "string" &&
      existingId.trim().length > 0
        ? existingId.trim()
        : createRandomUuid();

    const qImg = rec.questionImageId;
    const optImgs = rec.optionImageIds;
    const questionImageId =
      typeof qImg === "string" && qImg.trim().length > 0
        ? qImg.trim()
        : undefined;
    let optionImageIds:
      | [
          string | undefined,
          string | undefined,
          string | undefined,
          string | undefined,
        ]
      | undefined;
    if (Array.isArray(optImgs) && optImgs.length === 4) {
      const tuple = optImgs.map((x) =>
        typeof x === "string" && x.trim().length > 0 ? x.trim() : undefined,
      ) as [
        string | undefined,
        string | undefined,
        string | undefined,
        string | undefined,
      ];
      if (tuple.some(Boolean)) {
        optionImageIds = tuple;
      }
    }

    const spi = rec.sourcePageIndex;
    const sourcePageIndex =
      typeof spi === "number" &&
      Number.isInteger(spi) &&
      spi >= 1
        ? spi
        : undefined;
    const sim = rec.sourceImageMediaId;
    const sourceImageMediaId =
      typeof sim === "string" && sim.trim().length > 0
        ? sim.trim()
        : undefined;

    const ipi = rec.imagePageIndex;
    const imagePageIndex =
      typeof ipi === "number" &&
      Number.isInteger(ipi) &&
      ipi >= 1
        ? ipi
        : undefined;
    const opi = rec.ocrPageIndex;
    const ocrPageIndex =
      typeof opi === "number" &&
      Number.isInteger(opi) &&
      opi >= 1
        ? opi
        : undefined;
    const mappingMethod = parseMappingMethod(rec.mappingMethod);
    const mc = rec.mappingConfidence;
    const mappingConfidence =
      typeof mc === "number" && Number.isFinite(mc) && mc >= 0 && mc <= 1
        ? mc
        : undefined;
    const mr = rec.mappingReason;
    const mappingReason =
      typeof mr === "string" && mr.trim().length > 0
        ? mr.trim().slice(0, 600)
        : undefined;
    const vra = rec.verifiedRegionAvailable;
    const verifiedRegionAvailable =
      typeof vra === "boolean" ? vra : undefined;

    const lcid = rec.layoutChunkId;
    const layoutChunkId =
      typeof lcid === "string" && lcid.trim().length > 0
        ? lcid.trim()
        : undefined;
    const pc = rec.parseConfidence;
    const parseConfidence =
      typeof pc === "number" && Number.isFinite(pc) && pc >= 0 && pc <= 1
        ? pc
        : undefined;
    const psv = rec.parseStructureValid;
    const parseStructureValid =
      typeof psv === "boolean" ? psv : undefined;

    out.push({
      id,
      question: question.trim(),
      options: [
        (options[0] as string).trim(),
        (options[1] as string).trim(),
        (options[2] as string).trim(),
        (options[3] as string).trim(),
      ] as [string, string, string, string],
      correctIndex: correctIndex as 0 | 1 | 2 | 3,
      ...(questionImageId ? { questionImageId } : {}),
      ...(optionImageIds ? { optionImageIds } : {}),
      ...(sourcePageIndex !== undefined ? { sourcePageIndex } : {}),
      ...(sourceImageMediaId ? { sourceImageMediaId } : {}),
      ...(imagePageIndex !== undefined ? { imagePageIndex } : {}),
      ...(ocrPageIndex !== undefined ? { ocrPageIndex } : {}),
      ...(mappingMethod ? { mappingMethod } : {}),
      ...(mappingConfidence !== undefined ? { mappingConfidence } : {}),
      ...(mappingReason ? { mappingReason } : {}),
      ...(verifiedRegionAvailable !== undefined
        ? { verifiedRegionAvailable }
        : {}),
      ...(layoutChunkId ? { layoutChunkId } : {}),
      ...(parseConfidence !== undefined ? { parseConfidence } : {}),
      ...(parseStructureValid !== undefined
        ? { parseStructureValid }
        : {}),
    });
  }

  return out;
}
