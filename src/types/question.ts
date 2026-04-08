export type AiProvider = "openai" | "anthropic" | "custom";

/** How `sourcePageIndex` / `ocrPageIndex` were chosen (debug + future crop). */
export type QuestionPageMappingMethod =
  | "vision_provenance"
  | "vision_single_page"
  | "ocr_text_overlap"
  | "layout_chunk"
  | "unresolved";

/** Optional image attachments stored in IndexedDB `media` store; ids are unique per blob */
export type Question = {
  id: string;
  question: string;
  options: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
  questionImageId?: string;
  optionImageIds?: [
    string | undefined,
    string | undefined,
    string | undefined,
    string | undefined,
  ];
  /** 1-based page index from the source PDF where this question originated (OCR/vision only). */
  sourcePageIndex?: number;
  /** Media ID of the source page image attached to this question (trace to IndexedDB media store). */
  sourceImageMediaId?: string;
  /** 1-based page index for the page raster used as the question reference image (usually equals `sourcePageIndex` when attach succeeded). */
  imagePageIndex?: number;
  /** 1-based OCR run page row used for overlap / region checks. */
  ocrPageIndex?: number;
  mappingMethod?: QuestionPageMappingMethod;
  /** 0..1 confidence; low or `unresolved` means do not rely on page for automation. */
  mappingConfidence?: number;
  /** Short explanation for inspector / logs. */
  mappingReason?: string;
  /** True when mapped OCR page has at least one `cropReady` bbox (see `ocrRegionVerify`). */
  verifiedRegionAvailable?: boolean;
  /** Stable id of the OCR layout chunk this row was extracted from (chunk-parse path). */
  layoutChunkId?: string;
  /** Model / pipeline confidence for the extraction step (0..1). */
  parseConfidence?: number;
  /** True when structure passed validation (four options, correctIndex in range). */
  parseStructureValid?: boolean;
};

export type ApprovedBank = {
  version: 1;
  savedAt: string;
  questions: Question[];
};

/** localStorage keys — character-for-character per 02-CONTEXT D-04 */
export const LS_PROVIDER = "doc2quiz:ai:provider";
export const LS_OPENAI_KEY = "doc2quiz:ai:openaiKey";
export const LS_ANTHROPIC_KEY = "doc2quiz:ai:anthropicKey";
export const LS_OPENAI_URL = "doc2quiz:ai:openaiUrl";
export const LS_ANTHROPIC_URL = "doc2quiz:ai:anthropicUrl";
export const LS_CUSTOM_KEY = "doc2quiz:ai:customKey";
export const LS_CUSTOM_URL = "doc2quiz:ai:customUrl";
export const LS_OPENAI_MODEL = "doc2quiz:ai:openaiModel";
export const LS_ANTHROPIC_MODEL = "doc2quiz:ai:anthropicModel";
export const LS_CUSTOM_MODEL = "doc2quiz:ai:customModel";
export const LS_DRAFT_QUESTIONS = "doc2quiz:ai:draftQuestions";
export const LS_APPROVED_BANK = "doc2quiz:bank:approvedSet";
