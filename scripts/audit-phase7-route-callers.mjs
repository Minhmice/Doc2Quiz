import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const deferredRoots = [
  "src/app/(app)/edit/",
  "src/app/(app)/sets/",
  "src/app/(app)/flashcards/",
  "src/app/(app)/quiz/[id]/",
];
const ignored = ["node_modules", ".next", ".git", ".planning", ".impeccable"];
const legacy = /(?:["'`]\/edit(?:\/|["'`])|["'`]\/sets(?:\/|["'`])|["'`]\/flashcards(?:\/|["'`])|review(?:[=])mistakes|["'`]\/done(?:\/|["'`])|\bnewRoot\b|\bnewQuiz\b|\bnewFlashcards\b|\bstudySetSource\b|\beditQuiz\b|\beditFlashcards\b|\bflashcardsPlay\b|\bquizDone\b|\bflashcardsDone\b)/;
const allowed = [/\/api\/study-sets\/\[id\]\/flashcards\/generate/, /\bflashcards\b/];

function filesIn(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const rel = path.relative(root, path.join(dir, entry.name)).replaceAll(path.sep, "/");
    if (ignored.some((part) => rel === part || rel.startsWith(`${part}/`))) return [];
    if (entry.isDirectory()) return filesIn(path.join(dir, entry.name));
    if (!/\.(ts|tsx|js|mjs|json)$/.test(entry.name)) return [];
    if (deferredRoots.some((prefix) => rel.startsWith(prefix))) return [];
    return [rel];
  });
}

const findings = [];
for (const file of filesIn(root)) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  lines.forEach((line, index) => {
    if (legacy.test(line) && !allowed.some((matcher) => matcher.test(line))) findings.push(`${file}:${index + 1}:${line.trim()}`);
  });
}
findings.sort();
for (const finding of findings) console.error(finding);
console.log(`${findings.length} forbidden caller references`);
process.exitCode = findings.length ? 1 : 0;
