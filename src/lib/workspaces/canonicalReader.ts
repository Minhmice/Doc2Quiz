import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  WorkspaceNotFoundError,
  WorkspaceValidationError,
} from "@/lib/workspaces/errors";

export const SECTION_PAGE_MIN = 1;
export const SECTION_PAGE_MAX = 50;
export const SECTION_PAGE_DEFAULT = 20;

export const canonicalSectionPageQuerySchema = z.object({
  afterOrdinal: z.coerce.number().int().min(0).default(0),
  limit: z.coerce
    .number()
    .int()
    .min(SECTION_PAGE_MIN)
    .max(SECTION_PAGE_MAX)
    .default(SECTION_PAGE_DEFAULT),
});

export type CanonicalSectionPageQuery = z.infer<
  typeof canonicalSectionPageQuerySchema
>;

export type CanonicalSectionIndexItem = {
  id: string;
  ordinal: number;
  heading: string | null;
  sectionType: string | null;
  sectionKey: string | null;
};

export type CanonicalVersionMetadata = {
  id: string;
  documentVersionId: string;
  versionNumber: number;
  status: string;
  model: string | null;
  promptVersion: string | null;
  parserVersion: string | null;
  createdAt: string;
  canonicalContentChecksum: string;
  sectionsChecksum: string;
  provenance: {
    mode?: string | null;
    markitdownVersion?: string | null;
    fallbackReason?: string | null;
    providerHost?: string | null;
  };
  sectionCount: number;
  sections: CanonicalSectionIndexItem[];
};

export type CanonicalSectionBody = {
  id: string;
  ordinal: number;
  heading: string | null;
  sectionType: string | null;
  sectionKey: string | null;
  bodyMarkdown: string;
};

export type CanonicalSectionPage = {
  sections: CanonicalSectionBody[];
  nextAfterOrdinal: number | null;
  limit: number;
};

type MembershipRole = "owner" | "editor" | "viewer";

async function requireWorkspaceMember(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
): Promise<MembershipRole> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new WorkspaceNotFoundError("Workspace not found");
  }
  return data.role as MembershipRole;
}

function redactProvenance(
  provenance: Record<string, unknown> | null | undefined,
): CanonicalVersionMetadata["provenance"] {
  const raw = provenance ?? {};
  return {
    mode: typeof raw.mode === "string" ? raw.mode : null,
    markitdownVersion:
      typeof raw.markitdown_version === "string"
        ? raw.markitdown_version
        : null,
    fallbackReason:
      typeof raw.fallback_reason === "string" ? raw.fallback_reason : null,
    providerHost:
      typeof raw.provider_host === "string" ? raw.provider_host : null,
  };
}

/**
 * Metadata + section index only. Never returns raw markdown, full
 * canonical markdown, or section body payloads.
 */
export async function getCanonicalVersionMetadata(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  versionId: string;
}): Promise<CanonicalVersionMetadata> {
  const { supabase, userId, workspaceId, versionId } = params;
  await requireWorkspaceMember(supabase, userId, workspaceId);

  const { data: version, error: versionError } = await supabase
    .from("canonical_versions")
    .select(
      "id, document_version_id, version_number, status, model, prompt_version, parser_version, created_at, canonical_content_checksum, sections_checksum, provenance, deleted_at, document_versions!inner(id, deleted_at, documents!inner(id, workspace_id, deleted_at))",
    )
    .eq("id", versionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (versionError) {
    throw new Error(versionError.message);
  }
  if (!version) {
    throw new WorkspaceNotFoundError("Canonical version not found");
  }

  const documentVersion = version.document_versions as unknown as {
    id: string;
    deleted_at: string | null;
    documents: { id: string; workspace_id: string; deleted_at: string | null };
  } | null;

  if (
    !documentVersion ||
    documentVersion.documents.workspace_id !== workspaceId ||
    documentVersion.documents.deleted_at != null
  ) {
    throw new WorkspaceNotFoundError("Canonical version not found");
  }

  // Soft-deleted source versions stay historical: still readable for old
  // canonical snapshots; selection UIs exclude them separately.

  const { data: sectionRows, error: sectionsError } = await supabase
    .from("canonical_version_sections")
    .select("id, ordinal, heading, section_type, section_key")
    .eq("canonical_version_id", versionId)
    .order("ordinal", { ascending: true });

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const sections: CanonicalSectionIndexItem[] = (sectionRows ?? []).map(
    (row) => ({
      id: row.id,
      ordinal: row.ordinal,
      heading: row.heading,
      sectionType: row.section_type,
      sectionKey: row.section_key,
    }),
  );

  return {
    id: version.id,
    documentVersionId: version.document_version_id,
    versionNumber: version.version_number,
    status: version.status,
    model: version.model,
    promptVersion: version.prompt_version,
    parserVersion: version.parser_version,
    createdAt: version.created_at,
    canonicalContentChecksum: version.canonical_content_checksum,
    sectionsChecksum: version.sections_checksum,
    provenance: redactProvenance(
      version.provenance as Record<string, unknown> | null,
    ),
    sectionCount: sections.length,
    sections,
  };
}

/**
 * Bounded ordered section bodies. Clamp limit to 1–50.
 */
export async function getCanonicalSectionPage(params: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  versionId: string;
  afterOrdinal: number;
  limit: number;
}): Promise<CanonicalSectionPage> {
  const { supabase, userId, workspaceId, versionId } = params;
  await requireWorkspaceMember(supabase, userId, workspaceId);

  const limit = Math.min(
    SECTION_PAGE_MAX,
    Math.max(SECTION_PAGE_MIN, params.limit),
  );
  const afterOrdinal = Math.max(0, params.afterOrdinal);

  const { data: version, error: versionError } = await supabase
    .from("canonical_versions")
    .select(
      "id, deleted_at, document_versions!inner(documents!inner(workspace_id, deleted_at))",
    )
    .eq("id", versionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (versionError) {
    throw new Error(versionError.message);
  }
  if (!version) {
    throw new WorkspaceNotFoundError("Canonical version not found");
  }

  const documentVersion = version.document_versions as unknown as {
    documents: { workspace_id: string; deleted_at: string | null };
  } | null;

  if (
    !documentVersion ||
    documentVersion.documents.workspace_id !== workspaceId ||
    documentVersion.documents.deleted_at != null
  ) {
    throw new WorkspaceNotFoundError("Canonical version not found");
  }

  const { data: rows, error: sectionsError } = await supabase
    .from("canonical_version_sections")
    .select(
      "id, ordinal, heading, section_type, section_key, body_markdown",
    )
    .eq("canonical_version_id", versionId)
    .gt("ordinal", afterOrdinal)
    .order("ordinal", { ascending: true })
    .limit(limit);

  if (sectionsError) {
    throw new Error(sectionsError.message);
  }

  const sections: CanonicalSectionBody[] = (rows ?? []).map((row) => ({
    id: row.id,
    ordinal: row.ordinal,
    heading: row.heading,
    sectionType: row.section_type,
    sectionKey: row.section_key,
    bodyMarkdown: row.body_markdown,
  }));

  const nextAfterOrdinal =
    sections.length === limit
      ? (sections[sections.length - 1]?.ordinal ?? null)
      : null;

  return {
    sections,
    nextAfterOrdinal,
    limit,
  };
}

export function assertNoFullDocumentPayload(
  payload: Record<string, unknown>,
): void {
  const forbidden = [
    "rawMarkdown",
    "raw_markdown",
    "canonicalMarkdown",
    "canonical_markdown",
  ];
  for (const key of forbidden) {
    if (key in payload) {
      throw new WorkspaceValidationError(
        `Reader payload must not include ${key}`,
      );
    }
  }
}
