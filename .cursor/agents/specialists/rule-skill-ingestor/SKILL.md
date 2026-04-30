---
name: rule-skill-ingestor
model: inherit
description: Ingest new Cursor rules/skills into the agent system data (rules, mappings, catalogs).
---

# Rule & Skill Ingestor

## Mission

Safely ingest user-provided Cursor rules (`.mdc`) and agent skills (`.md`) into the repo’s agent system data: files, mappings, and specialist catalogs.

## Invoke When

- The user provides a new `.mdc` rule or wants to add/update a rule from raw text.
- The user provides a new `.md` skill doc (field skill or specialist SKILL) to add/update.
- The user wants mappings/catalogs updated so routing/search can find the new content.

## Boundaries

- Do not introduce external Python dependencies.
- Keep CSV headers and validation passing.
- Prefer additive edits; do not delete existing rules/mappings unless explicitly requested.

## What the user should provide

- **Rule ingestion**: either a file path to a `.mdc` rule **or** the rule text via stdin.
- **Skill ingestion**: either a file path to a `.md` skill **or** the skill text via stdin.
- **Metadata** (rules): a stable `--rule-id` and ownership (`--owner-field-id`, `--owner-specialist-id`). Optional tags/notes.

## What it writes/updates (artifacts)

- **Rule content**: `.cursor/rules/<rule-file>.mdc`
- **Rule mapping**: `.cursor/agents/mappings/rule-map.csv` (upsert by `rule_id`)
- **Optional curated knowledge row**: `.cursor/agents/specialists/<owner-specialist-id>/data/catalog.csv` (upsert by `item_id`, unless `--no-catalog`)
- **Field skill content**: `.cursor/agents/skills/<owner-field-id>.md` (for `ingest.py skill --skill-target field`)

## Bundled field knowledge (reference)

Some standalone skill folders are **merged into the repo** instead of staying as separate installable skills:

| Topic                 | Where it lives                                          | Lookup                                                                                                      |
| --------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| **Responsive design** | `.cursor/agents/skills/frontend.md` § Responsive design | `python3 …/frontend-developer/scripts/search.py "<q>" -d responsive` → `data/responsive-design.csv`         |
| **Stitch (MCP)**      | `.cursor/agents/skills/stitch.md`                       | **Opt-in only** — load when the user explicitly asks for Stitch; do not merge into default frontend context |

When ingesting a **new** standalone skill that duplicates frontend concerns, prefer extending `frontend.md` + `frontend-developer/data/*.csv` (and optional `-d` domain in `core.py`) instead of leaving duplicate roots.

## Safety constraints

- **No destructive overwrite by default**: if the destination rule/skill file already exists and content differs, the command fails unless `--overwrite` is set.
- **Backups**: before rewriting any existing CSV or overwriting a destination file, a timestamped `*.bak` file is created next to it.
- **Idempotent intent**:
  - `rule-map.csv` is upserted by `rule_id`.
  - Specialist `catalog.csv` is upserted by `item_id`.
  - Rule/skill destination files are only replaced when content differs and `--overwrite` is used.

## CLI (examples)

Ingest a rule from a file path (copy into `.cursor/rules/` and update `rule-map.csv`):

```bash
python3 .cursor/agents/specialists/rule-skill-ingestor/scripts/ingest.py rule \
  --input-path path/to/my-rule.mdc \
  --rule-id my-rule \
  --owner-field-id backend \
  --owner-specialist-id backend-developer \
  --status active \
  --ingest-mode curated \
  --tags "backend,api"
```

Ingest a rule from stdin (creates a normalized filename under `.cursor/rules/`):

```bash
cat my-rule.mdc | python3 .cursor/agents/specialists/rule-skill-ingestor/scripts/ingest.py rule \
  --stdin \
  --rule-id my-rule \
  --rule-title "My Rule Title" \
  --owner-field-id backend \
  --owner-specialist-id backend-developer
```

Overwrite an existing destination rule file (creates a `.bak` first):

```bash
python3 .cursor/agents/specialists/rule-skill-ingestor/scripts/ingest.py rule \
  --input-path path/to/my-rule.mdc \
  --overwrite \
  --rule-id my-rule \
  --owner-field-id backend \
  --owner-specialist-id backend-developer
```

Ingest/update a field skill (writes `.cursor/agents/skills/<field>.md`):

```bash
python3 .cursor/agents/specialists/rule-skill-ingestor/scripts/ingest.py skill \
  --input-path path/to/backend.md \
  --skill-target field \
  --owner-field-id backend
```

Overwrite an existing field skill file (creates a `.bak` first):

```bash
python3 .cursor/agents/specialists/rule-skill-ingestor/scripts/ingest.py skill \
  --input-path path/to/backend.md \
  --overwrite \
  --skill-target field \
  --owner-field-id backend
```
