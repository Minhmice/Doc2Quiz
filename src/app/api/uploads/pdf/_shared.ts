import { NextResponse } from "next/server";

export const PDF_UPLOAD_NO_STORE = {
  "Cache-Control": "private, no-store",
} as const;

export function pdfUploadJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: PDF_UPLOAD_NO_STORE });
}
