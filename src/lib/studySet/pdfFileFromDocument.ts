import type { StudySetDocumentRecord } from "@/types/studySet";

export function pdfFileFromDocument(
  doc: StudySetDocumentRecord,
): File | null {
  if (!doc.pdfArrayBuffer || !doc.pdfFileName) {
    return null;
  }
  return new File([doc.pdfArrayBuffer], doc.pdfFileName, {
    type: "application/pdf",
  });
}
