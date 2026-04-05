#!/usr/bin/env python3
"""Smoke-test routing and specialist-local search behavior."""

from __future__ import annotations

import json
import subprocess
import sys

from search_core import AGENTS_DIR, search_skill_routes, specialist_search_script_path

FIXTURE_PATH = AGENTS_DIR / "validation" / "search-smoke-tests.json"


def run_search_script(script_path, query):
    completed = subprocess.run(
        [sys.executable, str(script_path), query, "--json", "--max-results", "1"],
        check=False,
        capture_output=True,
        text=True,
    )
    if completed.returncode != 0:
        return completed.returncode, completed.stderr.strip() or completed.stdout.strip()
    try:
        return 0, json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        return 1, f"Invalid JSON from {script_path}: {exc}"


def main() -> int:
    failures: list[str] = []
    fixtures = json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))

    for case in fixtures:
        results = search_skill_routes(case["query"], max_results=1)
        if not results:
            failures.append(f"No skill-finder result for query: {case['query']}")
            continue
        top = results[0]
        if top["field_id"] != case["expected_field_id"]:
            failures.append(
                "Skill-finder mismatch: "
                f"query={case['query']!r} expected={case['expected_field_id']} got={top['field_id']}"
            )
            continue

        specialist_id = top["specialist_id"]
        if specialist_id == "orchestrator":
            continue
        script_path = specialist_search_script_path(specialist_id)
        if not script_path.exists():
            failures.append(f"Missing specialist search script for {specialist_id}: {script_path}")
            continue
        code, payload = run_search_script(script_path, case["query"])
        if code != 0:
            failures.append(f"Search script failed for {specialist_id}: {payload}")
            continue
        results = payload.get("results", [])
        if not results:
            failures.append(f"No specialist-local search result for {specialist_id}: {case['query']}")

    if failures:
        print("Search smoke tests failed:")
        for failure in failures:
            print(f"- {failure}")
        return 1

    print("Search smoke tests passed for skill-finder and specialist-local search scripts.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
