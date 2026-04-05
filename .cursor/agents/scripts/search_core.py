#!/usr/bin/env python3
"""Shared routing and discovery helpers for the agent system."""

from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from dataclasses import dataclass
from math import log
from pathlib import Path
from typing import Iterable

REPO_ROOT = Path(__file__).resolve().parents[3]
CURSOR_DIR = REPO_ROOT / ".cursor"
AGENTS_DIR = CURSOR_DIR / "agents"
RULES_DIR = CURSOR_DIR / "rules"
SKILLS_DIR = AGENTS_DIR / "skills"
SPECIALISTS_DIR = AGENTS_DIR / "specialists"
ORCHESTRATOR_SKILL = AGENTS_DIR / "orchestrator" / "SKILL.md"
REGISTRY_PATH = AGENTS_DIR / "registry.yaml"
RULE_MAP_PATH = AGENTS_DIR / "mappings" / "rule-map.csv"
SKILL_FINDER_PATH = AGENTS_DIR / "mappings" / "skill-finder.csv"

SKILL_FINDER_SEARCH_COLS = ["keywords", "examples", "notes", "field_id", "specialist_id"]

ALLOWED_FIELDS = {
    "orchestrator",
    "frontend",
    "backend",
    "typescript",
    "database",
    "devops",
    "documentation",
    "qa",
    "code-review",
    "agent-system",
    "planner",
    "product-manager",
    "research",
    "debugger",
    "google-cli",
    "external",
}


def tokenize(text: str) -> list[str]:
    normalized = re.sub(r"[^a-z0-9+/-]+", " ", str(text).lower())
    return [token for token in normalized.split() if len(token) > 1]


class BM25:
    def __init__(self, k1: float = 1.5, b: float = 0.75) -> None:
        self.k1 = k1
        self.b = b
        self.corpus: list[list[str]] = []
        self.doc_lengths: list[int] = []
        self.avgdl = 0.0
        self.idf: dict[str, float] = {}
        self.doc_freqs: defaultdict[str, int] = defaultdict(int)

    def fit(self, documents: Iterable[str]) -> None:
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
        if not self.corpus:
            return []

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


@dataclass
class SearchResult:
    score: float
    row: dict[str, str]


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def search_rows(rows: list[dict[str, str]], query: str, columns: list[str], max_results: int) -> list[SearchResult]:
    documents = [" ".join(row.get(column, "") for column in columns) for row in rows]
    bm25 = BM25()
    bm25.fit(documents)
    query_tokens = set(tokenize(query))
    results: list[SearchResult] = []
    for index, score in bm25.score(query):
        overlap = len(query_tokens & set(tokenize(documents[index])))
        adjusted = score + overlap * 0.2
        if adjusted <= 0:
            continue
        result_row = dict(rows[index])
        result_row["score"] = f"{adjusted:.4f}"
        results.append(SearchResult(score=adjusted, row=result_row))
        if len(results) >= max_results:
            break
    return results


def parse_registry_agents(path: Path = REGISTRY_PATH) -> list[dict[str, str]]:
    agents: list[dict[str, str]] = []
    current: dict[str, str] | None = None
    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        if line.startswith("  - id: "):
            if current:
                agents.append(current)
            current = {"id": line.split(": ", 1)[1].strip()}
            continue
        if current and line.startswith("    ") and ": " in line:
            key, value = line.strip().split(": ", 1)
            current[key] = value.strip()
    if current:
        agents.append(current)
    return agents


def registry_by_specialist() -> dict[str, dict[str, str]]:
    return {agent["id"]: agent for agent in parse_registry_agents()}


def specialist_dir(specialist_id: str) -> Path:
    return SPECIALISTS_DIR / specialist_id


def specialist_catalog_path(specialist_id: str) -> Path:
    return specialist_dir(specialist_id) / "data" / "catalog.csv"


def specialist_schema_path(specialist_id: str) -> Path:
    return specialist_dir(specialist_id) / "data" / "SCHEMA.md"


def specialist_core_path(specialist_id: str) -> Path:
    return specialist_dir(specialist_id) / "scripts" / "core.py"


def specialist_search_script_path(specialist_id: str) -> Path:
    return specialist_dir(specialist_id) / "scripts" / "search.py"


def load_rule_map_rows() -> list[dict[str, str]]:
    return read_csv_rows(RULE_MAP_PATH)


def load_skill_finder_rows() -> list[dict[str, str]]:
    return read_csv_rows(SKILL_FINDER_PATH)


def resolve_field_id(field_id: str | None = None, specialist_id: str | None = None) -> str | None:
    if field_id:
        return field_id
    if not specialist_id:
        return None
    agent = registry_by_specialist().get(specialist_id)
    return agent.get("field_id") if agent else None


def resolve_specialist_id(field_id: str | None = None, specialist_id: str | None = None) -> str | None:
    if specialist_id:
        return specialist_id
    if not field_id:
        return None
    for agent in parse_registry_agents():
        if agent.get("field_id") == field_id:
            return agent["id"]
    return None


def specialist_ids(include_orchestrator: bool = False) -> list[str]:
    ids = [agent["id"] for agent in parse_registry_agents()]
    if include_orchestrator:
        return ids
    return [specialist_id for specialist_id in ids if specialist_id != "orchestrator"]


def non_frontend_specialist_ids() -> list[str]:
    return [
        specialist_id
        for specialist_id in specialist_ids()
        if specialist_id != "frontend-developer"
    ]


def search_skill_routes(query: str, max_results: int = 3) -> list[dict[str, str]]:
    rows = load_skill_finder_rows()
    return [result.row for result in search_rows(rows, query, SKILL_FINDER_SEARCH_COLS, max_results)]
