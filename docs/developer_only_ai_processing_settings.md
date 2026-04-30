# Developer-Only AI Processing Settings

## Purpose

Define an internal-only function area for choosing document-processing engines by user tier.

This setting must not appear in the public user interface. It is for developers/admins only.

## Core Decision

The app should support multiple document-processing backends:

| User tier | Processing engine | Purpose |
|---|---|---|
| Free | MinerU 2.5 | Local/open-source document parsing and OCR |
| Pro | ChatGPT / OpenAI API | Higher-quality AI parsing, reasoning, correction, and analysis |

## Visibility Rule

This feature is **developer-only**.

Do not expose these controls in:
- Dashboard
- User settings
- Public onboarding
- Upload flow
- Pricing UI
- Study set editor
- Practice screen

Allowed locations:
- `.env`
- internal config file
- admin-only developer panel
- server-side feature flag
- protected debug route, only in development

## Function Name Suggestion

```ts
resolveDocumentProcessingEngine(userTier: UserTier): ProcessingEngine
```

## Type Draft

```ts
type UserTier = "free" | "pro" | "admin";

type ProcessingEngine =
  | "mineru25"
  | "openai_chatgpt";

type EngineConfig = {
  engine: ProcessingEngine;
  visibleToUser: false;
  reason: string;
};
```

## Behaviour

```ts
function resolveDocumentProcessingEngine(userTier: UserTier): EngineConfig {
  if (userTier === "pro" || userTier === "admin") {
    return {
      engine: "openai_chatgpt",
      visibleToUser: false,
      reason: "Pro users use higher-quality AI parsing and analysis.",
    };
  }

  return {
    engine: "mineru25",
    visibleToUser: false,
    reason: "Free users use MinerU 2.5 for cost-controlled document parsing.",
  };
}
```

## Rules

1. `contentKind` stays unchanged after creation.
   - Quiz stays quiz.
   - Flashcards stay flashcards.
   - No quiz-to-flashcard conversion.
   - No flashcard-to-quiz conversion.

2. AI engine selection is internal.
   - User should not manually choose ChatGPT or MinerU.
   - App decides by tier/config.

3. API keys must not be saved on every keystroke.
   - Use explicit save flow:
     ```text
     Edit fields → Save settings → Test connection
     ```

4. Free path must work without OpenAI key.
   - MinerU 2.5 should be usable as fallback/default for free users.

5. Pro path can use OpenAI.
   - Better parsing.
   - Better correction.
   - Better structured output validation.
   - Better explanation/review assistance.

## Proposed Environment Variables

```env
DOC_PROCESSING_MODE=auto
FREE_DOC_ENGINE=mineru25
PRO_DOC_ENGINE=openai_chatgpt
ENABLE_DEV_ENGINE_PANEL=false
OPENAI_API_KEY=
MINERU25_ENDPOINT=http://localhost:8090
```

## Routing / Flow

```text
Upload PDF
→ detect user tier
→ resolveDocumentProcessingEngine(userTier)
→ parse document with selected engine
→ save parsed output
→ send user to review screen
```

## Developer Panel Draft

Only for development/admin.

Fields:
- Current user tier
- Resolved engine
- MinerU endpoint health
- OpenAI key status: configured / missing
- Last parse engine used
- Last parse duration
- Last parse error

Actions:
- Test MinerU connection
- Test OpenAI connection
- Run sample parse
- View raw parsed JSON

## Do Not Build Yet

Avoid these for now:
- Public engine selector
- User-facing “use ChatGPT” toggle
- Conversion between quiz and flashcards
- Complex billing logic
- Auto-upgrade prompt inside upload flow

## Future Improvement

Later, Pro users may get:
- Better structured question extraction
- Better answer validation
- Low-confidence question repair
- Explanation generation
- OCR correction
- Multi-page reasoning
- Table/diagram-aware parsing

Free users keep:
- MinerU 2.5 OCR/parser
- Basic extraction
- Review manually before practice

## Acceptance Criteria

- Engine choice is resolved internally.
- No public UI exposes engine choice.
- Free user path works without OpenAI.
- Pro user path can use OpenAI.
- Settings page no longer saves API fields on every keystroke.
- `Save settings` and `Test connection` are separate actions.
- Quiz/flashcard conversion entry points do not exist.
