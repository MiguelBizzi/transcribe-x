#!/usr/bin/env python3
"""
Paired evaluation of the processing pipeline: raw caption vs processed text.

Every document is its own control. For each metric the script reports the
paired difference, a bootstrap 95% CI, the share of documents that improved,
a Wilcoxon signed-rank test and the rank-biserial effect size. Results are
stratified by caption type (unpunctuated auto captions vs punctuated ones).

Metrics come in three families, kept apart on purpose:

- independent: defined outside the pipeline (Flesch readability, sentence
  length, run-on rate, blind pairwise LLM judgement). The pipeline cannot
  score well on them just by obeying its own rules.
- rule-based: the pipeline's own targets (quality score, filler and
  repetition density, orphan commas). They show the rules were applied.
- preservation: MTLD, MATTR and content-word retention. Cleaning should not
  move lexical diversity much; these show content was not destroyed.

Input is a JSON list of {"id", "lang", "text"}. Export from the database:

    docker exec backend-postgres-1 psql -U root -d transcribe-x-db -At -c \\
      "select json_agg(json_build_object('id',id,'lang',language,'text',content)) \\
       from (select distinct on (youtube_id) id, language, content from transcriptions \\
             where status='COMPLETED' and content is not null and length(content) > 200 \\
             order by youtube_id, created_at desc) t" > corpus.json

Usage:

    python3 scripts/evaluate_pipeline.py corpus.json --out eval/ [--no-punctuation] [--judge 60]
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import random
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import numpy as np
from scipy.stats import binomtest, wilcoxon

sys.path.insert(0, str(Path(__file__).resolve().parent))

import text_processor as tp  # noqa: E402
from punctuation_restorer import needs_punctuation, word_keys  # noqa: E402

VOWEL_GROUP_RE = re.compile(r"[aeiouyáàâãéêíóôõúü]+", re.IGNORECASE)
SENTENCE_SPLIT_RE = re.compile(r"[.!?]+")
RUN_ON_WORDS = 40
JUDGE_WORDS = 180

# (name, family, higher_is_better)
METRICS = [
    ("flesch", "independent", True),
    ("avgSentenceLength", "independent", False),
    ("runOnRate", "independent", False),
    ("qualityScore", "rule-based", True),
    ("fillerDensity", "rule-based", False),
    ("repetitionDensity", "rule-based", False),
    ("orphanCommaRate", "rule-based", False),
    ("mtld", "preservation", True),
    ("mattr", "preservation", True),
]


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        match = re.match(r"\s*([A-Z_]+)\s*=\s*\"?([^\"#]*)\"?", line)
        if match and match.group(1) not in os.environ:
            os.environ[match.group(1)] = match.group(2).strip()


def syllables(word: str) -> int:
    return max(1, len(VOWEL_GROUP_RE.findall(word)))


def sentences_of(text: str) -> List[List[str]]:
    parts = [tp.tokenize_words(part) for part in SENTENCE_SPLIT_RE.split(text)]
    return [part for part in parts if part]


def flesch(text: str, language: str) -> float:
    """Flesch reading ease; Martins et al. (1996) adaptation for Portuguese."""
    words = tp.tokenize_words(text)
    sentences = sentences_of(text)
    if not words or not sentences:
        return 0.0
    asl = len(words) / len(sentences)
    asw = sum(syllables(word) for word in words) / len(words)
    base = 248.835 if language == "pt" else 206.835
    return float(min(100.0, max(0.0, base - 1.015 * asl - 84.6 * asw)))


def run_on_rate(text: str) -> float:
    """Share of words inside sentences longer than RUN_ON_WORDS."""
    sentences = sentences_of(text)
    total = sum(len(sentence) for sentence in sentences)
    if total == 0:
        return 1.0
    return sum(len(s) for s in sentences if len(s) > RUN_ON_WORDS) / total


def content_retention(raw: str, processed: str, language: str) -> float:
    """Multiset recall of raw non-filler words in the processed text."""
    fillers = {tp._fold_token(word) for word in tp.filler_set(language)}
    source = Counter(key for key in word_keys(raw) if key not in fillers)
    if not source:
        return 1.0
    kept = source & Counter(word_keys(processed))
    return sum(kept.values()) / sum(source.values())


def text_metrics(text: str, language: str) -> Dict[str, float]:
    words = tp.tokenize_words(text)
    count = max(1, len(words))
    analysis = tp.analyze_text(text, language)["qualityMetrics"]
    return {
        "flesch": flesch(text, language),
        "avgSentenceLength": analysis["avgSentenceLength"],
        "runOnRate": run_on_rate(text),
        "qualityScore": analysis["qualityScore"],
        "fillerDensity": tp.count_fillers(words, language) / count,
        "repetitionDensity": tp.count_immediate_repetitions(words) / count,
        "orphanCommaRate": tp.count_residual_artifacts(text) / count,
        "mtld": analysis["mtldScore"] if analysis["mtldScore"] is not None else float("nan"),
        "mattr": analysis["mattrScore"],
    }


def cached(cache_dir: Optional[Path], key: str, compute: Callable[[], Any]) -> Any:
    if cache_dir is None:
        return compute()
    path = cache_dir / f"{hashlib.sha1(key.encode()).hexdigest()}.json"
    if path.exists():
        return json.loads(path.read_text())
    value = compute()
    path.write_text(json.dumps(value, ensure_ascii=False))
    return value


def evaluate_document(doc: Dict[str, Any], completer, cache_dir: Optional[Path]) -> Dict[str, Any]:
    raw = doc["text"]
    language = tp.detect_language(raw, tp.normalize_language(doc.get("lang")))
    auto = needs_punctuation(raw)
    mode = "punct" if completer else "clean"

    def run() -> Dict[str, Any]:
        result = tp.process_text(raw, doc.get("lang"), auto, punctuation_completer=completer)
        return {
            "processedText": result["processedText"],
            "punctuationRestored": result["qualityMetrics"]["punctuationRestored"],
        }

    processed = cached(cache_dir, f"{mode}:{doc['id']}:{raw}", run)
    return {
        "id": doc["id"],
        "language": language,
        "group": "auto" if auto else "punctuated",
        "words": len(tp.tokenize_words(raw)),
        "punctuationRestored": processed["punctuationRestored"],
        "retention": content_retention(raw, processed["processedText"], language),
        "raw": text_metrics(raw, language),
        "processed": text_metrics(processed["processedText"], language),
        "rawText": raw,
        "processedText": processed["processedText"],
    }


def paired_stats(raw: np.ndarray, processed: np.ndarray, higher_is_better: bool) -> Dict[str, float]:
    mask = ~(np.isnan(raw) | np.isnan(processed))
    raw, processed = raw[mask], processed[mask]
    delta = processed - raw
    signed = delta if higher_is_better else -delta
    nonzero = signed[signed != 0]
    rng = np.random.default_rng(0)
    boots = [rng.choice(delta, len(delta)).mean() for _ in range(2000)] if len(delta) else [0.0]
    p_value = wilcoxon(processed, raw).pvalue if len(nonzero) else 1.0
    return {
        "n": int(len(delta)),
        "raw": float(raw.mean()) if len(raw) else float("nan"),
        "processed": float(processed.mean()) if len(processed) else float("nan"),
        "delta": float(delta.mean()) if len(delta) else float("nan"),
        "ciLow": float(np.percentile(boots, 2.5)),
        "ciHigh": float(np.percentile(boots, 97.5)),
        "relative": float(delta.mean() / raw.mean()) if len(raw) and raw.mean() else float("nan"),
        "improved": float((signed > 0).mean()) if len(signed) else float("nan"),
        "worsened": float((signed < 0).mean()) if len(signed) else float("nan"),
        "p": float(p_value),
        # Rank-biserial correlation for the paired test, signed so that
        # positive means the processed text is better.
        "effect": float(rank_biserial(nonzero)),
    }


def rank_biserial(signed: np.ndarray) -> float:
    if len(signed) == 0:
        return 0.0
    ranks = np.argsort(np.argsort(np.abs(signed))) + 1
    positive = ranks[signed > 0].sum()
    negative = ranks[signed < 0].sum()
    return (positive - negative) / ranks.sum()


JUDGE_PROMPT = """You compare two versions of the same speech transcript excerpt.
Decide which one is better as text for a language-model training dataset:
readable sentences, no speech noise (hesitations, stutters, caption tags), faithful to what was said.
Return JSON only: {"winner": "A" | "B" | "tie", "reason": "<one short sentence>"}"""


def excerpt_pair(row: Dict[str, Any]) -> tuple[str, str]:
    raw_words = row["rawText"].split()
    processed_words = row["processedText"].split()
    ratio = len(processed_words) / max(1, len(raw_words))
    raw_part = " ".join(raw_words[:JUDGE_WORDS])
    processed_part = " ".join(processed_words[: max(1, round(JUDGE_WORDS * ratio))])
    return raw_part, processed_part


def judge(rows: List[Dict[str, Any]], limit: int, cache_dir: Optional[Path]) -> List[Dict[str, Any]]:
    from llm_curator import complete_with_fallback, extract_json

    provider = os.getenv("CURATION_LLM_PROVIDER") or "openai"
    model = os.getenv("JUDGE_MODEL") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini"
    rng = random.Random(42)
    sample = rows if len(rows) <= limit else rng.sample(rows, limit)
    tasks = []
    for row in sample:
        raw_part, processed_part = excerpt_pair(row)
        processed_first = rng.random() < 0.5
        a, b = (processed_part, raw_part) if processed_first else (raw_part, processed_part)
        tasks.append((row, processed_first, f"Version A:\n{a}\n\nVersion B:\n{b}"))

    def ask(task):
        row, processed_first, prompt = task

        def call() -> Dict[str, Any]:
            raw, _, used_model = complete_with_fallback(
                prompt, provider, model, os.getenv("OLLAMA_MODEL") or "llama3",
                os.getenv("OPENAI_API_KEY") or "",
                os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434",
                JUDGE_PROMPT,
            )
            parsed = extract_json(raw)
            return {"winner": str(parsed.get("winner", "tie")).strip().upper(),
                    "reason": parsed.get("reason", ""), "model": used_model}

        verdict = cached(cache_dir, f"judge:{model}:{prompt}", call)
        processed_label = "A" if processed_first else "B"
        if verdict["winner"] not in ("A", "B"):
            outcome = "tie"
        else:
            outcome = "processed" if verdict["winner"] == processed_label else "raw"
        return {"id": row["id"], "group": row["group"], "outcome": outcome,
                "reason": verdict["reason"], "model": verdict["model"]}

    with ThreadPoolExecutor(max_workers=6) as pool:
        return list(pool.map(ask, tasks))


def fmt(value: float, digits: int = 3) -> str:
    if value != value:
        return "—"
    return f"{value:.{digits}f}"


def fmt_p(value: float) -> str:
    return "<0.001" if value < 0.001 else f"{value:.3f}"


def metrics_table(rows: List[Dict[str, Any]]) -> List[str]:
    lines = [
        "| Métrica | Família | n | Bruto | Processado | Δ médio [IC 95%] | Δ rel. | Melhorou | Piorou | p (Wilcoxon) | r (efeito) |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    for name, family, higher in METRICS:
        stats = paired_stats(
            np.array([row["raw"][name] for row in rows], dtype=float),
            np.array([row["processed"][name] for row in rows], dtype=float),
            higher,
        )
        lines.append(
            f"| {name} {'↑' if higher else '↓'} | {family} | {stats['n']} | {fmt(stats['raw'])} | "
            f"{fmt(stats['processed'])} | {fmt(stats['delta'])} [{fmt(stats['ciLow'])}, {fmt(stats['ciHigh'])}] | "
            f"{fmt(stats['relative'] * 100, 1)}% | {fmt(stats['improved'] * 100, 0)}% | "
            f"{fmt(stats['worsened'] * 100, 0)}% | {fmt_p(stats['p'])} | {fmt(stats['effect'], 2)} |"
        )
    retention = np.array([row["retention"] for row in rows])
    lines.append("")
    lines.append(
        f"Retenção de conteúdo (palavras não-hesitação do bruto presentes no processado): "
        f"média {fmt(retention.mean() * 100, 1)}%, mínimo {fmt(retention.min() * 100, 1)}%."
    )
    return lines


def judge_table(verdicts: List[Dict[str, Any]]) -> List[str]:
    lines = ["| Grupo | n | Processado vence | Bruto vence | Empate | p (sinal, bicaudal) |", "|---|---|---|---|---|---|"]
    for group in ("all", "auto", "punctuated"):
        subset = [v for v in verdicts if group == "all" or v["group"] == group]
        if not subset:
            continue
        wins = sum(v["outcome"] == "processed" for v in subset)
        losses = sum(v["outcome"] == "raw" for v in subset)
        ties = len(subset) - wins - losses
        p_value = binomtest(wins, wins + losses).pvalue if wins + losses else 1.0
        lines.append(f"| {group} | {len(subset)} | {wins} | {losses} | {ties} | {fmt_p(p_value)} |")
    return lines


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("corpus", type=Path)
    parser.add_argument("--out", type=Path, default=Path("eval"))
    parser.add_argument("--no-punctuation", action="store_true", help="ablation: cleaning only")
    parser.add_argument("--judge", type=int, default=0, help="documents for the blind pairwise LLM judge")
    parser.add_argument("--workers", type=int, default=4)
    args = parser.parse_args()

    load_env(Path(__file__).resolve().parents[1] / ".env")
    args.out.mkdir(parents=True, exist_ok=True)
    cache_dir = args.out / "cache"
    cache_dir.mkdir(exist_ok=True)

    completer = None
    if not args.no_punctuation:
        from punctuation_restorer import llm_completer

        completer = llm_completer({})

    corpus = json.loads(args.corpus.read_text())
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        rows = list(pool.map(lambda doc: evaluate_document(doc, completer, cache_dir), corpus))

    mode = "limpeza + pontuação (LLM)" if completer else "apenas limpeza (ablação)"
    report = [f"# Avaliação pareada: bruto × processado ({mode})", "", f"Documentos: {len(rows)}.", ""]
    restored = sum(row["punctuationRestored"] for row in rows)
    report.append(f"Pontuação restaurada em {restored} de {sum(r['group'] == 'auto' for r in rows)} legendas automáticas.")
    for label, subset in (
        ("Todos os documentos", rows),
        ("Legendas automáticas (sem pontuação)", [r for r in rows if r["group"] == "auto"]),
        ("Legendas com pontuação", [r for r in rows if r["group"] == "punctuated"]),
    ):
        if subset:
            report += ["", f"## {label} (n={len(subset)})", ""] + metrics_table(subset)

    if args.judge:
        verdicts = judge(rows, args.judge, cache_dir)
        report += ["", "## Julgamento cego pareado (LLM)", "",
                   f"Trechos de ~{JUDGE_WORDS} palavras, ordem A/B sorteada, modelo {verdicts[0]['model'] if verdicts else '—'}.", ""]
        report += judge_table(verdicts)
        with (args.out / "judge.csv").open("w", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=["id", "group", "outcome", "reason", "model"])
            writer.writeheader()
            writer.writerows(verdicts)

    (args.out / "report.md").write_text("\n".join(report) + "\n")
    with (args.out / "per_document.csv").open("w", newline="") as handle:
        fields = ["id", "language", "group", "words", "punctuationRestored", "retention"]
        fields += [f"{side}_{name}" for name, _, _ in METRICS for side in ("raw", "processed")]
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        for row in rows:
            record = {key: row[key] for key in fields[:6]}
            for name, _, _ in METRICS:
                record[f"raw_{name}"] = row["raw"][name]
                record[f"processed_{name}"] = row["processed"][name]
            writer.writerow(record)
    print("\n".join(report))


if __name__ == "__main__":
    main()
