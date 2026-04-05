import { NextResponse } from "next/server";
import { getVisionStaging } from "@/lib/ai/visionStagingStore";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id || id.length > 200) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const entry = getVisionStaging(id);
  if (!entry) {
    return NextResponse.json({ error: "Not found or expired" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(entry.bytes), {
    status: 200,
    headers: {
      "Content-Type": entry.contentType,
      "Cache-Control": "private, no-store",
    },
  });
}
