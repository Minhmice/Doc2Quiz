# Skill: Agent System

# Skill: Agent System

## Job (what this skill must do)

Ingest new Cursor rules and skills into the repository’s agent system so routing, mappings, and specialist-local catalogs stay consistent and validation scripts pass.

## What the skill must use

- **Specialist**: `.cursor/agents/specialists/rule-skill-ingestor/SKILL.md` — act as **rule-skill-ingestor**.
- **Core mappings**: `.cursor/agents/mappings/rule-map.csv`, `.cursor/agents/mappings/skill-finder.csv`, `.cursor/agents/registry.yaml`
- **Validation scripts**: `.cursor/agents/scripts/validate_agent_system.py`, `.cursor/agents/scripts/validate_csv_schema.py`, `.cursor/agents/scripts/test_search_smoke.py`

## Guidance (invoke when, critical rules, boundaries)

- **Invoke when**: adding/updating Cursor rules (`.mdc`) or agent skills (`.md`); updating mappings/catalogs for routing/search.
- **Critical rules**: keep CSV headers unchanged; keep catalogs non-empty; keep rule-map aligned to `.cursor/rules/*.mdc`.
- **Boundaries**: do not add external dependencies; do not delete existing rules/mappings without explicit instruction.

