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

const MAX_BATCH_SIZE = 20;

interface StagingResult {
  url: string;
  id: string;
  error?: string;
}

async function stageOneImage(
  dataUrl: string,
  origin: string,
): Promise<StagingResult> {
  const m = DATA_URL_RE.exec(dataUrl.trim());
  if (!m) {
    return {
      url: "",
      id: "",
      error: "dataUrl must be data:*;base64,...",
    };
  }

  const contentType = m[1].trim() || "application/octet-stream";
  const b64 = m[2].replace(/\s+/g, "");
  let bytes: Buffer;
  try {
    bytes = Buffer.from(b64, "base64");
  } catch {
    return { url: "", id: "", error: "Invalid base64" };
  }

  if (bytes.length === 0 || bytes.length > VISION_STAGING_MAX_BYTES) {
    return {
      url: "",
      id: "",
      error: `Image size must be 1–${VISION_STAGING_MAX_BYTES} bytes`,
    };
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
      return { url, id };
    } catch (e) {
      console.error("[vision-staging] blob put failed", e);
      return { url: "", id: "", error: "Staging failed" };
    }
  }

  putVisionStaging(bytes, contentType, id);
  const url = `${origin}/api/ai/vision-staging/${id}`;
  return { url, id };
}

export async function POST(req: Request) {
  let parsed: { dataUrl?: unknown; dataUrls?: unknown };
  try {
    parsed = (await req.json()) as { dataUrl?: unknown; dataUrls?: unknown };
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const origin = new URL(req.url).origin;

  // Batch mode
  if (Array.isArray(parsed.dataUrls)) {
    if (parsed.dataUrls.length === 0) {
      return json({ error: "dataUrls array is empty" }, 400);
    }
    if (parsed.dataUrls.length > MAX_BATCH_SIZE) {
      return json(
        { error: `Batch size must be <= ${MAX_BATCH_SIZE}` },
        400,
      );
    }

    const results: StagingResult[] = [];
    for (const dataUrl of parsed.dataUrls) {
      if (typeof dataUrl !== "string") {
        results.push({ url: "", id: "", error: "dataUrl must be string" });
        continue;
      }
      const result = await stageOneImage(dataUrl, origin);
      results.push(result);
    }

    return json({ results });
  }

  // Single mode (backward compatible)
  if (typeof parsed.dataUrl !== "string") {
    return json({ error: "dataUrl string required" }, 400);
  }

  const result = await stageOneImage(parsed.dataUrl, origin);
  if (result.error) {
    return json({ error: result.error }, 400);
  }

  return json({ url: result.url, id: result.id });
}
