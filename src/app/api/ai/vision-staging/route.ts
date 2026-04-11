import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  putVisionStaging,
  visionStagingBlobPathname,
  VISION_STAGING_MAX_BYTES,
} from "@/lib/ai/visionStagingStore";

const DATA_URL_RE = /^data:([^;]+);base64,([\s\S]*)$/;

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

function json(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  let parsed: { dataUrl?: unknown };
  try {
    parsed = (await req.json()) as { dataUrl?: unknown };
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  if (typeof parsed.dataUrl !== "string") {
    return json({ error: "dataUrl string required" }, 400);
  }

  const m = DATA_URL_RE.exec(parsed.dataUrl.trim());
  if (!m) {
    return json({ error: "dataUrl must be data:*;base64,..." }, 400);
  }

  const contentType = m[1].trim() || "application/octet-stream";
  const b64 = m[2].replace(/\s+/g, "");
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return json({ error: "Invalid base64" }, 400);
  }

  if (bytes.length === 0 || bytes.length > VISION_STAGING_MAX_BYTES) {
    return json(
      { error: `Image size must be 1–${VISION_STAGING_MAX_BYTES} bytes` },
      400,
    );
  }

  const id = randomUUID();
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();

  if (token) {
    try {
      const pathname = visionStagingBlobPathname(id);
      const { url } = await put(pathname, bytes, {
        access: "public",
        contentType,
        token,
        addRandomSuffix: false,
      });
      return json({ url, id });
    } catch (e) {
      console.error("[vision-staging] blob put failed", e);
      return json({ error: "Staging failed" }, 502);
    }
  }

  putVisionStaging(bytes, contentType, id);
  const origin = new URL(req.url).origin;
  const url = `${origin}/api/ai/vision-staging/${id}`;
  return json({ url, id });
}
