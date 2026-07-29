import { readFile, readdir } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const root = process.cwd();
const roots = ["src/app/(app)", "src/components"];
const extensions = new Set([".ts", ".tsx"]);
const excluded = [/(?:^|\/)locale\//, /\.test\.[jt]sx?$/, /(?:^|\/)api\//, /(?:^|\/)auth\//, /(?:^|\/)ui\//];
const listedCopyFiles = new Set([
  "src/components/locale/LanguageSelector.tsx",
  "src/components/processing/conversion-progress.tsx",
  "src/components/upload/UploadBox.tsx",
  "src/components/dashboard/DashboardHomeSkeleton.tsx",
  "src/components/dashboard/DashboardLibraryHeader.tsx",
  "src/components/dashboard/DashboardMobileBottomNav.tsx",
  "src/components/flashcards/FlashcardInteractionHints.tsx",
]);
const unsafeScanSurface = /(?:dashboard|quiz|flashcard|review|canonical|processing|upload|edit\/new|layout|settings)/;
const hardCodedJsx = />\s*([A-Z][A-Za-z][^<{}`\n]{2,})\s*</g;
const approvedTechnical = /^(?:PDF|Word|PowerPoint|Excel|HTML|CSV|JSON|XML|YouTube|Doc2Quiz|Quiz|Flashcards?|FRONT|BACK|ITEM|Q\d*)\b/;
const findings = [];

async function walk(directory) {
  const entries = await readdir(resolve(root, directory), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

for (const base of roots) {
  for (const file of await walk(base)) {
    const normalized = relative(root, resolve(root, file)).replaceAll("\\", "/");
    if (!unsafeScanSurface.test(normalized) || excluded.some((pattern) => pattern.test(normalized))) continue;
    const text = await readFile(resolve(root, file), "utf8");
    const lines = text.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (/\bMath\.random\s*\(|\bgetRandomSlang\s*\(/.test(line) && /return|=>|<|\{/.test(line)) {
        findings.push(`${normalized}:${index + 1}: render-path random slang selection: ${line.trim()}`);
      }
      if (/dangerouslySetInnerHTML/.test(line) && /slang|reaction|support/i.test(lines.slice(Math.max(0, index - 3), index + 4).join(" "))) {
        findings.push(`${normalized}:${index + 1}: slang must render as plain text: ${line.trim()}`);
      }
    });

    if (listedCopyFiles.has(normalized)) {
      for (const match of text.matchAll(hardCodedJsx)) {
        const copy = match[1].replace(/\s+/g, " ").trim();
        if (!copy || approvedTechnical.test(copy) || /^(?:AM|PM|SPACE)$/.test(copy)) continue;
        findings.push(`${normalized}:${lineNumber(text, match.index)}: hard-coded listed-context copy: ${copy}`);
      }
    }
  }
}

if (findings.length) {
  console.error(`Locale coverage audit failed with ${findings.length} finding(s):`);
  for (const finding of findings) console.error(`- ${finding}`);
  process.exitCode = 1;
} else {
  console.log("Locale coverage audit passed: no unapproved listed-context copy or unsafe slang rendering found.");
}
