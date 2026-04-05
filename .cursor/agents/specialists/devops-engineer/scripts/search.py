#!/usr/bin/env python3
"""Local curated search for devops-engineer."""

from __future__ import annotations

import argparse
import json

from core import MAX_RESULTS, SPECIALIST_ID, search_catalog, search_raw_refs


def format_results(query: str, results: list[dict[str, str]]) -> str:
    lines = ["## Curated Knowledge Search", f"Query: {query}", f"Specialist: {SPECIALIST_ID}", ""]
    if not results:
        lines.append("No curated results found.")
        return "\n".join(lines)
    for index, row in enumerate(results, start=1):
        lines.append(f"{index}. [{row['severity']}] {row['title']} ({row['rule_type']})")
        lines.append(f"   Topic: {row['topic']}")
        lines.append(f"   Guidance: {row['guidance']}")
        lines.append(f"   Do: {row['do']}")
        lines.append(f"   Don't: {row['dont']}")
        lines.append(f"   Tags: {row['tags']}")
        lines.append(f"   Source: {row['source_ref']} / {row['source_section']}")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Search the devops-engineer local curated catalog.")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--max-results", "-n", type=int, default=MAX_RESULTS, help="Maximum number of results")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    parser.add_argument("--fallback-raw", action="store_true", help="Search raw skill and rule text if curated results are empty")
    args = parser.parse_args()

    results = search_catalog(args.query, max_results=args.max_results)
    payload: dict[str, object] = {"query": args.query, "specialist_id": SPECIALIST_ID, "results": results}
    if args.fallback_raw and not results:
        payload["raw_results"] = search_raw_refs(args.query, max_results=args.max_results)

    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=False))
        return 0

    print(format_results(args.query, results))
    if payload.get("raw_results"):
        print("")
        print("## Raw Fallback Search")
        for index, row in enumerate(payload["raw_results"], start=1):
            print(f"{index}. {row['source_ref']} / {row['source_section']}")
            print(f"   Snippet: {row['snippet']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
