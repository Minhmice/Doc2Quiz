import raw from "@/lib/ai/prompts/mcq-extraction.prompts.json";

type McqExtractionPromptsFile = {
  version: number;
  mcqExtraction: { system: string };
  visionPageImage: { userTemplate: string };
  visionPagePair: { userTemplate: string };
};

const prompts = raw as McqExtractionPromptsFile;

/** System prompt: text chunk or vision page image → MCQ JSON (shared OpenAI / Anthropic / custom). */
export const MCQ_EXTRACTION_SYSTEM_PROMPT = prompts.mcqExtraction.system;

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
