import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertNoFullDocumentPayload,
  getCanonicalSectionPage,
  getCanonicalVersionMetadata,
  SECTION_PAGE_MAX,
} from "@/lib/workspaces/canonicalReader";
import {
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";

type MockSupabase = {
  from: ReturnType<typeof vi.fn>;
};

function createChain(result: { data: unknown; error: unknown }) {
  const terminal = {
    maybeSingle: vi.fn(async () => result),
    order: vi.fn(() => ({
      limit: vi.fn(async () => result),
      then: undefined,
    })),
    limit: vi.fn(async () => result),
  };

  // Support .order().limit() and bare .order() for index queries
  terminal.order = vi.fn(() => ({
    ...terminal,
    limit: vi.fn(async () => result),
    // When metadata selects with only .order (no limit), await the chain
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve(result).then(resolve),
  }));

  const gt = vi.fn(() => ({
    order: terminal.order,
  }));

  const is = vi.fn(() => ({
    maybeSingle: terminal.maybeSingle,
  }));

  const eq = vi.fn(() => ({
    eq: eq,
    is,
    gt,
    order: terminal.order,
    maybeSingle: terminal.maybeSingle,
  }));

  return {
    select: vi.fn(() => ({
      eq,
      is,
    })),
  };
}

describe("getCanonicalVersionMetadata", () => {
  let memberResult: { data: unknown; error: unknown };
  let versionResult: { data: unknown; error: unknown };
  let sectionsResult: { data: unknown; error: unknown };
  let supabase: MockSupabase;

  beforeEach(() => {
    memberResult = { data: { role: "viewer" }, error: null };
    versionResult = {
      data: {
        id: "cv-1",
        document_version_id: "ver-1",
        version_number: 2,
        status: "completed",
        model: "test-model",
        prompt_version: "1.0",
        parser_version: "1.0",
        created_at: "2026-07-30T00:00:00Z",
        canonical_content_checksum: "abc",
        sections_checksum: "def",
        provenance: {
          mode: "ai",
          markitdown_version: "0.1.6",
          fallback_reason: null,
          provider_host: "api.example.com",
          api_key: "should-not-leak",
        },
        deleted_at: null,
        document_versions: {
          id: "ver-1",
          deleted_at: "2026-07-29T00:00:00Z",
          documents: {
            id: "doc-1",
            workspace_id: "ws-1",
            deleted_at: null,
          },
        },
      },
      error: null,
    };
    sectionsResult = {
      data: [
        {
          id: "s1",
          ordinal: 1,
          heading: "Intro",
          section_type: "theory",
          section_key: "sec_001",
        },
        {
          id: "s2",
          ordinal: 2,
          heading: "Body",
          section_type: "theory",
          section_key: "sec_002",
        },
      ],
      error: null,
    };

    supabase = {
      from: vi.fn((table: string) => {
        if (table === "workspace_members") {
          return createChain(memberResult);
        }
        if (table === "canonical_versions") {
          return createChain(versionResult);
        }
        if (table === "canonical_version_sections") {
          return createChain(sectionsResult);
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
  });

  it("returns metadata and section headings without bodies or full markdown", async () => {
    const meta = await getCanonicalVersionMetadata({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      versionId: "cv-1",
    });

    expect(meta.versionNumber).toBe(2);
    expect(meta.model).toBe("test-model");
    expect(meta.promptVersion).toBe("1.0");
    expect(meta.parserVersion).toBe("1.0");
    expect(meta.createdAt).toBe("2026-07-30T00:00:00Z");
    expect(meta.sectionCount).toBe(2);
    expect(meta.sections).toEqual([
      {
        id: "s1",
        ordinal: 1,
        heading: "Intro",
        sectionType: "theory",
        sectionKey: "sec_001",
      },
      {
        id: "s2",
        ordinal: 2,
        heading: "Body",
        sectionType: "theory",
        sectionKey: "sec_002",
      },
    ]);
    expect(meta.provenance).toEqual({
      mode: "ai",
      markitdownVersion: "0.1.6",
      fallbackReason: null,
      providerHost: "api.example.com",
    });
    expect(JSON.stringify(meta)).not.toContain("should-not-leak");
    expect(JSON.stringify(meta)).not.toContain("body_markdown");
    expect(JSON.stringify(meta)).not.toContain("canonical_markdown");
    expect(JSON.stringify(meta)).not.toContain("raw_markdown");
    // Deleted source version still readable for historical snapshot
    expect(meta.documentVersionId).toBe("ver-1");
  });

  it("throws not found when workspace mismatches", async () => {
    versionResult = {
      data: {
        ...(versionResult.data as object),
        document_versions: {
          id: "ver-1",
          deleted_at: null,
          documents: {
            id: "doc-1",
            workspace_id: "other-ws",
            deleted_at: null,
          },
        },
      },
      error: null,
    };
    supabase.from = vi.fn((table: string) => {
      if (table === "workspace_members") return createChain(memberResult);
      if (table === "canonical_versions") return createChain(versionResult);
      if (table === "canonical_version_sections")
        return createChain(sectionsResult);
      throw new Error(`Unexpected table ${table}`);
    });

    await expect(
      getCanonicalVersionMetadata({
        supabase: supabase as never,
        userId: "user-1",
        workspaceId: "ws-1",
        versionId: "cv-1",
      }),
    ).rejects.toBeInstanceOf(WorkspaceNotFoundError);
  });
});

describe("getCanonicalSectionPage", () => {
  let memberResult: { data: unknown; error: unknown };
  let versionResult: { data: unknown; error: unknown };
  let pageResult: { data: unknown; error: unknown };
  let lastLimit: number | null;
  let supabase: MockSupabase;

  beforeEach(() => {
    lastLimit = null;
    memberResult = { data: { role: "editor" }, error: null };
    versionResult = {
      data: {
        id: "cv-1",
        deleted_at: null,
        document_versions: {
          documents: { workspace_id: "ws-1", deleted_at: null },
        },
      },
      error: null,
    };
    pageResult = {
      data: [
        {
          id: "s2",
          ordinal: 2,
          heading: "Two",
          section_type: "theory",
          section_key: "sec_002",
          body_markdown: "Body two",
        },
        {
          id: "s3",
          ordinal: 3,
          heading: "Three",
          section_type: "theory",
          section_key: "sec_003",
          body_markdown: "Body three",
        },
      ],
      error: null,
    };

    supabase = {
      from: vi.fn((table: string) => {
        if (table === "workspace_members") {
          return createChain(memberResult);
        }
        if (table === "canonical_versions") {
          return createChain(versionResult);
        }
        if (table === "canonical_version_sections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gt: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(async (n: number) => {
                      lastLimit = n;
                      return pageResult;
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    };
  });

  it("returns ordered page with next cursor when page is full", async () => {
    const page = await getCanonicalSectionPage({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      versionId: "cv-1",
      afterOrdinal: 1,
      limit: 2,
    });

    expect(page.sections).toHaveLength(2);
    expect(page.sections[0].bodyMarkdown).toBe("Body two");
    expect(page.nextAfterOrdinal).toBe(3);
    expect(page.limit).toBe(2);
    expect(lastLimit).toBe(2);
  });

  it("clamps limit to 1–50", async () => {
    pageResult = { data: [], error: null };
    const page = await getCanonicalSectionPage({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      versionId: "cv-1",
      afterOrdinal: 0,
      limit: 999,
    });

    expect(lastLimit).toBe(SECTION_PAGE_MAX);
    expect(page.limit).toBe(SECTION_PAGE_MAX);
    expect(page.nextAfterOrdinal).toBeNull();
  });

  it("omits next cursor when page is short", async () => {
    pageResult = {
      data: [
        {
          id: "s4",
          ordinal: 4,
          heading: "Four",
          section_type: "theory",
          section_key: "sec_004",
          body_markdown: "last",
        },
      ],
      error: null,
    };

    const page = await getCanonicalSectionPage({
      supabase: supabase as never,
      userId: "user-1",
      workspaceId: "ws-1",
      versionId: "cv-1",
      afterOrdinal: 3,
      limit: 20,
    });

    expect(page.nextAfterOrdinal).toBeNull();
  });
});

describe("assertNoFullDocumentPayload", () => {
  it("rejects full-content keys", () => {
    expect(() =>
      assertNoFullDocumentPayload({ canonicalMarkdown: "# all" }),
    ).toThrow(WorkspaceValidationError);
  });
});
