import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import { VISION_TEST_PNG_BASE64 } from "@/lib/ai/visionTestImageData";

const body = Buffer.from(VISION_TEST_PNG_BASE64, "base64");

export function GET() {
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
