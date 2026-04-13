import { NextResponse } from "next/server";
import { isServerParseQueueEnabled } from "@/lib/serverParse/env";

/**
 * Production: add auth + rate limiting before enabling D2Q_SERVER_PARSE_ENABLED.
 */

const MAX_CONTENT_LENGTH = 1048576;

function contentLengthBytes(request: Request): number | null {
  const raw = request.headers.get("content-length");
  if (raw == null || raw.trim() === "") {
    return null;
  }
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    return null;
  }
  return n;
}

export async function GET() {
  if (!isServerParseQueueEnabled()) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }
  return NextResponse.json({ enabled: true, version: "stub-15-02" });
}

export async function POST(request: Request) {
  const len = contentLengthBytes(request);
  if (len !== null && len > MAX_CONTENT_LENGTH) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  if (!isServerParseQueueEnabled()) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  try {
    await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: "not_implemented",
      enabled: true,
      message: "Parse job queue stub — worker not wired yet.",
    },
    { status: 501 },
  );
}
