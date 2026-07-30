import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  PHASE9_SCHEMA_CONTRACT_INCOMPLETE,
  type FkOwnershipPath,
  type WorkspaceSchemaContract,
  workspaceSchemaContract,
} from "./schemaContract";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../../..");
const WORKSPACE_MIGRATION_GLOB = "2026073015";
const BASELINE_MIGRATION = "20260725120000_v21_baseline.sql";
const SESSIONS_MIGRATION = "20260726150000_resumable_study_sessions.sql";
const QUOTA_MIGRATION = "20260730120000_quota_coupons.sql";
const WORKSPACE_SOURCE_DIRS = [
  join(REPO_ROOT, "src/app/api/workspaces"),
  join(REPO_ROOT, "src/lib/workspaces"),
  join(REPO_ROOT, "src/lib/client/ingestWorkspace.ts"),
  join(REPO_ROOT, "src/lib/workspaces/createWorkspaceIngest.ts"),
];

function readWorkspaceMigrations(): string {
  const migrationsDir = join(REPO_ROOT, "supabase/migrations");
  const workspaceSql = readdirSync(migrationsDir)
    .filter((name) => name.includes(WORKSPACE_MIGRATION_GLOB))
    .sort()
    .map((name) => readFileSync(join(migrationsDir, name), "utf8"))
    .join("\n");
  const baselineSql = readFileSync(join(migrationsDir, BASELINE_MIGRATION), "utf8");
  const sessionsSql = readFileSync(join(migrationsDir, SESSIONS_MIGRATION), "utf8");
  const quotaSql = readFileSync(join(migrationsDir, QUOTA_MIGRATION), "utf8");
  return [workspaceSql, baselineSql, sessionsSql, quotaSql].join("\n");
}

function readWorkspaceSource(): string {
  const chunks: string[] = [];
  for (const entry of WORKSPACE_SOURCE_DIRS) {
    try {
      const stat = statSync(entry);
      if (stat.isDirectory()) {
        for (const file of readdirSync(entry, { recursive: true })) {
          if (typeof file === "string" && (file.endsWith(".ts") || file.endsWith(".tsx"))) {
            chunks.push(readFileSync(join(entry, file), "utf8"));
          }
        }
      } else {
        chunks.push(readFileSync(entry, "utf8"));
      }
    } catch {
      // Optional paths may be absent during partial checkouts.
    }
  }
  return chunks.join("\n");
}

function collectContractTables(contract: WorkspaceSchemaContract): string[] {
  const tables = new Set<string>([
    contract.workspaceRoot,
    contract.memberRelation,
    contract.documentTable,
    contract.documentVersionTable,
    contract.canonicalVersionTable,
    contract.canonicalVersionSectionTable,
    contract.outputRoot,
    contract.outputSnapshotTable,
    contract.quizItemRelation.table,
    contract.flashcardItemRelation.table,
    contract.personalHistory.quizSessions.table,
    contract.personalHistory.studySessions.table,
    contract.personalHistory.studyMistakes.table,
    contract.personalHistory.studyWrongHistory.table,
    contract.personalHistory.quotaConsumptions.table,
  ]);

  const ownershipPaths: FkOwnershipPath[] = [
    contract.documentOwnership,
    contract.documentVersionOwnership,
    contract.canonicalVersionOwnership,
    contract.canonicalVersionSectionOwnership,
    contract.outputSnapshotOwnership,
    contract.quizItemRelation,
    contract.flashcardItemRelation,
  ];
  for (const path of ownershipPaths) {
    tables.add(path.table);
    tables.add(path.via.table);
    tables.add(path.via.workspaceTable);
  }

  return [...tables];
}

function assertInventoryContains(
  haystack: string,
  needle: string,
  label: string,
  missing: string[],
): void {
  if (!haystack.includes(needle)) {
    missing.push(`${label}: ${needle}`);
  }
}

describe("workspace schema inventory", () => {
  it("maps every Phase 10 authorization surface to Phase 9 landed schema", () => {
    const migrations = readWorkspaceMigrations();
    const source = readWorkspaceSource();
    const combined = `${migrations}\n${source}`;
    const missing: string[] = [];

    for (const table of collectContractTables(workspaceSchemaContract)) {
      assertInventoryContains(
        combined,
        `public.${table}`,
        "table",
        missing,
      );
    }

    for (const rpc of [
      ...workspaceSchemaContract.mutationRpcs,
      ...workspaceSchemaContract.resolverRpcs,
    ]) {
      assertInventoryContains(migrations, rpc, "rpc", missing);
    }

    const phase10Migration = readdirSync(join(REPO_ROOT, "supabase/migrations")).find((name) =>
      name.includes("phase10_workspace_authorization"),
    );
    if (phase10Migration) {
      const phase10Sql = readFileSync(
        join(REPO_ROOT, "supabase/migrations", phase10Migration),
        "utf8",
      );
      for (const helper of workspaceSchemaContract.authorizationHelpers) {
        assertInventoryContains(phase10Sql, helper, "authorization helper", missing);
      }
    }

    assertInventoryContains(
      combined,
      workspaceSchemaContract.storage.bucket,
      "storage bucket",
      missing,
    );

    assertInventoryContains(
      source,
      "${workspaceId}/${documentId}/${versionId}/",
      "storage path pattern",
      missing,
    );

    for (const surface of Object.values(workspaceSchemaContract.personalHistory)) {
      assertInventoryContains(
        migrations,
        `public.${surface.table}`,
        "personal history table",
        missing,
      );
      assertInventoryContains(
        migrations,
        surface.ownerColumn,
        `personal history owner column (${surface.table})`,
        missing,
      );
    }

    if (missing.length > 0) {
      throw new Error(
        `${PHASE9_SCHEMA_CONTRACT_INCOMPLETE}: ${missing.join("; ")}`,
      );
    }

    expect(missing).toEqual([]);
  });
});
