#!/usr/bin/env python3
"""Ingest Cursor rules (.mdc) and skills (.md) into the agent system (stdlib only)."""

from __future__ import annotations

import argparse
from pathlib import Path

from core import ensure_rule_file, slugify, upsert_rule_map_row, upsert_specialist_catalog_row, write_field_skill


def _add_catalog_flags(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--catalog-item-id", default="", help="Optional item_id to upsert into owner specialist catalog")
    parser.add_argument("--catalog-topic", default="", help="Catalog topic")
    parser.add_argument("--catalog-rule-type", default="reference", help="Catalog rule_type")
    parser.add_argument("--catalog-title", default="", help="Catalog title")
    parser.add_argument("--catalog-guidance", default="", help="Catalog guidance")
    parser.add_argument("--catalog-do", default="", help="Catalog do")
    parser.add_argument("--catalog-dont", default="", help="Catalog dont")
    parser.add_argument("--catalog-severity", default="medium", help="Catalog severity: critical|high|medium|low")
    parser.add_argument("--catalog-source-section", default="Ingested", help="Catalog source_section")
    parser.add_argument("--no-catalog", action="store_true", help="Do not upsert a catalog row")


def _infer_catalog_defaults(args, *, source_ref: str, rule_id: str) -> dict[str, str]:
    item_id = args.catalog_item_id.strip() or f"{rule_id}-ingested"
    title = args.catalog_title.strip() or f"Ingested rule: {rule_id}"
    topic = args.catalog_topic.strip() or args.owner_field_id
    guidance = args.catalog_guidance.strip() or "Use this ingested rule as guidance for future work in this domain."
    do = args.catalog_do.strip() or "Keep mappings and catalogs in sync with new content."
    dont = args.catalog_dont.strip() or "Do not add new content without updating rule-map and the owner catalog."
    return {
        "item_id": item_id,
        "topic": topic,
        "rule_type": args.catalog_rule_type.strip() or "reference",
        "title": title,
        "guidance": guidance,
        "do": do,
        "dont": dont,
        "severity": args.catalog_severity.strip() or "medium",
        "tags": args.tags.strip() or args.owner_field_id,
        "source_ref": source_ref,
        "source_section": args.catalog_source_section.strip() or "Ingested",
    }


def rule_cmd(args: argparse.Namespace) -> int:
    # Align CLI semantics with validators:
    # - external: owner_field_id must be 'external' and owner_specialist_id is optional/ignored
    # - non-external: owner_field_id and owner_specialist_id are required
    if args.status == "external":
        if args.owner_field_id != "external":
            raise ValueError("--status external requires --owner-field-id external")
        owner_specialist_id = (args.owner_specialist_id or "").strip()
        if owner_specialist_id:
            # Allow but do not require; core will validate it if used for catalog upsert.
            pass
    else:
        if not (args.owner_field_id or "").strip():
            raise ValueError("--owner-field-id is required for non-external rules")
        if not (args.owner_specialist_id or "").strip():
            raise ValueError("--owner-specialist-id is required for non-external rules")

    rule_path = ensure_rule_file(args.rule_id, args.rule_title or None, args.input_path, args.stdin, overwrite=args.overwrite)
    upsert_rule_map_row(
        rule_id=args.rule_id,
        rule_file=rule_path.name,
        owner_field_id=args.owner_field_id,
        owner_specialist_id=(args.owner_specialist_id or "").strip(),
        status=args.status,
        ingest_mode=args.ingest_mode,
        tags=args.tags,
        notes=args.notes,
    )

    if args.status == "external" and not (args.owner_specialist_id or "").strip():
        # No owner specialist => no catalog row target.
        return 0

    if not args.no_catalog:
        source_ref = f"rules/{rule_path.name}"
        row = _infer_catalog_defaults(args, source_ref=source_ref, rule_id=args.rule_id)
        upsert_specialist_catalog_row(owner_specialist_id=args.owner_specialist_id, row=row)

    return 0


def skill_cmd(args: argparse.Namespace) -> int:
    content = ""
    if args.stdin:
        import sys

        content = sys.stdin.read()
    dest = write_field_skill(
        owner_field_id=args.owner_field_id, content=content, input_path=args.input_path, stdin=args.stdin, overwrite=args.overwrite
    )
    _ = dest  # quiet unused warnings in editors
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest rules/skills into the agent system.")
    sub = parser.add_subparsers(dest="cmd", required=True)

    rule_parser = sub.add_parser("rule", help="Ingest a Cursor rule (.mdc)", description="Ingest a Cursor rule (.mdc).")
    rule_parser.add_argument("--input-path", type=Path, help="Path to an existing .mdc rule file")
    rule_parser.add_argument("--stdin", action="store_true", help="Read rule content from stdin")
    rule_parser.add_argument("--overwrite", action="store_true", help="Allow replacing an existing destination file (creates .bak)")
    rule_parser.add_argument("--rule-id", required=True, help="Stable rule id (used in rule-map.csv)")
    rule_parser.add_argument("--rule-title", default="", help="Optional title used for normalized filename when --stdin")
    rule_parser.add_argument("--status", default="active", help="rule-map status: active|reference|external|orchestrator")
    rule_parser.add_argument("--ingest-mode", default="curated", help="rule-map ingest_mode: curated|reference|none|direct")
    rule_parser.add_argument("--owner-field-id", required=True, help="Field id (e.g. backend, frontend, agent-system, external)")
    rule_parser.add_argument(
        "--owner-specialist-id",
        default="",
        help="Specialist id (e.g. backend-developer). Optional for --status external.",
    )
    rule_parser.add_argument("--tags", default="", help='Comma-separated tags, e.g. "backend,api"')
    rule_parser.add_argument("--notes", default="", help="Optional notes for mapping rows")
    _add_catalog_flags(rule_parser)
    rule_parser.set_defaults(func=rule_cmd)

    skill_parser = sub.add_parser("skill", help="Ingest an agent skill (.md)", description="Ingest an agent skill markdown file.")
    skill_parser.add_argument("--input-path", type=Path, help="Path to an existing .md skill file")
    skill_parser.add_argument("--stdin", action="store_true", help="Read skill content from stdin")
    skill_parser.add_argument("--overwrite", action="store_true", help="Allow replacing an existing destination file (creates .bak)")
    skill_parser.add_argument("--skill-target", choices=["field"], default="field", help="Where to write the skill content")
    skill_parser.add_argument("--owner-field-id", required=True, help="Field id (e.g. backend, frontend, agent-system)")
    skill_parser.set_defaults(func=skill_cmd)

    args = parser.parse_args()
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())

