#!/usr/bin/env python3
"""Dispatch curated search to the local specialist search script."""

from __future__ import annotations

import argparse
import subprocess
import sys

from search_core import resolve_specialist_id, search_skill_routes, specialist_search_script_path


def main() -> int:
    parser = argparse.ArgumentParser(description="Dispatch curated search to a specialist-local search script.")
    parser.add_argument("query", help="Search query")
    parser.add_argument("--field", dest="field_id", help="Restrict search to a field id")
    parser.add_argument("--specialist", dest="specialist_id", help="Restrict search to a specialist id")
    parser.add_argument("--max-results", "-n", type=int, default=5, help="Maximum number of results")
    parser.add_argument("--json", action="store_true", help="Emit JSON")
    parser.add_argument("--fallback-raw", action="store_true", help="Forward raw fallback to the specialist-local search script")
    args = parser.parse_args()

    specialist_id = resolve_specialist_id(field_id=args.field_id, specialist_id=args.specialist_id)
    if not specialist_id:
        routed = search_skill_routes(args.query, max_results=1)
        specialist_id = routed[0]["specialist_id"] if routed else None

    if not specialist_id:
        print("Unable to resolve a specialist for curated search.", file=sys.stderr)
        return 1

    if specialist_id == "orchestrator":
        print("Orchestrator does not have a specialist-local curated catalog.", file=sys.stderr)
        return 1

    script_path = specialist_search_script_path(specialist_id)
    if not script_path.exists():
        print(f"Specialist search script not found: {script_path}", file=sys.stderr)
        return 1

    command = [sys.executable, str(script_path), args.query, "--max-results", str(args.max_results)]
    if args.json:
        command.append("--json")
    if args.fallback_raw:
        command.append("--fallback-raw")

    completed = subprocess.run(command, check=False)
    return completed.returncode


if __name__ == "__main__":
    raise SystemExit(main())
