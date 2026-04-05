#!/usr/bin/env python3
"""Validate structural links between registry, rules, and specialist-local knowledge."""

from __future__ import annotations

import csv

from search_core import (
    ALLOWED_FIELDS,
    ORCHESTRATOR_SKILL,
    RULES_DIR,
    SKILLS_DIR,
    load_rule_map_rows,
    load_skill_finder_rows,
    non_frontend_specialist_ids,
    parse_registry_agents,
    specialist_catalog_path,
    specialist_core_path,
    specialist_schema_path,
    specialist_search_script_path,
    specialist_dir,
)


def count_rows(path):
    with path.open("r", encoding="utf-8", newline="") as handle:
        return sum(1 for _ in csv.DictReader(handle))


def main() -> int:
    errors: list[str] = []
    agents = parse_registry_agents()
    registry_by_id = {agent["id"]: agent for agent in agents}

    for agent in agents:
        field_id = agent.get("field_id")
        if not field_id:
            errors.append(f"Registry agent missing field_id: {agent['id']}")
            continue
        if field_id not in ALLOWED_FIELDS:
            errors.append(f"Registry agent has unknown field_id: {agent['id']} -> {field_id}")

    for agent in agents:
        field_id = agent.get("field_id")
        if not field_id:
            continue
        if agent["id"] == "orchestrator":
            if not ORCHESTRATOR_SKILL.exists():
                errors.append("Missing orchestrator skill file")
            continue
        expected_skill = SKILLS_DIR / f"{field_id}.md"
        if not expected_skill.exists():
            errors.append(f"Missing skill file for field {field_id}: {expected_skill}")

    mapped_rules = load_rule_map_rows()
    mapped_rule_files = {row["rule_file"] for row in mapped_rules}
    actual_rule_files = {path.name for path in RULES_DIR.glob("*.mdc")}
    if mapped_rule_files != actual_rule_files:
        missing = sorted(actual_rule_files - mapped_rule_files)
        extra = sorted(mapped_rule_files - actual_rule_files)
        if missing:
            errors.append(f"rule-map.csv is missing rules: {missing}")
        if extra:
            errors.append(f"rule-map.csv references missing rule files: {extra}")

    for row in mapped_rules:
        specialist_id = row["owner_specialist_id"]
        if row["status"] == "external":
            continue
        if specialist_id not in registry_by_id:
            errors.append(f"Mapped rule uses unknown specialist: {row['rule_id']} -> {specialist_id}")

    for specialist_id in non_frontend_specialist_ids():
        base_dir = specialist_dir(specialist_id)
        catalog_path = specialist_catalog_path(specialist_id)
        schema_path = specialist_schema_path(specialist_id)
        core_path = specialist_core_path(specialist_id)
        search_path = specialist_search_script_path(specialist_id)
        if not base_dir.exists():
            errors.append(f"Missing specialist directory: {base_dir}")
        if not catalog_path.exists():
            errors.append(f"Missing specialist catalog: {catalog_path}")
        elif count_rows(catalog_path) == 0:
            errors.append(f"Specialist catalog is empty: {catalog_path}")
        if not schema_path.exists():
            errors.append(f"Missing specialist schema doc: {schema_path}")
        if not core_path.exists():
            errors.append(f"Missing specialist core script: {core_path}")
        if not search_path.exists():
            errors.append(f"Missing specialist search script: {search_path}")

    frontend_data_dir = specialist_dir("frontend-developer") / "data"
    frontend_search_path = specialist_search_script_path("frontend-developer")
    if not frontend_data_dir.exists():
        errors.append(f"Missing frontend specialist data directory: {frontend_data_dir}")
    if not frontend_search_path.exists():
        errors.append(f"Missing frontend specialist search script: {frontend_search_path}")

    skill_finder_rows = load_skill_finder_rows()
    seen_route_fields = set()
    for row in skill_finder_rows:
        if row["field_id"] not in ALLOWED_FIELDS:
            errors.append(f"skill-finder.csv uses unknown field_id: {row['route_id']} -> {row['field_id']}")
        if row["specialist_id"] not in registry_by_id:
            errors.append(f"skill-finder.csv uses unknown specialist_id: {row['route_id']} -> {row['specialist_id']}")
        seen_route_fields.add(row["field_id"])

    for field_id in ALLOWED_FIELDS:
        if field_id == "external":
            continue
        if field_id not in seen_route_fields:
            errors.append(f"skill-finder.csv has no route for field: {field_id}")

    if errors:
        print("Agent system validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("Agent system validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
