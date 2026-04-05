#!/usr/bin/env python3
"""Local curated search + ingestion helpers for rule-skill-ingestor (stdlib only)."""

from __future__ import annotations

import csv
import re
import shutil
import sys
from collections import Counter, defaultdict
from datetime import datetime
from math import log
from pathlib import Path

SPECIALIST_ID = "rule-skill-ingestor"
FIELD_ID = "agent-system"
SPECIALIST_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = SPECIALIST_DIR / "data" / "catalog.csv"
SKILL_PATH = SPECIALIST_DIR / "SKILL.md"
REPO_ROOT = SPECIALIST_DIR.parents[3]
AGENTS_DIR = REPO_ROOT / ".cursor" / "agents"
FIELD_SKILL_PATH = AGENTS_DIR / "skills" / f"{FIELD_ID}.md"
RULE_MAP_PATH = AGENTS_DIR / "mappings" / "rule-map.csv"
SKILL_FINDER_PATH = AGENTS_DIR / "mappings" / "skill-finder.csv"
REGISTRY_PATH = AGENTS_DIR / "registry.yaml"
RULES_DIR = REPO_ROOT / ".cursor" / "rules"
SPECIALISTS_DIR = AGENTS_DIR / "specialists"
SKILLS_DIR = AGENTS_DIR / "skills"

_ID_RE = re.compile(r"^[a-z0-9-]+$")


def _import_search_core():
    scripts_dir = AGENTS_DIR / "scripts"
    if str(scripts_dir) not in sys.path:
        sys.path.insert(0, str(scripts_dir))
    from search_core import ALLOWED_FIELDS, parse_registry_agents  # type: ignore

    return ALLOWED_FIELDS, parse_registry_agents


def _validate_simple_id(value: str, *, label: str) -> str:
    if not value:
        raise ValueError(f"{label} is required")
    if not _ID_RE.fullmatch(value):
        raise ValueError(f"Invalid {label}: {value!r}. Expected pattern [a-z0-9-]+")
    return value


def _validate_owner_field_id(owner_field_id: str) -> str:
    owner_field_id = _validate_simple_id(owner_field_id, label="owner_field_id")
    allowed_fields, _ = _import_search_core()
    if owner_field_id not in allowed_fields:
        raise ValueError(f"Invalid owner_field_id: {owner_field_id!r}. Must be one of {sorted(allowed_fields)}")
    return owner_field_id


def _validate_owner_specialist_id(owner_specialist_id: str) -> str:
    owner_specialist_id = _validate_simple_id(owner_specialist_id, label="owner_specialist_id")
    _, parse_registry_agents = _import_search_core()
    known = {agent.get("id") for agent in parse_registry_agents()}
    if owner_specialist_id not in known:
        raise ValueError(f"Invalid owner_specialist_id: {owner_specialist_id!r}. Must exist in registry.yaml")
    return owner_specialist_id


def _ensure_within(dest: Path, base_dir: Path, *, label: str) -> Path:
    dest_resolved = dest.resolve()
    base_resolved = base_dir.resolve()
    try:
        if not dest_resolved.is_relative_to(base_resolved):
            raise ValueError
    except Exception:
        if base_resolved not in dest_resolved.parents and dest_resolved != base_resolved:
            raise ValueError(f"Refusing to write outside {label}: {dest_resolved}")
    return dest_resolved

MAX_RESULTS = 5
SEARCH_COLS = ["topic", "rule_type", "title", "guidance", "do", "dont", "tags", "source_section"]

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


def tokenize(text: str) -> list[str]:
    return [token for token in re.sub(r"[^a-z0-9+/-]+", " ", str(text).lower()).split() if len(token) > 1]


class BM25:
    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.corpus: list[list[str]] = []
        self.doc_lengths: list[int] = []
        self.avgdl = 0.0
        self.idf: dict[str, float] = {}
        self.doc_freqs: defaultdict[str, int] = defaultdict(int)

    def fit(self, documents: list[str]) -> None:
        self.corpus = [tokenize(document) for document in documents]
        if not self.corpus:
            return
        self.doc_lengths = [len(doc) for doc in self.corpus]
        self.avgdl = sum(self.doc_lengths) / len(self.corpus)
        for doc in self.corpus:
            seen = set()
            for token in doc:
                if token not in seen:
                    self.doc_freqs[token] += 1
                    seen.add(token)
        for token, freq in self.doc_freqs.items():
            self.idf[token] = log((len(self.corpus) - freq + 0.5) / (freq + 0.5) + 1)

    def score(self, query: str) -> list[tuple[int, float]]:
        query_tokens = tokenize(query)
        scored: list[tuple[int, float]] = []
        for index, doc in enumerate(self.corpus):
            term_freqs = Counter(doc)
            doc_length = self.doc_lengths[index]
            total = 0.0
            for token in query_tokens:
                if token not in self.idf:
                    continue
                tf = term_freqs[token]
                numerator = tf * (self.k1 + 1)
                denominator = tf + self.k1 * (1 - self.b + self.b * doc_length / self.avgdl)
                total += self.idf[token] * numerator / denominator
            scored.append((index, total))
        return sorted(scored, key=lambda item: item[1], reverse=True)


def _read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv_rows(path: Path, headers: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        _backup_file(path)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=headers)
        writer.writeheader()
        writer.writerows(rows)


def _backup_file(path: Path) -> Path:
    """Create a best-effort local backup next to the file."""
    timestamp = datetime.utcnow().strftime("%Y%m%d-%H%M%S")
    base = path.with_name(f"{path.name}.{timestamp}.bak")
    candidate = base
    index = 1
    while candidate.exists():
        candidate = path.with_name(f"{path.name}.{timestamp}.{index}.bak")
        index += 1
    shutil.copyfile(path, candidate)
    return candidate


def _write_text_safely(dest: Path, content: str, *, overwrite: bool) -> None:
    if dest.exists():
        existing = dest.read_text(encoding="utf-8")
        if existing == content:
            return
        if not overwrite:
            raise ValueError(f"Refusing to overwrite existing file: {dest}. Re-run with --overwrite to replace it.")
        _backup_file(dest)
    dest.write_text(content, encoding="utf-8")


def _copy_file_safely(src: Path, dest: Path, *, overwrite: bool) -> None:
    if dest.exists():
        if src.read_bytes() == dest.read_bytes():
            return
        if not overwrite:
            raise ValueError(f"Refusing to overwrite existing file: {dest}. Re-run with --overwrite to replace it.")
        _backup_file(dest)
    shutil.copyfile(src, dest)


def search_catalog(query: str, max_results: int = MAX_RESULTS) -> list[dict[str, str]]:
    rows = _read_csv_rows(DATA_PATH)
    documents = [" ".join(row.get(column, "") for column in SEARCH_COLS) for row in rows]
    ranked = BM25()
    ranked.fit(documents)
    query_tokens = set(tokenize(query))
    results: list[dict[str, str]] = []
    for index, score in ranked.score(query):
        overlap = len(query_tokens & set(tokenize(documents[index])))
        adjusted = score + overlap * 0.2
        if adjusted <= 0:
            continue
        row = dict(rows[index])
        row["score"] = f"{adjusted:.4f}"
        results.append(row)
        if len(results) >= max_results:
            break
    return results


def _iter_markdown_sections(path: Path) -> list[dict[str, str]]:
    text = path.read_text(encoding="utf-8")
    heading = "Document"
    buffer: list[str] = []
    sections: list[dict[str, str]] = []

    def flush() -> None:
        if not buffer:
            return
        paragraph = " ".join(line.strip() for line in buffer if line.strip()).strip()
        if paragraph:
            sections.append({"source_ref": str(path.relative_to(REPO_ROOT)), "source_section": heading, "text": paragraph})
        buffer.clear()

    for line in text.splitlines():
        if line.startswith("#"):
            flush()
            heading = line.lstrip("#").strip() or heading
            continue
        if not line.strip():
            flush()
            continue
        buffer.append(line)
    flush()
    return sections


def search_raw_refs(query: str, max_results: int = MAX_RESULTS) -> list[dict[str, str]]:
    sections: list[dict[str, str]] = []
    for path in (SKILL_PATH, FIELD_SKILL_PATH):
        if path.exists():
            sections.extend(_iter_markdown_sections(path))
    documents = [section["text"] for section in sections]
    ranked = BM25()
    ranked.fit(documents)
    results: list[dict[str, str]] = []
    for index, score in ranked.score(query):
        if score <= 0:
            continue
        section = sections[index]
        snippet = section["text"][:277] + "..." if len(section["text"]) > 280 else section["text"]
        results.append(
            {"score": f"{score:.4f}", "source_ref": section["source_ref"], "source_section": section["source_section"], "snippet": snippet}
        )
        if len(results) >= max_results:
            break
    return results


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return re.sub(r"-{2,}", "-", value).strip("-") or "ingested"


def _read_stdin_text() -> str:
    return sys.stdin.read()


def ensure_rule_file(rule_id: str, rule_title: str | None, input_path: Path | None, stdin: bool, *, overwrite: bool) -> Path:
    RULES_DIR.mkdir(parents=True, exist_ok=True)
    if stdin:
        content = _read_stdin_text()
        if not content.strip():
            raise ValueError("stdin is empty")
        base = slugify(rule_title or rule_id)
        rule_path = RULES_DIR / f"{base}.mdc"
        _ensure_within(rule_path, RULES_DIR, label="RULES_DIR")
        _write_text_safely(rule_path, content, overwrite=overwrite)
        return rule_path
    if not input_path:
        raise ValueError("input_path is required unless --stdin is set")
    input_path = input_path.resolve()
    if input_path.suffix.lower() != ".mdc":
        raise ValueError(f"Rule input must be a .mdc file, got: {input_path}")
    if input_path.parent == RULES_DIR.resolve():
        return input_path
    dest = RULES_DIR / input_path.name
    _ensure_within(dest, RULES_DIR, label="RULES_DIR")
    _copy_file_safely(input_path, dest, overwrite=overwrite)
    return dest


def upsert_rule_map_row(
    *,
    rule_id: str,
    rule_file: str,
    owner_field_id: str,
    owner_specialist_id: str,
    status: str,
    ingest_mode: str,
    tags: str,
    notes: str,
) -> None:
    headers = ["rule_id", "rule_file", "owner_field_id", "owner_specialist_id", "status", "ingest_mode", "tags", "notes"]
    rows: list[dict[str, str]]
    if RULE_MAP_PATH.exists():
        rows = _read_csv_rows(RULE_MAP_PATH)
        if rows:
            existing_headers = list(rows[0].keys())
            if existing_headers != headers:
                raise ValueError(f"rule-map.csv headers mismatch: expected {headers}, got {existing_headers}")
    else:
        rows = []
    by_id = {row["rule_id"]: row for row in rows}
    by_id[rule_id] = {
        "rule_id": rule_id,
        "rule_file": rule_file,
        "owner_field_id": owner_field_id,
        "owner_specialist_id": owner_specialist_id,
        "status": status,
        "ingest_mode": ingest_mode,
        "tags": tags,
        "notes": notes,
    }
    new_rows = [by_id[row["rule_id"]] for row in rows if row["rule_id"] in by_id and row["rule_id"] != rule_id]
    new_rows.append(by_id[rule_id])
    _write_csv_rows(RULE_MAP_PATH, headers, new_rows)


def upsert_specialist_catalog_row(*, owner_specialist_id: str, row: dict[str, str]) -> None:
    owner_specialist_id = _validate_owner_specialist_id(owner_specialist_id)
    catalog_path = SPECIALISTS_DIR / owner_specialist_id / "data" / "catalog.csv"
    _ensure_within(catalog_path, SPECIALISTS_DIR, label="SPECIALISTS_DIR")
    if not catalog_path.exists():
        raise ValueError(f"Owner specialist catalog not found: {catalog_path}")
    rows = _read_csv_rows(catalog_path)
    if rows:
        existing_headers = list(rows[0].keys())
        if existing_headers != SPECIALIST_CATALOG_HEADERS:
            raise ValueError(f"Catalog headers mismatch for {owner_specialist_id}")
    by_id = {r["item_id"]: r for r in rows}
    by_id[row["item_id"]] = row
    new_rows = [by_id[r["item_id"]] for r in rows if r["item_id"] in by_id and r["item_id"] != row["item_id"]]
    new_rows.append(by_id[row["item_id"]])
    _write_csv_rows(catalog_path, SPECIALIST_CATALOG_HEADERS, new_rows)


def write_field_skill(*, owner_field_id: str, content: str, input_path: Path | None, stdin: bool, overwrite: bool) -> Path:
    AGENTS_DIR.joinpath("skills").mkdir(parents=True, exist_ok=True)
    owner_field_id = _validate_owner_field_id(owner_field_id)
    dest = AGENTS_DIR / "skills" / f"{owner_field_id}.md"
    _ensure_within(dest, SKILLS_DIR, label="SKILLS_DIR")
    if stdin:
        if not content.strip():
            raise ValueError("stdin is empty")
        _write_text_safely(dest, content, overwrite=overwrite)
        return dest
    if not input_path:
        raise ValueError("input_path is required unless --stdin is set")
    input_path = input_path.resolve()
    if input_path.suffix.lower() != ".md":
        raise ValueError(f"Skill input must be a .md file, got: {input_path}")
    _write_text_safely(dest, input_path.read_text(encoding="utf-8"), overwrite=overwrite)
    return dest

