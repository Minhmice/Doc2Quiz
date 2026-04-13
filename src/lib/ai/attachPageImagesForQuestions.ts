import { putMediaBlob } from "@/lib/db/studySetDb";
import type { PageImageResult } from "@/lib/pdf/renderPagesToImages";
import type { Question } from "@/types/question";

export async function attachPageImagesForQuestions(
  studySetId: string,
  pages: PageImageResult[],
  questions: Question[],
): Promise<number> {
  const pageByIndex = new Map(pages.map((p) => [p.pageIndex, p]));
  const cache = new Map<number, string>();
  let fails = 0;
  for (const q of questions) {
    if (q.includePageImage === false) {
      continue;
    }
    if (q.questionImageId) {
      continue;
    }
    const idx = q.sourcePageIndex;
    if (!idx) {
      continue;
    }
    const page = pageByIndex.get(idx);
    if (!page) {
      fails++;
      continue;
    }
    let mediaId = cache.get(idx);
    if (!mediaId) {
      try {
        const res = await fetch(page.dataUrl);
        if (!res.ok) {
          fails++;
          continue;
        }
        const blob = await res.blob();
        mediaId = await putMediaBlob(studySetId, blob);
        cache.set(idx, mediaId);
      } catch {
        fails++;
        continue;
      }
    }
    q.questionImageId = mediaId;
    q.sourceImageMediaId = mediaId;
    q.imagePageIndex = idx;
  }
  return fails;
}
