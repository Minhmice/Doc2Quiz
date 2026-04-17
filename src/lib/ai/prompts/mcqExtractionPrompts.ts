import raw from "@/lib/ai/prompts/mcq-extraction.prompts.json";

type McqExtractionPromptsFile = {
  version: number;
  mcqExtraction: { system: string };
  mcqSingleChunk: { system: string };
  mcqValidator: { system: string };
  visionPageImage: { userTemplate: string };
  visionPagePair: { userTemplate: string };
};

const prompts = raw as McqExtractionPromptsFile;

/** Single source of truth for prompt bundle revision (Phase 31 / CACHE-31-04). */
export const PROMPTS_BUNDLE_VERSION = prompts.version;

/** System prompt: text chunk or vision page image → MCQ JSON (shared OpenAI / Anthropic / custom). */
export const MCQ_EXTRACTION_SYSTEM_PROMPT = prompts.mcqExtraction.system;

/** System prompt: one OCR layout chunk → at most one MCQ (text API). */
export const MCQ_SINGLE_CHUNK_SYSTEM_PROMPT = prompts.mcqSingleChunk.system;

/** Phase 32 — second pass on draft MCQ JSON (text API, OpenAI-compatible). */
export const MCQ_VALIDATOR_SYSTEM_PROMPT = prompts.mcqValidator.system;

export function visionPageUserPrompt(pageIndex: number, totalPages: number): string {
  return prompts.visionPageImage.userTemplate
    .replace(/\{\{pageIndex\}\}/g, String(pageIndex))
    .replace(/\{\{totalPages\}\}/g, String(totalPages));
}

export function visionPagePairUserPrompt(
  leftPage: number,
  rightPage: number,
  totalPages: number,
): string {
  return prompts.visionPagePair.userTemplate
    .replace(/\{\{leftPage\}\}/g, String(leftPage))
    .replace(/\{\{rightPage\}\}/g, String(rightPage))
    .replace(/\{\{totalPages\}\}/g, String(totalPages));
}

/** Include in `ParseCacheKeyParts.promptIdentity` (CACHE-31-04). */
export function formatPromptKeyComponent(
  bundleVersion: number,
  systemPromptDigest: string,
): string {
  return `v${bundleVersion}:${systemPromptDigest}`;
}

/**
 * Stable digest of the exact system prompt bytes for cache keys (SHA-256 hex when Web Crypto is available).
 */
export async function hashPromptIdentity(systemPrompt: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle?.digest) {
    const buf = new TextEncoder().encode(systemPrompt);
    const hash = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  let h = 0;
  for (let i = 0; i < systemPrompt.length; i++) {
    h = (Math.imul(31, h) + systemPrompt.charCodeAt(i)) | 0;
  }
  return `ph_${systemPrompt.length}_${(h >>> 0).toString(16)}`;
}
