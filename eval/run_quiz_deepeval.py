from __future__ import annotations

import argparse
import asyncio
import csv
import json
import os
import re
import statistics
import threading
import time
import unicodedata
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from deepeval.metrics import GEval
from deepeval.models import DeepEvalBaseLLM
from deepeval.test_case import LLMTestCase, SingleTurnParams
from pypdf import PdfReader
import requests


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PROMPT = ROOT / "prompt" / "quiz_generator_v1.json"
DEFAULT_PDFS = [
    ROOT / "eval" / "demo" / "dedialynghean-18_mul_ques.pdf",
    ROOT / "eval" / "demo" / "delichsunghean-24_mul_ques.pdf",
    ROOT / "eval" / "demo" / "detienganhnghean-40_mul_ques.pdf",
]
TARGET_COUNTS = {
    "dedialynghean-18_mul_ques.pdf": 18,
    "delichsunghean-24_mul_ques.pdf": 24,
    "detienganhnghean-40_mul_ques.pdf": 40,
}


def normalize(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.casefold())
    return " ".join(
        re.sub(
            r"[^a-z0-9\s]",
            " ",
            "".join(ch for ch in decomposed if not unicodedata.combining(ch)).replace("đ", "d"),
        ).split()
    )


def build_system_prompt(spec: dict[str, Any]) -> str:
    return "\n".join(
        [
            spec["system"],
            "",
            "Tasks:",
            *[f"{index}. {task}" for index, task in enumerate(spec["tasks"], 1)],
            "",
            "Constraints:",
            *[f"- {constraint}" for constraint in spec["constraints"]],
            "",
            "Return JSON matching this schema exactly:",
            json.dumps(spec["output_schema"], ensure_ascii=False, indent=2),
        ]
    )


def extract_pdf_case(path: Path) -> dict[str, Any]:
    reader = PdfReader(path)
    page_texts = [(page.extract_text() or "").strip() for page in reader.pages]
    full_text = "\n\n".join(
        f"## Trang {index}\n\n{text}" for index, text in enumerate(page_texts, 1) if text
    )
    canonical = full_text
    for marker in ("LỜI GIẢI CHI TIẾT THAM KHẢO", "LỜI GIẢI THAM KHẢO"):
        marker_index = canonical.upper().find(marker)
        if marker_index >= 0:
            canonical = canonical[:marker_index].rstrip()
            break
    sections = [
        {
            "id": f"sec_{index:03d}",
            "section_key": f"sec_{index:03d}",
            "title": f"Trang {index}",
            "content": text[:240],
        }
        for index, text in enumerate(page_texts, 1)
        if text
    ]
    language = "en" if path.name.startswith("detienganh") else "vi"
    return {
        "case_id": path.stem,
        "pdf": str(path),
        "title": path.stem,
        "language": language,
        "requested_count": TARGET_COUNTS[path.name],
        "canonical_markdown": canonical,
        "sections": sections,
        "extracted_questions": [],
        "has_reference_answer_key": "ĐÁP ÁN" in canonical.upper()
        or "ANSWER KEY" in canonical.upper(),
        "page_count": len(reader.pages),
    }


def build_user_input(spec: dict[str, Any], case: dict[str, Any]) -> str:
    values = {
        "study_set_id": case["case_id"],
        "title": case["title"],
        "language": case["language"],
        "canonical_markdown": case["canonical_markdown"],
        "sections_json": json.dumps(case["sections"], ensure_ascii=False),
        "extracted_questions_json": json.dumps(case["extracted_questions"], ensure_ascii=False),
        "requested_count": str(case["requested_count"]),
    }
    substituted = {}
    for key, template in spec["input"].items():
        substituted[key] = re.sub(
            r"\{\{(\w+)\}\}", lambda match: values.get(match.group(1), ""), template
        )
    return json.dumps(substituted, ensure_ascii=False)


def strip_json_fence(text: str) -> str:
    value = text.strip()
    if value.startswith("```"):
        value = re.sub(r"^```(?:json)?\s*", "", value, flags=re.I)
        value = re.sub(r"\s*```$", "", value)
    return value.strip()


def repair_stream_mojibake(value: Any) -> Any:
    if isinstance(value, str) and any(marker in value for marker in ("Ã", "Â", "Ä", "Æ", "â")):
        try:
            return value.encode("latin1").decode("utf-8")
        except (UnicodeEncodeError, UnicodeDecodeError):
            return value
    if isinstance(value, list):
        return [repair_stream_mojibake(item) for item in value]
    if isinstance(value, dict):
        return {key: repair_stream_mojibake(item) for key, item in value.items()}
    return value


def validate_output(output: Any, requested_count: int) -> dict[str, Any]:
    errors: list[str] = []
    if not isinstance(output, dict):
        return {
            "schema_valid": False,
            "schema_errors": ["root_not_object"],
            "count_match": False,
            "structure_pass": False,
        }
    if set(output) != {"recommended_count", "concepts", "questions", "warnings"}:
        errors.append("root_keys_mismatch")
    concepts = output.get("concepts")
    questions = output.get("questions")
    warnings = output.get("warnings")
    recommended = output.get("recommended_count")
    if not isinstance(recommended, int) or isinstance(recommended, bool):
        errors.append("recommended_count_not_integer")
    if not isinstance(concepts, list) or not concepts:
        errors.append("concepts_invalid")
        concepts = []
    if not isinstance(questions, list) or not questions:
        errors.append("questions_invalid")
        questions = []
    if not isinstance(warnings, list) or not all(isinstance(item, str) for item in warnings):
        errors.append("warnings_invalid")
    concept_ids: list[str] = []
    for index, concept in enumerate(concepts):
        if not isinstance(concept, dict):
            errors.append(f"concept_{index}_not_object")
            continue
        concept_id = concept.get("concept_id")
        if not isinstance(concept_id, str) or not re.fullmatch(r"concept_\d{3}", concept_id):
            errors.append(f"concept_{index}_bad_id")
        else:
            concept_ids.append(concept_id)
        section_key = concept.get("section_key")
        if section_key is not None and (
            not isinstance(section_key, str) or not re.fullmatch(r"sec_\d{3}", section_key)
        ):
            errors.append(f"concept_{index}_bad_section")
        if not isinstance(concept.get("label"), str) or not concept["label"].strip():
            errors.append(f"concept_{index}_bad_label")
    if len(concept_ids) != len(set(concept_ids)):
        errors.append("duplicate_concept_ids")
    structural_failures = 0
    for index, question in enumerate(questions):
        if not isinstance(question, dict):
            errors.append(f"question_{index}_not_object")
            structural_failures += 1
            continue
        required = {
            "concept_id",
            "prompt",
            "choices",
            "correct_index",
            "explanation",
            "section_key",
            "source_excerpt",
        }
        if not required.issubset(question):
            errors.append(f"question_{index}_missing_fields")
            structural_failures += 1
        choices = question.get("choices")
        if (
            not isinstance(choices, list)
            or len(choices) != 4
            or not all(isinstance(choice, str) and choice.strip() for choice in choices)
            or len({normalize(choice) for choice in choices}) != 4
        ):
            errors.append(f"question_{index}_bad_choices")
            structural_failures += 1
        if question.get("correct_index") not in {0, 1, 2, 3}:
            errors.append(f"question_{index}_bad_correct_index")
            structural_failures += 1
        if question.get("concept_id") not in set(concept_ids):
            errors.append(f"question_{index}_orphan_concept")
            structural_failures += 1
        if not isinstance(question.get("prompt"), str) or len(question["prompt"].strip()) < 10:
            errors.append(f"question_{index}_bad_prompt")
            structural_failures += 1
        if not isinstance(question.get("explanation"), str) or not question["explanation"].strip():
            errors.append(f"question_{index}_missing_explanation")
            structural_failures += 1
    return {
        "schema_valid": not errors,
        "schema_errors": errors,
        "count_match": len(questions) == requested_count and recommended == requested_count,
        "structure_pass": structural_failures == 0 and bool(questions),
    }


def deterministic_scores(output: dict[str, Any], case: dict[str, Any]) -> dict[str, Any]:
    questions = output.get("questions", []) if isinstance(output, dict) else []
    source = normalize(case["canonical_markdown"])
    grounded = 0
    excerpts = 0
    prompts: list[str] = []
    for question in questions:
        if not isinstance(question, dict):
            continue
        excerpt = question.get("source_excerpt")
        if isinstance(excerpt, str) and excerpt.strip():
            excerpts += 1
            normalized_excerpt = normalize(excerpt)
            if normalized_excerpt and normalized_excerpt in source:
                grounded += 1
        prompt = question.get("prompt")
        if isinstance(prompt, str) and prompt.strip():
            prompts.append(normalize(prompt))
    duplicate_count = len(prompts) - len(set(prompts))
    return {
        "source_excerpt_grounding": grounded / max(1, excerpts),
        "duplicate_question_count": duplicate_count,
        "duplicate_free": duplicate_count == 0,
        "question_count": len(questions),
    }


class RouterJudge(DeepEvalBaseLLM):
    def __init__(self, base_url: str, api_key: str, model: str):
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.model_id = model
        super().__init__(model=model)

    def load_model(self) -> "RouterJudge":
        return self

    def get_model_name(self) -> str:
        return self.model_id

    def supports_json_mode(self) -> bool:
        return True

    def supports_structured_outputs(self) -> bool:
        return False

    def supports_temperature(self) -> bool:
        return True

    def generate(self, prompt: str, schema: Any = None, **_: Any) -> str:
        return post_chat(
            self.base_url,
            self.api_key,
            self.model_id,
            [{"role": "user", "content": prompt}],
            max_tokens=4096,
            json_mode=True,
        )

    async def a_generate(self, prompt: str, schema: Any = None, **_: Any) -> str:
        return await asyncio.to_thread(self.generate, prompt, schema)


def post_chat(
    base_url: str,
    api_key: str,
    model: str,
    messages: list[dict[str, str]],
    *,
    max_tokens: int,
    json_mode: bool,
) -> str:
    payload: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "stream": True,
        "temperature": 0,
        "max_tokens": max_tokens,
        "reasoning_effort": "low",
    }
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
    response = requests.post(
        base_url.rstrip("/") + "/chat/completions",
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "Doc2Quiz-DeepEval/1.0",
        },
        json=payload,
        timeout=300,
        stream=True,
    )
    if not response.ok:
        raise RuntimeError(f"HTTP {response.status_code}: {response.text[:1000]}")
    response.encoding = "utf-8"
    content_parts: list[str] = []
    raw_lines: list[str] = []
    for line in response.iter_lines(decode_unicode=True):
        if not line:
            continue
        raw_lines.append(line)
        if not line.startswith("data:"):
            continue
        payload_text = line[5:].strip()
        if payload_text == "[DONE]":
            break
        try:
            event = json.loads(payload_text)
        except json.JSONDecodeError:
            continue
        choice = event.get("choices", [{}])[0]
        delta = choice.get("delta", {})
        piece = delta.get("content")
        if isinstance(piece, str):
            content_parts.append(piece)
    content = "".join(content_parts).strip()
    if not content and raw_lines:
        try:
            data = json.loads("\n".join(raw_lines))
            content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        except json.JSONDecodeError:
            content = ""
    if not isinstance(content, str) or not content.strip():
        raise RuntimeError("empty assistant content")
    return content.strip()


def target_call(
    base_url: str,
    api_key: str,
    model: str,
    system_prompt: str,
    user_input: str,
    requested_count: int,
) -> tuple[str, dict[str, Any] | None, list[str], int]:
    errors: list[str] = []
    started = time.perf_counter()
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input},
    ]
    raw = ""
    parsed: dict[str, Any] | None = None
    for attempt in range(3):
        try:
            raw = post_chat(
                base_url,
                api_key,
                model,
                messages,
                max_tokens=16384,
                json_mode=True,
            )
            value = json.loads(strip_json_fence(raw))
            parsed = repair_stream_mojibake(value) if isinstance(value, dict) else None
            validation = validate_output(parsed, requested_count)
            if validation["schema_valid"]:
                break
            errors = validation["schema_errors"]
            messages.extend(
                [
                    {"role": "assistant", "content": raw},
                    {
                        "role": "user",
                        "content": "Invalid schema: "
                        + "; ".join(errors)
                        + ". Return only corrected JSON. Preserve the requested question count.",
                    },
                ]
            )
        except Exception as exc:
            errors = [f"{type(exc).__name__}: {exc}"]
            if attempt < 2:
                time.sleep(2**attempt)
    latency_ms = int((time.perf_counter() - started) * 1000)
    return raw, parsed, errors, latency_ms


def build_metrics(judge: RouterJudge) -> tuple[GEval, GEval]:
    groundedness = GEval(
        name="Quiz Groundedness",
        criteria=(
            "Assess whether every generated question's correct answer, explanation, and "
            "source_excerpt are supported by the supplied PDF context. Distractors may be "
            "plausible and need not be stated in the source. Penalize unsupported correct "
            "answers, external knowledge, invented facts, and misleading citations. If the "
            "PDF contains questions/options but no answer key or explanatory knowledge, "
            "choosing a correct_index is not grounded merely because the choice seems true."
        ),
        evaluation_params=[
            SingleTurnParams.INPUT,
            SingleTurnParams.ACTUAL_OUTPUT,
            SingleTurnParams.RETRIEVAL_CONTEXT,
        ],
        model=judge,
        threshold=0.8,
        async_mode=False,
    )
    quality = GEval(
        name="Quiz Quality and Instruction Adherence",
        criteria=(
            "Assess clarity, answer uniqueness, distractor plausibility, non-duplication, "
            "language match, coverage of the source, exact requested count when supported, "
            "and internal consistency of concept_id and section_key references. Do not award "
            "quality for fluent but unsupported content."
        ),
        evaluation_params=[
            SingleTurnParams.INPUT,
            SingleTurnParams.ACTUAL_OUTPUT,
            SingleTurnParams.RETRIEVAL_CONTEXT,
        ],
        model=judge,
        threshold=0.8,
        async_mode=False,
    )
    return groundedness, quality


def evaluate_record(
    record: dict[str, Any],
    case: dict[str, Any],
    groundedness: GEval,
    quality: GEval,
) -> dict[str, Any]:
    if not record.get("schema_valid") or not record.get("parsed_output"):
        return record
    actual = json.dumps(record["parsed_output"], ensure_ascii=False)
    test_case = LLMTestCase(
        input=json.dumps(
            {
                "title": case["title"],
                "language": case["language"],
                "requested_count": case["requested_count"],
                "has_reference_answer_key": case["has_reference_answer_key"],
            },
            ensure_ascii=False,
        ),
        actual_output=actual,
        retrieval_context=[case["canonical_markdown"]],
    )
    for metric, score_key, reason_key in [
        (groundedness, "groundedness_score", "groundedness_reason"),
        (quality, "quality_score", "quality_reason"),
    ]:
        try:
            record[score_key] = metric.measure(test_case, _show_indicator=False)
            record[reason_key] = metric.reason
        except Exception as exc:
            record[score_key] = None
            record[reason_key] = f"judge_error: {type(exc).__name__}: {exc}"
    return record


def summarize(records: list[dict[str, Any]], cases: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(records)
    valid = [record for record in records if record.get("schema_valid")]
    judged = [
        record
        for record in valid
        if isinstance(record.get("groundedness_score"), (int, float))
        and isinstance(record.get("quality_score"), (int, float))
    ]
    by_case: dict[str, list[dict[str, Any]]] = {}
    for record in records:
        by_case.setdefault(record["case_id"], []).append(record)
    case_rows = []
    for case in cases:
        rows = by_case.get(case["case_id"], [])
        valid_rows = [row for row in rows if row.get("schema_valid")]
        counts = [row["deterministic"]["question_count"] for row in valid_rows]
        grounded_scores = [
            row["groundedness_score"]
            for row in valid_rows
            if isinstance(row.get("groundedness_score"), (int, float))
        ]
        quality_scores = [
            row["quality_score"]
            for row in valid_rows
            if isinstance(row.get("quality_score"), (int, float))
        ]
        case_rows.append(
            {
                "case_id": case["case_id"],
                "requested_count": case["requested_count"],
                "has_reference_answer_key": case["has_reference_answer_key"],
                "runs": len(rows),
                "schema_pass_rate": sum(bool(row.get("schema_valid")) for row in rows)
                / max(1, len(rows)),
                "count_pass_rate": sum(bool(row.get("count_match")) for row in rows)
                / max(1, len(rows)),
                "mean_generated_count": statistics.mean(counts) if counts else 0,
                "count_consistent": len(set(counts)) <= 1 if counts else False,
                "mean_groundedness": statistics.mean(grounded_scores)
                if grounded_scores
                else None,
                "mean_quality": statistics.mean(quality_scores) if quality_scores else None,
            }
        )
    rates = {
        "schema_pass_rate": sum(bool(record.get("schema_valid")) for record in records)
        / max(1, total),
        "count_pass_rate": sum(bool(record.get("count_match")) for record in records)
        / max(1, total),
        "structure_pass_rate": sum(bool(record.get("structure_pass")) for record in records)
        / max(1, total),
        "duplicate_free_rate": sum(
            bool(record.get("deterministic", {}).get("duplicate_free")) for record in records
        )
        / max(1, total),
        "mean_source_excerpt_grounding": statistics.mean(
            record["deterministic"]["source_excerpt_grounding"] for record in valid
        )
        if valid
        else 0,
        "mean_groundedness": statistics.mean(
            record["groundedness_score"] for record in judged
        )
        if judged
        else None,
        "mean_quality": statistics.mean(record["quality_score"] for record in judged)
        if judged
        else None,
        "api_error_count": sum(bool(record.get("api_errors")) for record in records),
        "judge_error_count": sum(
            record.get("groundedness_score") is None or record.get("quality_score") is None
            for record in valid
        ),
    }
    thresholds = {
        "schema_pass_rate": 0.99,
        "count_pass_rate": 0.95,
        "structure_pass_rate": 0.99,
        "duplicate_free_rate": 0.95,
        "mean_source_excerpt_grounding": 0.90,
        "mean_groundedness": 0.80,
        "mean_quality": 0.80,
        "api_error_count": 0,
        "judge_error_count": 0,
    }
    checks = {}
    for key, threshold in thresholds.items():
        value = rates[key]
        checks[key] = (
            value is not None and value <= threshold
            if key.endswith("_count")
            else value is not None and value >= threshold
        )
    return {
        "model": os.environ["QUIZ_EVAL_MODEL"],
        "base_url": os.environ["QUIZ_EVAL_BASE_URL"],
        "prompt": str(DEFAULT_PROMPT),
        "total_cases": len(cases),
        "repetitions": total,
        "valid_outputs": len(valid),
        "judged_outputs": len(judged),
        "rates": rates,
        "thresholds": thresholds,
        "checks": checks,
        "overall_pass": all(checks.values()),
        "cases": case_rows,
    }


def write_reports(
    output_dir: Path,
    label: str,
    records: list[dict[str, Any]],
    summary: dict[str, Any],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / f"effective_outputs_{label}.jsonl").write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )
    (output_dir / f"summary_{label}.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    with (output_dir / f"per_run_{label}.csv").open(
        "w", encoding="utf-8-sig", newline=""
    ) as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "case_id",
                "repetition",
                "schema_valid",
                "count_match",
                "structure_pass",
                "question_count",
                "source_excerpt_grounding",
                "duplicate_question_count",
                "groundedness_score",
                "quality_score",
                "latency_ms",
            ],
        )
        writer.writeheader()
        for record in records:
            deterministic = record.get("deterministic", {})
            writer.writerow(
                {
                    "case_id": record["case_id"],
                    "repetition": record["repetition"],
                    "schema_valid": record.get("schema_valid"),
                    "count_match": record.get("count_match"),
                    "structure_pass": record.get("structure_pass"),
                    "question_count": deterministic.get("question_count"),
                    "source_excerpt_grounding": deterministic.get(
                        "source_excerpt_grounding"
                    ),
                    "duplicate_question_count": deterministic.get(
                        "duplicate_question_count"
                    ),
                    "groundedness_score": record.get("groundedness_score"),
                    "quality_score": record.get("quality_score"),
                    "latency_ms": record.get("latency_ms"),
                }
            )
    lines = [
        "# Doc2Quiz Prompt DeepEval Report",
        "",
        f"- Model: `{summary['model']}`",
        f"- Cases: {summary['total_cases']} x 5 repetitions",
        f"- Valid outputs: {summary['valid_outputs']}/{summary['repetitions']}",
        f"- Overall: **{'PASS' if summary['overall_pass'] else 'FAIL'}**",
        "",
        "## Aggregate",
        "",
    ]
    for key, value in summary["rates"].items():
        shown = f"{value:.1%}" if isinstance(value, float) else str(value)
        lines.append(f"- {key}: {shown}")
    lines.extend(["", "## Threshold Checks", ""])
    for key, passed in summary["checks"].items():
        lines.append(f"- {key}: {'PASS' if passed else 'FAIL'}")
    lines.extend(["", "## Cases", ""])
    for case in summary["cases"]:
        lines.append(
            f"- `{case['case_id']}`: schema={case['schema_pass_rate']:.1%}, "
            f"count={case['count_pass_rate']:.1%}, generated={case['mean_generated_count']:.1f}, "
            f"groundedness={case['mean_groundedness']}, quality={case['mean_quality']}, "
            f"answer_key={case['has_reference_answer_key']}"
        )
    (output_dir / f"report_{label}.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--prompt", type=Path, default=DEFAULT_PROMPT)
    parser.add_argument("--pdf", type=Path, action="append", dest="pdfs")
    parser.add_argument("--repetitions", type=int, default=5)
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--label", default="quiz_v1_9router_gpt56sol")
    parser.add_argument("--output-dir", type=Path, default=ROOT / "eval" / "results")
    args = parser.parse_args()

    base_url = os.environ["QUIZ_EVAL_BASE_URL"].rstrip("/")
    api_key = os.environ["QUIZ_EVAL_API_KEY"]
    model = os.environ["QUIZ_EVAL_MODEL"]
    spec = json.loads(args.prompt.read_text(encoding="utf-8"))
    system_prompt = build_system_prompt(spec)
    cases = [extract_pdf_case(path) for path in (args.pdfs or DEFAULT_PDFS)]
    case_by_id = {case["case_id"]: case for case in cases}
    raw_path = args.output_dir / f"raw_outputs_{args.label}.jsonl"
    args.output_dir.mkdir(parents=True, exist_ok=True)
    records_by_key: dict[tuple[str, int], dict[str, Any]] = {}
    if raw_path.exists():
        for line in raw_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            key = (record["case_id"], record["repetition"])
            if record.get("schema_valid"):
                case = case_by_id[record["case_id"]]
                original = record.get("parsed_output")
                repaired = repair_stream_mojibake(original)
                if repaired != original:
                    record["parsed_output"] = repaired
                    record.update(validate_output(repaired, case["requested_count"]))
                    record["deterministic"] = deterministic_scores(repaired, case)
                    record.pop("groundedness_score", None)
                    record.pop("groundedness_reason", None)
                    record.pop("quality_score", None)
                    record.pop("quality_reason", None)
                    record["stream_text_repaired"] = True
                records_by_key[key] = record
    jobs = [
        (case, repetition)
        for case in cases
        for repetition in range(1, args.repetitions + 1)
        if (case["case_id"], repetition) not in records_by_key
    ]
    write_lock = threading.Lock()

    def run_job(case: dict[str, Any], repetition: int) -> dict[str, Any]:
        raw, parsed, api_errors, latency_ms = target_call(
            base_url,
            api_key,
            model,
            system_prompt,
            build_user_input(spec, case),
            case["requested_count"],
        )
        validation = validate_output(parsed, case["requested_count"])
        deterministic = deterministic_scores(parsed or {}, case)
        return {
            "case_id": case["case_id"],
            "repetition": repetition,
            "pdf": case["pdf"],
            "requested_count": case["requested_count"],
            "has_reference_answer_key": case["has_reference_answer_key"],
            "raw_output": raw,
            "parsed_output": parsed,
            "api_errors": api_errors,
            "latency_ms": latency_ms,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "deterministic": deterministic,
            **validation,
        }

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {
            pool.submit(run_job, case, repetition): (case, repetition)
            for case, repetition in jobs
        }
        for future in as_completed(futures):
            record = future.result()
            key = (record["case_id"], record["repetition"])
            records_by_key[key] = record
            with write_lock:
                with raw_path.open("a", encoding="utf-8") as handle:
                    handle.write(json.dumps(record, ensure_ascii=False) + "\n")
            print(
                f"generated {record['case_id']} rep={record['repetition']} "
                f"schema={record['schema_valid']} count={record['deterministic']['question_count']}",
                flush=True,
            )

    records = [records_by_key[key] for key in sorted(records_by_key)]
    raw_path.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )

    judge_jobs = [
        record
        for record in records
        if not (
            isinstance(record.get("groundedness_score"), (int, float))
            and isinstance(record.get("quality_score"), (int, float))
        )
    ]

    def judge_job(record: dict[str, Any]) -> dict[str, Any]:
        local_judge = RouterJudge(base_url, api_key, model)
        groundedness, quality = build_metrics(local_judge)
        return evaluate_record(
            record, case_by_id[record["case_id"]], groundedness, quality
        )

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(judge_job, record) for record in judge_jobs]
        for index, future in enumerate(as_completed(futures), 1):
            record = future.result()
            print(
                f"judged {index}/{len(judge_jobs)} {record['case_id']} "
                f"rep={record['repetition']} groundedness={record.get('groundedness_score')} "
                f"quality={record.get('quality_score')}",
                flush=True,
            )
            with write_lock:
                raw_path.write_text(
                    "".join(
                        json.dumps(item, ensure_ascii=False) + "\n" for item in records
                    ),
                    encoding="utf-8",
                )

    summary = summarize(records, cases)
    write_reports(args.output_dir, args.label, records, summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
