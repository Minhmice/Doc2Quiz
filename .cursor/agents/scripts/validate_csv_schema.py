#!/usr/bin/env python3
"""Validate canonical CSV files used by the agent system."""

from __future__ import annotations

import csv

from search_core import (
    RULE_MAP_PATH,
    SKILL_FINDER_PATH,
    non_frontend_specialist_ids,
    specialist_catalog_path,
)

EXPECTED_SHARED_HEADERS = {
    RULE_MAP_PATH: [
        "rule_id",
        "rule_file",
        "owner_field_id",
        "owner_specialist_id",
        "status",
        "ingest_mode",
        "tags",
        "notes",
    ],
    SKILL_FINDER_PATH: [
        "route_id",
        "field_id",
        "specialist_id",
        "keywords",
        "examples",
        "priority",
        "notes",
    ],
}

SPECIALIST_CATALOG_HEADERS = [
    "item_id",
    "topic",
    "rule_type",
    "title",
    "guidance",
    "do",
    "dont",
    "severity",
    "tags",
    "source_ref",
    "source_section",
]

ALLOWED_RULE_STATUS = {"active", "reference", "external", "orchestrator"}
ALLOWED_INGEST_MODE = {"curated", "reference", "none", "direct"}
ALLOWED_SEVERITY = {"critical", "high", "medium", "low"}


def load_rows(path):
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        return reader.fieldnames or [], list(reader)


def validate_rule_map(rows):
    errors = []
    seen = set()
    for row in rows:
        if row["rule_id"] in seen:
            errors.append(f"Duplicate rule_id in rule-map.csv: {row['rule_id']}")
        seen.add(row["rule_id"])
        if row["status"] not in ALLOWED_RULE_STATUS:
            errors.append(f"Invalid rule status for {row['rule_id']}: {row['status']}")
        if row["ingest_mode"] not in ALLOWED_INGEST_MODE:
            errors.append(f"Invalid ingest mode for {row['rule_id']}: {row['ingest_mode']}")
        if row["status"] == "external" and row["owner_field_id"] != "external":
            errors.append(f"External rule must use owner_field_id=external: {row['rule_id']}")
        if row["status"] != "external" and not row["owner_specialist_id"]:
            errors.append(f"Non-external rule is missing owner_specialist_id: {row['rule_id']}")
    return errors


def validate_skill_finder(rows):
    errors = []
    seen = set()
    for row in rows:
        if row["route_id"] in seen:
            errors.append(f"Duplicate route_id in skill-finder.csv: {row['route_id']}")
        seen.add(row["route_id"])
        try:
            priority = int(row["priority"])
        except ValueError:
            errors.append(f"Priority must be an integer: {row['route_id']}")
            continue
        if priority < 1 or priority > 5:
            errors.append(f"Priority must be in range 1-5: {row['route_id']}")
    return errors


def validate_catalog(rows, specialist_id):
    errors = []
    seen = set()
    for row in rows:
        if row["item_id"] in seen:
            errors.append(f"Duplicate item_id in {specialist_id} catalog: {row['item_id']}")
        seen.add(row["item_id"])
        if row["severity"] not in ALLOWED_SEVERITY:
            errors.append(f"Invalid severity in {specialist_id} catalog: {row['item_id']} -> {row['severity']}")
        for key, value in row.items():
            if not value.strip():
                errors.append(f"Empty value in {specialist_id} catalog: {row['item_id']} -> {key}")
    return errors


def main() -> int:
    errors: list[str] = []
    for path, headers in EXPECTED_SHARED_HEADERS.items():
        actual_headers, rows = load_rows(path)
        if actual_headers != headers:
            errors.append(f"Header mismatch in {path}: expected {headers}, got {actual_headers}")
            continue
        if path == RULE_MAP_PATH:
            errors.extend(validate_rule_map(rows))
        elif path == SKILL_FINDER_PATH:
            errors.extend(validate_skill_finder(rows))

    for specialist_id in non_frontend_specialist_ids():
        path = specialist_catalog_path(specialist_id)
        if not path.exists():
            errors.append(f"Missing catalog for specialist {specialist_id}: {path}")
            continue
        actual_headers, rows = load_rows(path)
        if actual_headers != SPECIALIST_CATALOG_HEADERS:
            errors.append(
                f"Header mismatch in {path}: expected {SPECIALIST_CATALOG_HEADERS}, got {actual_headers}"
            )
            continue
        errors.extend(validate_catalog(rows, specialist_id))

    if errors:
        print("CSV schema validation failed:")
        for error in errors:
            print(f"- {error}")
        return 1

    print("CSV schema validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
