#!/usr/bin/env node
/**
 * Phase 38 — smoke: validate JSONL export lines have `{ studySetId, question }` keys.
 * Usage: node scripts/eval-export-smoke.mjs path/to/export.jsonl
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/eval-export-smoke.mjs <export.jsonl>");
  process.exit(2);
}

const text = readFileSync(resolve(file), "utf8");
const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
let ok = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    console.error(`Line ${i + 1}: invalid JSON`);
    process.exit(1);
  }
  if (typeof obj !== "object" || obj === null || !("studySetId" in obj) || !("question" in obj)) {
    console.error(`Line ${i + 1}: expected { studySetId, question }`);
    process.exit(1);
  }
  ok += 1;
}
console.log(`OK: ${ok} line(s) validated.`);
process.exit(0);
