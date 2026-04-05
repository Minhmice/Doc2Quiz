#!/usr/bin/env python3
"""Find the best specialist route for a task description."""

from __future__ import annotations

import argparse
import json

from search_core import search_skill_routes


def format_results(query: str, results: list[dict[str, str]]) -> str:
    lines = [
        "## Skill Finder",
        f"Query: {query}",
        "",
    ]
    if not results:
        lines.append("No route suggestions found.")
        return "\n".join(lines)

    for index, row in enumerate(results, start=1):
        lines.append(f"{index}. {row['field_id']} -> {row['specialist_id']}")
        lines.append(f"   Keywords: {row['keywords']}")
        lines.append(f"   Examples: {row['examples']}")
        lines.append(f"   Notes: {row['notes']}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Suggest the best field and specialist for a task description.")
    parser.add_argument("query", help="Task description or routing query")
    parser.add_argument("--max-results", "-n", type=int, default=3, help="Maximum number of suggestions")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    args = parser.parse_args()

    results = search_skill_routes(args.query, max_results=args.max_results)
    payload = {
        "query": args.query,
        "results": results,
    }
    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0

    print(format_results(args.query, results))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
