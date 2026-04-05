import { Buffer } from "node:buffer";
import { NextResponse } from "next/server";
import {
  putVisionStaging,
  VISION_STAGING_MAX_BYTES,
} from "@/lib/ai/visionStagingStore";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]*)$/;

export async function POST(req: Request) {
  let parsed: { dataUrl?: unknown };
  try {
    parsed = (await req.json()) as { dataUrl?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof parsed.dataUrl !== "string") {
    return NextResponse.json({ error: "dataUrl string required" }, { status: 400 });
  }

  const m = DATA_URL_RE.exec(parsed.dataUrl.trim());
  if (!m) {
    return NextResponse.json(
      { error: "dataUrl must be data:*;base64,..." },
      { status: 400 },
    );
  }

  const contentType = m[1].trim() || "application/octet-stream";
  const b64 = m[2].replace(/\s+/g, "");
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return NextResponse.json({ error: "Invalid base64" }, { status: 400 });
  }

  if (bytes.length === 0 || bytes.length > VISION_STAGING_MAX_BYTES) {
    return NextResponse.json(
      { error: `Image size must be 1–${VISION_STAGING_MAX_BYTES} bytes` },
      { status: 400 },
    );
  }

  const id = putVisionStaging(bytes, contentType);
  const origin = new URL(req.url).origin;
  const url = `${origin}/api/ai/vision-staging/${id}`;
  return NextResponse.json({ url, id });
}
