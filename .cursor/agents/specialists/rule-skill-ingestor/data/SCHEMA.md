# Local Curated Knowledge Schema

This specialist stores curated knowledge in `catalog.csv`.

Columns:
- `item_id`
- `topic`
- `rule_type`
- `title`
- `guidance`
- `do`
- `dont`
- `severity`
- `tags`
- `source_ref`
- `source_section`

Rules:
- Keep rows concise and specialist-local.
- Use only `critical`, `high`, `medium`, or `low` for `severity`.
- Use `source_ref` and `source_section` to point back to the source rule or skill.

