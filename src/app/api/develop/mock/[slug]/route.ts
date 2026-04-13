import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { isAllowedDevelopMockSlug } from "@/lib/develop/mockAllowlist";

function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

function isDevelopMocksEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" ||
    process.env.ALLOW_DEVELOP_MOCKS === "1"
  );
}

function slugLooksUnsafe(slug: string): boolean {
  if (slug.includes("..")) {
    return true;
  }
  if (slug.includes("/") || slug.includes("\\")) {
    return true;
  }
  if (slug === path.sep) {
    return true;
  }
  return false;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;

  if (!isDevelopMocksEnabled()) {
    return notFound();
  }

  if (slugLooksUnsafe(slug)) {
    return notFound();
  }

  if (!isAllowedDevelopMockSlug(slug)) {
    return notFound();
  }

  const filePath = path.join(process.cwd(), "example", slug, "code.html");

  try {
    const buf = await readFile(filePath);
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return notFound();
  }
}
