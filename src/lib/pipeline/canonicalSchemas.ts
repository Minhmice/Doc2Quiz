import { z } from "zod";

export const documentTypeSchema = z.enum(["theory", "exam", "mixed"]);

export const sectionContentTypeSchema = z.enum([
  "theory",
  "question",
  "answer_key",
  "example",
  "reference",
]);

export const canonicalSectionSchema = z.object({
  id: z.string().regex(/^sec_\d{3}$/, "Must match sec_001 format"),
  title: z.string().min(1),
  content: z.string().min(1, "Section content cannot be empty"),
  content_type: sectionContentTypeSchema,
});

export const extractedQuestionSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.string()),
  answer: z.string().nullable(),
  section_id: z.string().regex(/^sec_\d{3}$/, "Must reference a valid section_id"),
});

export const factTypeSchema = z.enum([
  "definition",
  "property",
  "rule",
  "comparison",
  "process",
  "numeric",
  "classification",
]);

export const semanticIntentSchema = z.enum([
  "identify_definition",
  "match_property",
  "classify",
  "compare",
  "supported_statement",
  "identify_condition",
  "process_order",
  "direct_calculation",
  "apply_rule",
  "source_question",
]);

export const atomicFactSchema = z.object({
  fact_id: z.string().regex(/^fact_\d{3}$/),
  section_key: z.string().regex(/^sec_\d{3}$/),
  statement: z.string().min(1),
  source_excerpt: z.string().min(1),
  answer_text: z.string().min(1),
  fact_type: factTypeSchema,
  entities: z.array(z.string()),
  conditions: z.array(z.string()),
  question_opportunities: z.array(semanticIntentSchema).min(1),
  answerable: z.boolean(),
});

export const sourceReadinessSchema = z.object({
  pass: z.boolean(),
  reasons: z.array(z.string()),
});

export function allowedSemanticIntentsForFact(fact: {
  fact_type: z.infer<typeof factTypeSchema>;
  conditions: string[];
}): Set<z.infer<typeof semanticIntentSchema>> {
  const byType = {
    definition: "identify_definition",
    property: "match_property",
    rule: "supported_statement",
    comparison: "compare",
    process: "process_order",
    numeric: "direct_calculation",
    classification: "classify",
  } as const;
  const allowed = new Set<z.infer<typeof semanticIntentSchema>>([
    byType[fact.fact_type],
    "source_question",
  ]);
  if (fact.conditions.length > 0) {
    allowed.add("identify_condition");
  }
  return allowed;
}

export const canonicalBuilderOutputSchema = z.object({
  title: z.string().min(1),
  filename: z
    .string()
    .min(1)
    .refine((s) => s.endsWith(".md"), "Filename must end with .md")
    .refine((s) => s === s.toLowerCase(), "Filename must be lowercase")
    .refine((s) => !s.includes(" "), "Filename must not contain spaces")
    .refine(
      (s) => /^[\w.\-/]+\.md$/.test(s),
      "Filename must be filesystem-safe and end with .md",
    ),
  language: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[a-z]{2,3}(-[A-Z]{2})?$/, "Use ISO 639 language codes (en, vi, zh, fr, de, ...)"),
  document_type: documentTypeSchema,
  topics: z.array(z.string()),
  canonical_markdown: z.string().min(1),
  sections: z.array(canonicalSectionSchema).min(1),
  extracted_questions: z.array(extractedQuestionSchema),
  atomic_facts: z.array(atomicFactSchema),
  source_readiness: sourceReadinessSchema,
  max_supported_count: z.number().int().min(0).max(1000),
  warnings: z.array(z.string()),
}).superRefine((output, ctx) => {
  const sectionBodies = new Map(
    output.sections.map((section) => [section.id, section.content]),
  );
  const factIds = new Set<string>();
  const opportunities = new Set<string>();

  for (const fact of output.atomic_facts) {
    if (factIds.has(fact.fact_id)) {
      ctx.addIssue({
        code: "custom",
        path: ["atomic_facts"],
        message: `Duplicate fact_id: ${fact.fact_id}`,
      });
    }
    factIds.add(fact.fact_id);
    if (!sectionBodies.has(fact.section_key)) {
      ctx.addIssue({
        code: "custom",
        path: ["atomic_facts", fact.fact_id, "section_key"],
        message: `Unknown section_key: ${fact.section_key}`,
      });
    }
    if (!sectionBodies.get(fact.section_key)?.includes(fact.source_excerpt)) {
      ctx.addIssue({
        code: "custom",
        path: ["atomic_facts", fact.fact_id, "source_excerpt"],
        message: "source_excerpt must belong to its referenced section",
      });
    }
    if (!output.canonical_markdown.includes(fact.source_excerpt)) {
      ctx.addIssue({
        code: "custom",
        path: ["atomic_facts", fact.fact_id, "source_excerpt"],
        message: "source_excerpt must be an exact canonical_markdown substring",
      });
    }
    if (!fact.source_excerpt.includes(fact.answer_text)) {
      ctx.addIssue({
        code: "custom",
        path: ["atomic_facts", fact.fact_id, "answer_text"],
        message: "answer_text must be an exact source_excerpt substring",
      });
    }
    if (fact.answerable) {
      for (const intent of fact.question_opportunities) {
        if (!allowedSemanticIntentsForFact(fact).has(intent)) {
          ctx.addIssue({
            code: "custom",
            path: ["atomic_facts", fact.fact_id, "question_opportunities"],
            message: `${intent} is unsupported for ${fact.fact_type}`,
          });
        }
        opportunities.add(`${fact.fact_id}:${intent}`);
      }
    }
  }

  if (output.max_supported_count !== opportunities.size) {
    ctx.addIssue({
      code: "custom",
      path: ["max_supported_count"],
      message: `Expected ${opportunities.size} from unique answerable fact opportunities`,
    });
  }
  if (
    output.source_readiness.pass &&
    opportunities.size === 0 &&
    output.extracted_questions.length === 0
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["source_readiness", "pass"],
      message: "Ready source must contain an answerable fact or an extracted question",
    });
  }
});

export type CanonicalBuilderOutput = z.infer<typeof canonicalBuilderOutputSchema>;
export type AtomicFact = z.infer<typeof atomicFactSchema>;
export type SemanticIntent = z.infer<typeof semanticIntentSchema>;
