#!/usr/bin/env python3
"""Local curated search core for devops-engineer."""

from __future__ import annotations

import csv
import re
from collections import Counter, defaultdict
from math import log
from pathlib import Path

SPECIALIST_ID = "devops-engineer"
FIELD_ID = "devops"
SPECIALIST_DIR = Path(__file__).resolve().parents[1]
DATA_PATH = SPECIALIST_DIR / "data" / "catalog.csv"
SKILL_PATH = SPECIALIST_DIR / "SKILL.md"
REPO_ROOT = SPECIALIST_DIR.parents[3]
FIELD_SKILL_PATH = REPO_ROOT / ".cursor" / "agents" / "skills" / f"{FIELD_ID}.md"
RULE_MAP_PATH = REPO_ROOT / ".cursor" / "agents" / "mappings" / "rule-map.csv"
RULES_DIR = REPO_ROOT / ".cursor" / "rules"
MAX_RESULTS = 5
SEARCH_COLS = ["topic", "rule_type", "title", "guidance", "do", "dont", "tags", "source_section"]


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


def read_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def search_catalog(query: str, max_results: int = MAX_RESULTS) -> list[dict[str, str]]:
    rows = read_csv_rows(DATA_PATH)
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
    sections = []
    for path in (SKILL_PATH, FIELD_SKILL_PATH):
        if path.exists():
            sections.extend(_iter_markdown_sections(path))
    for row in read_csv_rows(RULE_MAP_PATH):
        if row["status"] == "external":
            continue
        if row["owner_specialist_id"] != SPECIALIST_ID and row["owner_field_id"] != FIELD_ID:
            continue
        rule_path = RULES_DIR / row["rule_file"]
        if rule_path.exists():
            sections.extend(_iter_markdown_sections(rule_path))
    documents = [section["text"] for section in sections]
    ranked = BM25()
    ranked.fit(documents)
    results: list[dict[str, str]] = []
    for index, score in ranked.score(query):
        if score <= 0:
            continue
        section = sections[index]
        snippet = section["text"][:277] + "..." if len(section["text"]) > 280 else section["text"]
        results.append({"score": f"{score:.4f}", "source_ref": section["source_ref"], "source_section": section["source_section"], "snippet": snippet})
        if len(results) >= max_results:
            break
    return results
