import { BlobNotFoundError, head } from "@vercel/blob";
import { NextResponse } from "next/server";
import {
  getVisionStaging,
  isVisionStagingId,
  visionStagingBlobPathname,
} from "@/lib/ai/visionStagingStore";

type Ctx = { params: Promise<{ id: string }> };

const NO_STORE = { "Cache-Control": "private, no-store" } as const;

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  if (!id || !isVisionStagingId(id)) {
    return NextResponse.json(
      { error: "Not found" },
      { status: 404, headers: NO_STORE },
    );
  }

  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) {
    try {
      const meta = await head(visionStagingBlobPathname(id), { token });
      return NextResponse.redirect(meta.url, {
        status: 307,
        headers: NO_STORE,
      });
    } catch (e) {
      if (e instanceof BlobNotFoundError) {
        return NextResponse.json(
          { error: "Not found or expired" },
          { status: 404, headers: NO_STORE },
        );
      }
      console.error("[vision-staging] blob head failed", e);
      return NextResponse.json(
        { error: "Staging lookup failed" },
        { status: 502, headers: NO_STORE },
      );
    }
  }

  const entry = getVisionStaging(id);
  if (!entry) {
    return NextResponse.json(
      { error: "Not found or expired" },
      { status: 404, headers: NO_STORE },
    );
  }

  return new NextResponse(new Uint8Array(entry.bytes), {
    status: 200,
    headers: {
      "Content-Type": entry.contentType,
      ...NO_STORE,
    },
  });
}
