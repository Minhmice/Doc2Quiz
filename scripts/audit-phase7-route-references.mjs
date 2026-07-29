import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const ignored = ["node_modules", ".next", ".git", ".planning", ".impeccable"];
const ignoredFiles = new Set([
  "scripts/audit-phase7-route-callers.mjs",
  "scripts/audit-phase7-route-references.mjs",
  "scripts/verify-phase7-route-smoke.mjs",
  "scripts/verify-study-set-redirects.ts",
]);
const findings = [];
const legacyUrl = /["'`]\/(?:edit(?:\/|["'`])|sets(?:\/|["'`])|flashcards(?:\/|["'`])|done(?:\/|["'`]))|review=mistakes/;
const legacyImport = /@\/app\/\(app\)\/(?:edit|sets|flashcards)(?:\/|["'`])/;
const legacyRedirect = /(?:source|destination|redirect|rewrite)\s*[:=][^\n]*(?:\/edit|\/sets|\/flashcards|\/done|review=mistakes)/;
const legacyRouteRoot = /src\/app\/\(app\)\/(?:edit|sets|flashcards)(?:\/|$)|src\/app\/\(app\)\/quiz\/\[id\](?:\/|$)/;

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replaceAll(path.sep, "/");
    if (ignored.some((part) => rel === part || rel.startsWith(`${part}/`))) return [];
    if (entry.isDirectory()) return filesIn(full);
    if (!/\.(ts|tsx|js|mjs|json)$/.test(entry.name) || ignoredFiles.has(rel)) return [];
    return [rel];
  });
}

for (const file of filesIn(root)) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (legacyUrl.test(line) || legacyImport.test(line) || legacyRedirect.test(line) || legacyRouteRoot.test(line)) {
      findings.push(`${file}:${index + 1}:${line.trim()}`);
    }
  });
}

for (const routeRoot of [
  "src/app/(app)/edit",
  "src/app/(app)/sets",
  "src/app/(app)/flashcards",
  "src/app/(app)/quiz/[id]",
]) {
  if (fs.existsSync(path.join(root, routeRoot))) findings.push(`${routeRoot}:filesystem route root remains`);
}

findings.sort();
for (const finding of findings) console.error(finding);
console.log(`${findings.length} forbidden route references`);
process.exitCode = findings.length ? 1 : 0;
