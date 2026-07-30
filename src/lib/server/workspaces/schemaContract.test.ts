import { describe, expect, it } from "vitest";

import {
  PHASE9_SCHEMA_CONTRACT_INCOMPLETE,
  validateWorkspaceSchemaContract,
  workspaceSchemaContract,
} from "./schemaContract";

describe("workspaceSchemaContract", () => {
  it("rejects missing Phase 9 ownership mappings rather than falling back to guessed table names", () => {
    expect(() =>
      validateWorkspaceSchemaContract({
        workspaceRoot: "workspaces",
        memberRelation: "workspace_members",
      }),
    ).toThrow(PHASE9_SCHEMA_CONTRACT_INCOMPLETE);

    expect(() =>
      validateWorkspaceSchemaContract({
        ...workspaceSchemaContract,
        quizItemRelation: undefined,
      }),
    ).toThrow(/quizItemRelation/);

    expect(() =>
      validateWorkspaceSchemaContract({
        ...workspaceSchemaContract,
        workspaceRoot: "",
      }),
    ).toThrow(/workspaceRoot/);
  });

  it("records one confirmed workspace root, member relation, document/version chain, output root, quiz item relation, flashcard item relation, and storage authorization path", () => {
    expect(workspaceSchemaContract.workspaceRoot).toBe("workspaces");
    expect(workspaceSchemaContract.memberRelation).toBe("workspace_members");
    expect(workspaceSchemaContract.documentTable).toBe("documents");
    expect(workspaceSchemaContract.documentVersionTable).toBe("document_versions");
    expect(workspaceSchemaContract.canonicalVersionTable).toBe("canonical_versions");
    expect(workspaceSchemaContract.canonicalVersionSectionTable).toBe(
      "canonical_version_sections",
    );
    expect(workspaceSchemaContract.outputRoot).toBe("learning_outputs");
    expect(workspaceSchemaContract.outputSnapshotTable).toBe("output_source_snapshots");
    expect(workspaceSchemaContract.quizItemRelation.table).toBe("approved_questions");
    expect(workspaceSchemaContract.flashcardItemRelation.table).toBe("approved_flashcards");
    expect(workspaceSchemaContract.storage.bucket).toBe("doc2quiz");
    expect(workspaceSchemaContract.storage.pathSegmentOrder).toEqual([
      "workspaceId",
      "documentId",
      "versionId",
      "filename",
    ]);
    expect(workspaceSchemaContract.personalHistory.quizSessions.table).toBe("quiz_sessions");
    expect(workspaceSchemaContract.mutationRpcs).toContain("create_learning_output");
    expect(workspaceSchemaContract.authorizationHelpers).toEqual(
      expect.arrayContaining([
        "workspace_role",
        "can_view_workspace",
        "can_edit_workspace",
        "is_workspace_owner",
      ]),
    );
  });
});
