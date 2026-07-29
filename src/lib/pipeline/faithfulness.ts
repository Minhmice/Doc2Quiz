/** Post-LLM faithfulness checks - P0 guardrails against hallucination.
 *  Runs AFTER Zod validation, BEFORE Supabase persist.
 *  Catches semantic issues Zod cannot: invented titles, orphan refs, empty content.
 */
export type FaithfulnessWarning = string;

export interface CanonicalInput {
  title: string; filename: string;
  canonical_markdown: string; raw_markdown: string;
  sections: Array<{ id: string; title: string; content: string }>;
  extracted_questions: Array<{ section_id: string }>;
}

export interface QuizInput {
  canonical_markdown: string;
  concepts: Array<{ concept_id: string; section_key?: string }>;
  questions: Array<{ concept_id: string; prompt: string; choices: string[]; explanation?: string }>;
  validSectionKeys: string[];
}

export interface FlashcardInput {
  concepts: Array<{ concept_id: string; section_key?: string }>;
  cards: Array<{ front: string; back: string; concept_id?: string }>;
  validSectionKeys: string[];
}

export interface Result { ok: boolean; warnings: FaithfulnessWarning[]; }

const n = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();

function titleInSource(title: string, raw: string): FaithfulnessWarning | null {
  const nt = n(title); const nr = n(raw);
  if (!nt) return "Title is empty.";
  if (nr.includes(nt) || nt.length < 3) return null;
  const words = nt.split(/\s+/).filter(Boolean);
  const matched = words.filter((w) => nr.includes(w));
  if (matched.length / words.length >= 0.6) return null;
  return `Title "${title}" may be invented: only ${matched.length}/${words.length} words found in source.`;
}

function filenameOk(s: string): FaithfulnessWarning | null {
  if (!s.endsWith(".md")) return `Filename "${s}" lacks .md extension.`;
  if (s !== s.toLowerCase()) return `Filename "${s}" not lowercase.`;
  if (s.includes(" ")) return `Filename "${s}" contains spaces.`;
  if (/[^\w.\-/]/.test(s)) return `Filename "${s}" has invalid characters.`;
  return null;
}

function sectionsConsistent(md: string, sections: Array<{ content: string }>): FaithfulnessWarning | null {
  if (!sections.length) return "No sections produced.";
  const body = sections.map((s) => s.content).join("\n").trim();
  if (!body) return "All sections have empty content.";
  const cw = new Set(n(md).split(/\s+/).filter((w) => w.length > 3));
  const sw = new Set(n(body).split(/\s+/).filter((w) => w.length > 3));
  if (!cw.size || !sw.size) return null;
  const overlap = [...cw].filter((w) => sw.has(w)).length;
  const minSize = Math.min(cw.size, sw.size);
  if (overlap / minSize < 0.3)
    return `Low overlap (${(overlap * 100 / minSize).toFixed(0)}%) between canonical_markdown and sections.`;
  return null;
}

function idsContinuous(ss: Array<{ id: string }>): FaithfulnessWarning | null {
  for (let i = 0; i < ss.length; i++) {
    const exp = `sec_${String(i + 1).padStart(3, "0")}`;
    if (ss[i].id !== exp) return `Non-sequential section IDs: expected ${exp} at idx ${i}, got ${ss[i].id}.`;
  }
  return null;
}

function orphanSectionRefs(eqs: Array<{ section_id: string }>, valid: string[]): FaithfulnessWarning | null {
  const set = new Set(valid);
  for (const q of eqs) if (!set.has(q.section_id)) return `Orphan section_id "${q.section_id}" in extracted_questions.`;
  return null;
}

export function checkCanonical(input: CanonicalInput): Result {
  const w: FaithfulnessWarning[] = [];
  const t = titleInSource(input.title, input.raw_markdown); if (t) w.push(t);
  const f = filenameOk(input.filename); if (f) w.push(f);
  const c = sectionsConsistent(input.canonical_markdown, input.sections); if (c) w.push(c);
  const s = idsContinuous(input.sections); if (s) w.push(s);
  const o = orphanSectionRefs(input.extracted_questions, input.sections.map((x) => x.id)); if (o) w.push(o);
  return { ok: true, warnings: w };
}

function conceptRefs(concepts: Array<{ concept_id: string; section_key?: string }>, keys: string[]): FaithfulnessWarning[] {
  const set = new Set(keys);
  return concepts.filter((c) => c.section_key && !set.has(c.section_key))
    .map((c) => `Concept "${c.concept_id}" references invalid section_key "${c.section_key}".`);
}

function questionRefs(questions: Array<{ concept_id: string }>, valid: string[]): FaithfulnessWarning[] {
  const set = new Set(valid);
  return questions.filter((q) => !set.has(q.concept_id))
    .map((q) => `Question references invalid concept_id "${q.concept_id}".`);
}

function dupChoices(questions: Array<{ choices: string[]; prompt?: string }>): FaithfulnessWarning[] {
  return questions.filter((q) => new Set(q.choices.map((c) => c.toLowerCase().trim())).size < q.choices.length)
    .map((q) => `Duplicate choices in "${(q.prompt ?? "").slice(0, 60)}...".`);
}

function missingExplanations(questions: Array<{ prompt?: string; explanation?: string }>): FaithfulnessWarning[] {
  return questions.filter((q) => !q.explanation?.trim())
    .map((q) => `Missing explanation in "${(q.prompt ?? "").slice(0, 60)}...".`);
}

function identicalSides(cards: Array<{ front: string; back: string }>): FaithfulnessWarning[] {
  return cards.filter((c) => c.front.trim().toLowerCase() === c.back.trim().toLowerCase())
    .map((c) => `Identical front/back: "${c.front.slice(0, 60)}...".`);
}

export function checkQuiz(input: QuizInput): Result {
  return {
    ok: true,
    warnings: [
      ...conceptRefs(input.concepts, input.validSectionKeys),
      ...questionRefs(input.questions, input.concepts.map((c) => c.concept_id)),
      ...dupChoices(input.questions),
      ...missingExplanations(input.questions),
    ],
  };
}

export function checkFlashcard(input: FlashcardInput): Result {
  return {
    ok: true,
    warnings: [
      ...conceptRefs(input.concepts, input.validSectionKeys),
      ...identicalSides(input.cards),
    ],
  };
}
