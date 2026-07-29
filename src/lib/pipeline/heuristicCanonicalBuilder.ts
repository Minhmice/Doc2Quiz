import type { CanonicalBuilderOutput } from "@/lib/pipeline/canonicalSchemas";

function sanitizeFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "document"}.md`;
}

function detectLanguage(markdown: string): string {
  if (/\bMÔN\s*:\s*TIẾNG\s+ANH\b/iu.test(markdown)) {
    return "en";
  }
  const firstQuestionStems = [...markdown.matchAll(
    /^(?:Question|Câu)\s+\d+\s*[.:)]\s*(.+)$/gimu,
  )].slice(0, 12).map((match) => match[1]).join(" ");
  const englishSignals =
    firstQuestionStems.match(/\b(?:the|which|following|according|word|paragraph|passage|best|choose|what|how)\b/giu)?.length ?? 0;
  const vietnameseSignals =
    firstQuestionStems.match(/\b(?:nào|sau|đây|đoạn|từ|câu|chọn|theo|đúng|nhất)\b/giu)?.length ?? 0;
  if (englishSignals >= 3 && englishSignals > vietnameseSignals) {
    return "en";
  }
  if (/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(
    markdown,
  )) {
    return "vi";
  }
  return "en";
}

function cleanExtractedMarkdown(markdown: string): string {
  const lines = markdown
    .replace(/\r\n?/g, "\n")
    .replace(/\f/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(
      (line) =>
        !/^\d+\s+đề thi thử.+Trang\s+\d+$/iu.test(line) &&
        !/^Trang\s+\d+(?:\s*\/\s*\d+)?$/iu.test(line) &&
        !/^thuvienhoclieu\.com(?:\s+Trang\s+\d+)?$/iu.test(line),
    );
  const blocks: string[] = [];
  let current = "";
  const startsNewBlock = (line: string) =>
    /^(?:#{1,3}\s+|(?:Câu|Question)\s+\d+[.:)]|[A-D][.)]\s+|PHẦN\s+[IVX]+|Tư liệu\s+\d+\s*:|-----)/u.test(
      line,
    );

  const flush = () => {
    if (current.trim()) blocks.push(current.trim());
    current = "";
  };
  for (const line of lines) {
    if (!line) {
      flush();
      continue;
    }
    if (startsNewBlock(line)) {
      flush();
      current = line;
      continue;
    }
    current = current ? `${current} ${line}` : line;
  }
  flush();
  return blocks.join("\n\n").trim();
}

function splitMarkdownSections(markdown: string): Array<{ title: string; body: string }> {
  const sections: Array<{ title: string; body: string }> = [];
  let currentTitle = "Overview";
  let currentLines: string[] = [];

  for (const line of markdown.split("\n")) {
    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const body = currentLines.join("\n").trim();
      if (body) {
        sections.push({ title: currentTitle, body });
      }
      currentTitle = heading[2].trim() || "Section";
      currentLines = [];
      continue;
    }
    currentLines.push(line);
  }

  const tail = currentLines.join("\n").trim();
  if (tail) {
    sections.push({ title: currentTitle, body: tail });
  }

  if (sections.length === 0) {
    const trimmed = markdown.trim();
    if (trimmed) {
      sections.push({ title: "Content", body: trimmed });
    }
  }

  return sections.filter((section) => section.body.trim().length > 0);
}

type HeuristicFact = {
  statement: string;
  sourceExcerpt: string;
  answerText: string;
  factType: "definition" | "property" | "process";
  entity: string;
};

function sentenceCandidates(text: string): string[] {
  return (text.match(/[^.!?]+(?:[.!?]+|$)/gu) ?? [])
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function extractExamQuestions(
  markdown: string,
  sectionId: string,
): CanonicalBuilderOutput["extracted_questions"] {
  const blocks = markdown.split(/\n{2,}/u).map((block) => block.trim()).filter(Boolean);
  const phaseOneIndex = blocks.findIndex((block) => /^PHẦN\s+I(?:[.:)\s]|$)/iu.test(block));
  const scoped = phaseOneIndex >= 0 ? blocks.slice(phaseOneIndex + 1) : blocks;
  const phaseTwoIndex = scoped.findIndex((block) => /^PHẦN\s+II(?:[.:)\s]|$)/iu.test(block));
  const detailedAnswerIndex = scoped.findIndex((block) =>
    /^(?:LỜI GIẢI CHI TIẾT|DETAILED (?:ANSWER|SOLUTION))/iu.test(block)
  );
  const cutoffIndexes = [phaseTwoIndex, detailedAnswerIndex].filter((index) => index >= 0);
  const cutoff = cutoffIndexes.length > 0 ? Math.min(...cutoffIndexes) : scoped.length;
  const questionBlocks = scoped.slice(0, cutoff);
  const byNumber = new Map<number, CanonicalBuilderOutput["extracted_questions"][number]>();
  const answerLetters = new Map<number, string>();
  for (const match of markdown.matchAll(/\|\s*(\d+)\s*\|\s*([A-D])\s*(?=\|)/giu)) {
    answerLetters.set(Number(match[1]), match[2].toUpperCase());
  }
  const rangeContexts: Array<{ start: number; end: number; text: string }> = [];
  let activeQuestion: CanonicalBuilderOutput["extracted_questions"][number] | null = null;
  let sharedContext = "";

  for (const block of questionBlocks) {
    const instructionIndex = block.search(
      /(?:Read the following|Mark the letter A,\s*B,\s*C|Choose the word)/iu,
    );
    const contextBlock =
      instructionIndex > 0 ? block.slice(instructionIndex).trim() : block;
    const optionBlock =
      instructionIndex > 0 ? block.slice(0, instructionIndex).trim() : block;
    const rangeMatch =
      /(?:numbered\s+)?(?:questions?|blanks?)\s+from\s+(\d+)\s+to\s+(\d+)/iu.exec(contextBlock);
    if (rangeMatch) {
      rangeContexts.push({
        start: Number(rangeMatch[1]),
        end: Number(rangeMatch[2]),
        text: contextBlock,
      });
    }
    const questionMatch = /^(?:Câu|Question)\s+(\d+)\s*[.:)]\s*([\s\S]*)$/iu.exec(block);
    if (questionMatch) {
      const number = Number(questionMatch[1]);
      if (!Number.isInteger(number) || byNumber.has(number)) {
        activeQuestion = null;
        continue;
      }
      const rawStem = questionMatch[2].trim();
      const firstOption = /(?:^|\s)A[.)]\s+/u.exec(rawStem);
      const stem = firstOption?.index === undefined
        ? rawStem
        : rawStem.slice(0, firstOption.index).trim();
      const groupContext = rangeContexts.find(
        (context) => number >= context.start && number <= context.end,
      )?.text ?? sharedContext;
      const sourceStemIsGeneric = /^Choose the best option\.?$/iu.test(stem);
      const standaloneStem = (!stem || sourceStemIsGeneric)
        ? (
        (/numbered\s+blanks?/iu.test(groupContext)
          ? `Which option best completes blank (${number})?`
          : stem || "Which option is correct?")
        )
        : stem;
      activeQuestion = {
        question: groupContext
          ? `${groupContext}\n\n${standaloneStem}`
          : standaloneStem,
        options: [],
        answer: null,
        section_id: sectionId,
      };
      if (activeQuestion.question) byNumber.set(number, activeQuestion);
      if (firstOption) {
        for (const optionMatch of rawStem.slice(firstOption.index).matchAll(
          /(?:^|\s)([A-D])[.)]\s+([\s\S]*?)(?=(?:\s+[A-D][.)]\s+)|$)/gu,
        )) {
          activeQuestion.options.push(optionMatch[2].trim());
        }
      }
      continue;
    }

    if (/^(?:Cho (?:thông tin|đoạn tư liệu)|Tư liệu\s+\d*\s*:)/iu.test(block)) {
      sharedContext = block;
      activeQuestion = null;
      continue;
    }

    if (!activeQuestion) continue;
    for (const match of optionBlock.matchAll(
      /(?:^|\s)([A-D])[.)]\s+([\s\S]*?)(?=(?:\s+[A-D][.)]\s+)|$)/gu,
    )) {
      const option = match[2].trim();
      if (
        option &&
        !activeQuestion.options.some(
          (candidate) => candidate.normalize("NFKC").toLocaleLowerCase() === option.normalize("NFKC").toLocaleLowerCase(),
        )
      ) {
        activeQuestion.options.push(option);
      }
    }
  }

  return [...byNumber.entries()]
    .sort(([left], [right]) => left - right)
    .map(([number, question]) => {
      const answerLetter = answerLetters.get(number);
      const answerIndex = answerLetter ? answerLetter.charCodeAt(0) - 65 : -1;
      return {
        ...question,
        answer:
          answerIndex >= 0 && answerIndex < question.options.length
            ? question.options[answerIndex]
            : null,
      };
    });
}

function quotedKnowledge(text: string): string[] {
  const quoted = [...text.matchAll(/“([\s\S]+?)”/gu)]
    .map((match) => match[1].trim());
  return quoted.length > 0 ? quoted : [];
}

function deriveFact(sentence: string): HeuristicFact | null {
  if (
    /^(?:Câu\s+\d+|\d+[.)]\s+|[A-Da-d][.)]\s+|PHẦN\s+[IVX]+)/u.test(sentence) ||
    sentence.includes("?") ||
    /(?:thời gian làm bài|số báo danh|đề chính thức|thí sinh trả lời)/iu.test(
      sentence,
    )
  ) {
    return null;
  }

  const relation =
    /^(.+?)\s+(là|is|are|means|refers to|bao gồm|includes|consists of)\s+(.+?)([.!?]*)$/iu.exec(
      sentence,
    );
  if (!relation) return null;

  const entity = relation[1].trim().replace(/[“”"'‘’]+$/gu, "").trim();
  const relationWord = relation[2].toLocaleLowerCase();
  const answerText = relation[3].trim();
  if (
    !answerText ||
    !entity ||
    entity.endsWith("?") ||
    /^(?:đây|đó|nó|this|that|it)(?:\s|$)/iu.test(entity) ||
    /^(?:nội dung|phương án|nhận xét) nào/iu.test(entity)
  ) {
    return null;
  }
  return {
    statement: sentence.replace(/\s+/g, " ").trim(),
    sourceExcerpt: sentence,
    answerText,
    factType:
      relationWord === "bao gồm" ||
      relationWord === "includes" ||
      relationWord === "consists of"
        ? "process"
        : relationWord === "là" ||
            relationWord === "is" ||
            relationWord === "are" ||
            relationWord === "means" ||
            relationWord === "refers to"
          ? "definition"
          : "property",
    entity,
  };
}

function extractFactCandidates(body: string, examLike: boolean): HeuristicFact[] {
  const knowledgeBlocks = examLike ? quotedKnowledge(body) : [body];
  const facts: HeuristicFact[] = [];
  for (const block of knowledgeBlocks) {
    for (const sentence of sentenceCandidates(block)) {
      const fact = deriveFact(sentence);
      if (fact) facts.push(fact);
    }
  }
  return facts;
}

function inferContentType(title: string, body: string): CanonicalBuilderOutput["sections"][number]["content_type"] {
  const sample = `${title}\n${body}`;
  if (/answer\s*key|đáp\s*án|correct answer/i.test(sample)) {
    return "answer_key";
  }
  if (/question|câu hỏi|đề\s*bài|\b\d+\s*[\).]/i.test(sample)) {
    return "question";
  }
  return "theory";
}

/**
 * Local fallback when the AI gateway times out. Builds a schema-valid artifact
 * from headings and sentences so quiz generation can proceed with reduced fidelity.
 */
export function buildHeuristicCanonicalOutput(params: {
  rawMarkdown: string;
  originalFilename: string;
}): CanonicalBuilderOutput {
  const canonicalMarkdown = cleanExtractedMarkdown(params.rawMarkdown);
  const sectionParts = splitMarkdownSections(canonicalMarkdown);
  const titleFromFilename = params.originalFilename
    .replace(/\.[^.]+$/i, "")
    .replace(/[_-]+/g, " ")
    .trim();
  const titleFromSource =
    /^#{1,3}\s+(.+)$/m.exec(canonicalMarkdown)?.[1]?.trim() ?? "";

  const sections = sectionParts.map((section, index) => ({
    id: `sec_${String(index + 1).padStart(3, "0")}`,
    title: section.title,
    content: section.body,
    content_type: inferContentType(section.title, section.body),
  }));

  const atomicFacts: CanonicalBuilderOutput["atomic_facts"] = [];
  const examLike = /\b(?:Câu|Question)\s+\d+[.:)]/iu.test(canonicalMarkdown);
  for (const section of sections) {
    for (const fact of extractFactCandidates(section.content, examLike)) {
      atomicFacts.push({
        fact_id: `fact_${String(atomicFacts.length + 1).padStart(3, "0")}`,
        section_key: section.id,
        statement: fact.statement,
        source_excerpt: fact.sourceExcerpt,
        answer_text: fact.answerText,
        fact_type: fact.factType,
        entities: [fact.entity],
        conditions: [],
        question_opportunities: [
          fact.factType === "definition"
            ? "identify_definition"
            : fact.factType === "process"
              ? "process_order"
              : "match_property",
        ],
        answerable: true,
      });
    }
  }

  const opportunities = atomicFacts.length;
  const hasQuestionSections = sections.some(
    (section) => section.content_type === "question",
  );
  const examSectionId =
    sections.find((section) => /\bCâu\s+\d+[.:)]/iu.test(section.content))?.id ??
    sections[0]?.id ??
    "sec_001";
  const extractedQuestions = examLike
    ? extractExamQuestions(canonicalMarkdown, examSectionId)
    : [];
  const hasGroundingInput = opportunities > 0 || extractedQuestions.length > 0;

  return {
    title:
      titleFromSource ||
      (sections[0]?.title !== "Overview" ? sections[0]?.title : "") ||
      titleFromFilename ||
      "Study document",
    filename: sanitizeFilename(params.originalFilename),
    language: detectLanguage(canonicalMarkdown),
    document_type: hasQuestionSections ? "exam" : "mixed",
    topics: [],
    canonical_markdown: canonicalMarkdown,
    sections,
    extracted_questions: extractedQuestions,
    atomic_facts: atomicFacts,
    source_readiness: {
      pass: hasGroundingInput,
      reasons:
        hasGroundingInput
          ? []
          : ["Heuristic fallback could not extract facts or source questions."],
    },
    max_supported_count: opportunities,
    warnings: [
      "AI canonicalization failed or timed out; used local heuristic fallback with strict fact extraction.",
      ...(extractedQuestions.some((question) => question.answer === null)
        ? ["Unanswered source questions require explicit answer resolution before quiz use."]
        : []),
    ],
  };
}
