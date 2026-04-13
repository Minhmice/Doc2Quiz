import { NextResponse } from "next/server";
import { isServerParseQueueEnabled } from "@/lib/serverParse/env";

/**
 * Production: add auth + rate limiting before enabling D2Q_SERVER_PARSE_ENABLED.
 */

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: Ctx) {
  if (!isServerParseQueueEnabled()) {
    return NextResponse.json({ enabled: false }, { status: 404 });
  }

  const { id } = await context.params;
  if (!id?.trim()) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  return NextResponse.json(
    {
      error: "not_implemented",
      enabled: true,
      id: id.trim(),
    },
    { status: 501 },
  );
}
