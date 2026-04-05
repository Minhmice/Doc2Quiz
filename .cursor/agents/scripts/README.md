# Agent Search and Validation Scripts

These scripts implement shared routing and validation for the specialist-local knowledge system.

## Commands

- `python3 .cursor/agents/scripts/find_skill.py "fix auth route"`
- `python3 .cursor/agents/scripts/search_curated.py "ownership validation" --field backend`
- `python3 .cursor/agents/scripts/validate_agent_system.py`
- `python3 .cursor/agents/scripts/validate_csv_schema.py`
- `python3 .cursor/agents/scripts/test_search_smoke.py`

## Design Notes

- Routing metadata stays shared in `mappings/`.
- Curated CSV knowledge lives inside each specialist folder.
- `search_curated.py` is a dispatcher, not the primary knowledge source.
- Frontend keeps its existing specialist-local UI system as an exception.
