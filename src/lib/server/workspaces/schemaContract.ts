/**
 * Immutable Phase 9 schema contract consumed by Phase 10 authorization.
 * Identifiers are derived from landed migrations only — no research fallbacks.
 */

export const PHASE9_SCHEMA_CONTRACT_INCOMPLETE = "Phase 9 schema contract incomplete";

export type WorkspaceRole = "owner" | "editor" | "viewer";

export type FkOwnershipPath = Readonly<{
  /** Child table holding the foreign key. */
  table: string;
  /** Column on child referencing the parent in `via`. */
  column: string;
  via: Readonly<{
    table: string;
    column: string;
    /** Table that exposes workspace_id for authorization resolution. */
    workspaceTable: string;
    workspaceIdColumn: string;
  }>;
}>;

export type PersonalHistorySurface = Readonly<{
  table: string;
  ownerColumn: string;
}>;

export type WorkspaceSchemaContract = Readonly<{
  workspaceRoot: string;
  memberRelation: string;
  documentTable: string;
  documentVersionTable: string;
  canonicalVersionTable: string;
  canonicalVersionSectionTable: string;
  outputRoot: string;
  outputSnapshotTable: string;
  quizItemRelation: FkOwnershipPath;
  flashcardItemRelation: FkOwnershipPath;
  documentOwnership: FkOwnershipPath;
  documentVersionOwnership: FkOwnershipPath;
  canonicalVersionOwnership: FkOwnershipPath;
  canonicalVersionSectionOwnership: FkOwnershipPath;
  outputSnapshotOwnership: FkOwnershipPath;
  personalHistory: Readonly<{
    quizSessions: PersonalHistorySurface;
    studySessions: PersonalHistorySurface;
    studyMistakes: PersonalHistorySurface;
    studyWrongHistory: PersonalHistorySurface;
    quotaConsumptions: PersonalHistorySurface;
  }>;
  mutationRpcs: readonly string[];
  resolverRpcs: readonly string[];
  authorizationHelpers: readonly string[];
  storage: Readonly<{
    bucket: string;
    /** Workspace-scoped object path: workspaceId/documentId/versionId/filename */
    pathSegmentOrder: readonly ["workspaceId", "documentId", "versionId", "filename"];
  }>;
}>;

const REQUIRED_STRING_KEYS = [
  "workspaceRoot",
  "memberRelation",
  "documentTable",
  "documentVersionTable",
  "canonicalVersionTable",
  "canonicalVersionSectionTable",
  "outputRoot",
  "outputSnapshotTable",
] as const satisfies readonly (keyof WorkspaceSchemaContract)[];

type RequiredStringKey = (typeof REQUIRED_STRING_KEYS)[number];

function assertNonEmptyString(value: unknown, label: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: missing ${label}`);
  }
}

function assertOwnershipPath(
  value: unknown,
  label: string,
): asserts value is FkOwnershipPath {
  if (!value || typeof value !== "object") {
    throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: missing ${label}`);
  }
  const path = value as Partial<FkOwnershipPath>;
  assertNonEmptyString(path.table, `${label}.table`);
  assertNonEmptyString(path.column, `${label}.column`);
  if (!path.via || typeof path.via !== "object") {
    throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: missing ${label}.via`);
  }
  assertNonEmptyString(path.via.table, `${label}.via.table`);
  assertNonEmptyString(path.via.column, `${label}.via.column`);
  assertNonEmptyString(path.via.workspaceTable, `${label}.via.workspaceTable`);
  assertNonEmptyString(path.via.workspaceIdColumn, `${label}.via.workspaceIdColumn`);
}

function assertPersonalHistory(
  value: unknown,
  label: string,
): asserts value is PersonalHistorySurface {
  if (!value || typeof value !== "object") {
    throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: missing ${label}`);
  }
  const surface = value as Partial<PersonalHistorySurface>;
  assertNonEmptyString(surface.table, `${label}.table`);
  assertNonEmptyString(surface.ownerColumn, `${label}.ownerColumn`);
}

/**
 * Rejects partial or guessed contracts rather than falling back to invented names.
 */
export function validateWorkspaceSchemaContract(
  contract: Partial<WorkspaceSchemaContract>,
): asserts contract is WorkspaceSchemaContract {
  for (const key of REQUIRED_STRING_KEYS) {
    assertNonEmptyString(contract[key as RequiredStringKey], key);
  }

  assertOwnershipPath(contract.documentOwnership, "documentOwnership");
  assertOwnershipPath(contract.documentVersionOwnership, "documentVersionOwnership");
  assertOwnershipPath(contract.canonicalVersionOwnership, "canonicalVersionOwnership");
  assertOwnershipPath(
    contract.canonicalVersionSectionOwnership,
    "canonicalVersionSectionOwnership",
  );
  assertOwnershipPath(contract.quizItemRelation, "quizItemRelation");
  assertOwnershipPath(contract.flashcardItemRelation, "flashcardItemRelation");
  assertOwnershipPath(contract.outputSnapshotOwnership, "outputSnapshotOwnership");

  if (!contract.personalHistory || typeof contract.personalHistory !== "object") {
    throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: missing personalHistory`);
  }
  const history = contract.personalHistory;
  assertPersonalHistory(history.quizSessions, "personalHistory.quizSessions");
  assertPersonalHistory(history.studySessions, "personalHistory.studySessions");
  assertPersonalHistory(history.studyMistakes, "personalHistory.studyMistakes");
  assertPersonalHistory(history.studyWrongHistory, "personalHistory.studyWrongHistory");
  assertPersonalHistory(history.quotaConsumptions, "personalHistory.quotaConsumptions");

  for (const listKey of ["mutationRpcs", "resolverRpcs", "authorizationHelpers"] as const) {
    const list = contract[listKey];
    if (!Array.isArray(list) || list.length === 0 || list.some((item) => typeof item !== "string")) {
      throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: missing ${listKey}`);
    }
  }

  if (!contract.storage || typeof contract.storage !== "object") {
    throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: missing storage`);
  }
  assertNonEmptyString(contract.storage.bucket, "storage.bucket");
  const segments = contract.storage.pathSegmentOrder;
  if (
    !Array.isArray(segments) ||
    segments.length !== 4 ||
    segments.join("/") !== "workspaceId/documentId/versionId/filename"
  ) {
    throw new Error(`${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: invalid storage.pathSegmentOrder`);
  }
}

/** Confirmed Phase 9 identifiers from landed workspace migrations. */
export const workspaceSchemaContract: WorkspaceSchemaContract = {
  workspaceRoot: "workspaces",
  memberRelation: "workspace_members",
  documentTable: "documents",
  documentVersionTable: "document_versions",
  canonicalVersionTable: "canonical_versions",
  canonicalVersionSectionTable: "canonical_version_sections",
  outputRoot: "learning_outputs",
  outputSnapshotTable: "output_source_snapshots",
  documentOwnership: {
    table: "documents",
    column: "workspace_id",
    via: {
      table: "workspaces",
      column: "id",
      workspaceTable: "workspaces",
      workspaceIdColumn: "id",
    },
  },
  documentVersionOwnership: {
    table: "document_versions",
    column: "document_id",
    via: {
      table: "documents",
      column: "id",
      workspaceTable: "documents",
      workspaceIdColumn: "workspace_id",
    },
  },
  canonicalVersionOwnership: {
    table: "canonical_versions",
    column: "document_version_id",
    via: {
      table: "document_versions",
      column: "id",
      workspaceTable: "documents",
      workspaceIdColumn: "workspace_id",
    },
  },
  canonicalVersionSectionOwnership: {
    table: "canonical_version_sections",
    column: "canonical_version_id",
    via: {
      table: "canonical_versions",
      column: "id",
      workspaceTable: "documents",
      workspaceIdColumn: "workspace_id",
    },
  },
  outputSnapshotOwnership: {
    table: "output_source_snapshots",
    column: "output_id",
    via: {
      table: "learning_outputs",
      column: "id",
      workspaceTable: "learning_outputs",
      workspaceIdColumn: "workspace_id",
    },
  },
  quizItemRelation: {
    table: "approved_questions",
    column: "output_id",
    via: {
      table: "learning_outputs",
      column: "id",
      workspaceTable: "learning_outputs",
      workspaceIdColumn: "workspace_id",
    },
  },
  flashcardItemRelation: {
    table: "approved_flashcards",
    column: "output_id",
    via: {
      table: "learning_outputs",
      column: "id",
      workspaceTable: "learning_outputs",
      workspaceIdColumn: "workspace_id",
    },
  },
  personalHistory: {
    quizSessions: { table: "quiz_sessions", ownerColumn: "user_id" },
    studySessions: { table: "study_sessions", ownerColumn: "user_id" },
    studyMistakes: { table: "study_mistakes", ownerColumn: "user_id" },
    studyWrongHistory: { table: "study_wrong_history", ownerColumn: "user_id" },
    quotaConsumptions: { table: "quota_consumptions", ownerColumn: "user_id" },
  },
  mutationRpcs: [
    "create_workspace_document_version",
    "persist_canonical_version",
    "create_learning_output",
  ],
  resolverRpcs: ["resolve_learning_output_bridge"],
  authorizationHelpers: [
    "workspace_role",
    "can_view_workspace",
    "can_edit_workspace",
    "is_workspace_owner",
  ],
  storage: {
    bucket: "doc2quiz",
    pathSegmentOrder: ["workspaceId", "documentId", "versionId", "filename"],
  },
};

validateWorkspaceSchemaContract(workspaceSchemaContract);
