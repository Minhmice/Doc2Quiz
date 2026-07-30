/**
 * Phase 9 workspace bridge static audit.
 * Ensures retained legacy study-set adapters delegate through resolveLegacyStudySetBridge
 * with explicit routeKind and never invoke mutable legacy replacement paths.
 */
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

/** Retained legacy set-ID adapters (Plans 09-07 / 09-08). */
const ADAPTERS = [
  {
    file: "src/app/api/study-sets/[id]/route.ts",
    routeKind: "metadata",
  },
  {
    file: "src/app/api/study-sets/[id]/canonical/route.ts",
    routeKind: "canonical",
  },
  {
    file: "src/app/api/study-sets/[id]/ingest/route.ts",
    routeKind: "ingest",
  },
  {
    file: "src/app/api/study-sets/[id]/canonicalize/route.ts",
    routeKind: "canonicalize",
  },
  {
    file: "src/app/api/study-sets/[id]/quiz/generate/route.ts",
    routeKind: "quiz",
  },
  {
    file: "src/app/api/study-sets/[id]/flashcards/generate/route.ts",
    routeKind: "flashcards",
  },
];

/** Phase 10 surfaces must not ship in Phase 9. */
const PHASE10_UI_PATTERNS = [
  /\binvite(?:User|Link|Member)?\b/i,
  /\bpublic[-_]?link\b/i,
  /\banonymous(?:Study|Access|Mode)?\b/i,
  /\bfriend(?:s|List|Request)?\b/i,
  /\bworkspace_invitations\b/,
  /\bshare(?:Link|Token|Invite)\b/i,
];

const FORBIDDEN_ADAPTER_PATTERNS = [
  { id: "replace_canonical_content", pattern: /\breplace_canonical_content\b/ },
  { id: "runCanonicalize", pattern: /\brunCanonicalize\b/ },
  { id: "runIngest", pattern: /\brunIngest\b/ },
  { id: "runQuizGenerate", pattern: /\brunQuizGenerate\b/ },
  { id: "runFlashcardGenerate", pattern: /\brunFlashcardGenerate\b/ },
  { id: "replace_quiz_questions", pattern: /\breplace_quiz_questions\b/ },
  { id: "replace_flashcard", pattern: /\breplace_flashcard/ },
  {
    id: "mutable_canonical_documents",
    pattern: /\.from\(\s*["']canonical_documents["']\s*\)/,
  },
];

function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
}

function rel(file) {
  return file.replaceAll(path.sep, "/");
}

const findings = [];

for (const adapter of ADAPTERS) {
  const abs = path.join(root, adapter.file);
  if (!fs.existsSync(abs)) {
    findings.push(`${adapter.file}: missing retained legacy adapter file`);
    continue;
  }

  const raw = fs.readFileSync(abs, "utf8");
  const code = stripComments(raw);

  if (!/\bresolveLegacyStudySetBridge\b/.test(code)) {
    findings.push(
      `${adapter.file}: must call resolveLegacyStudySetBridge (bridge bypass)`,
    );
  }

  if (!new RegExp(`routeKind:\\s*["']${adapter.routeKind}["']`).test(code)) {
    findings.push(
      `${adapter.file}: must pass explicit routeKind "${adapter.routeKind}"`,
    );
  }

  for (const forbidden of FORBIDDEN_ADAPTER_PATTERNS) {
    if (forbidden.pattern.test(code)) {
      findings.push(
        `${adapter.file}: forbidden mutable legacy path "${forbidden.id}"`,
      );
    }
  }
}

/** Scan app UI for Phase 10 sharing controls (src/app + src/components only). */
const uiRoots = ["src/app", "src/components"];
const uiIgnored = new Set([
  "scripts/verify-phase9-workspace-bridge.mjs",
]);

function walkUi(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    const file = rel(path.relative(root, abs));
    if (entry.isDirectory()) {
      walkUi(abs, out);
      continue;
    }
    if (!/\.(tsx|ts|jsx|js)$/.test(entry.name)) continue;
    if (uiIgnored.has(file)) continue;
    out.push(file);
  }
  return out;
}

for (const uiRoot of uiRoots) {
  const absRoot = path.join(root, uiRoot);
  if (!fs.existsSync(absRoot)) continue;
  for (const file of walkUi(absRoot)) {
    const code = stripComments(fs.readFileSync(path.join(root, file), "utf8"));
    for (const pattern of PHASE10_UI_PATTERNS) {
      if (pattern.test(code)) {
        findings.push(
          `${file}: Phase 10 sharing surface detected (${pattern})`,
        );
      }
    }
  }
}

findings.sort();
for (const finding of findings) {
  console.error(`FAIL ${finding}`);
}

if (findings.length === 0) {
  console.log(
    `Phase 9 bridge audit passed (${ADAPTERS.length} adapters, Phase 10 UI clean)`,
  );
}

process.exitCode = findings.length ? 1 : 0;
