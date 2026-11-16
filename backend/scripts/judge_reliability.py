#!/usr/bin/env python3
"""Usage:
  judge_reliability.py agreement --judge eval/judge.csv --human human.csv
  judge_reliability.py stability corpus.json --n 30
"""
import argparse
import csv
import itertools
import json
import sys
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
from scipy import stats

sys.path.insert(0, str(Path(__file__).resolve().parent))

from judge_prompts import CURATION_PROMPT_VARIANTS, CURATION_SYSTEM_PROMPT


def spearman(xs: List[float], ys: List[float]) -> float:
    if len(xs) < 2 or len(set(xs)) < 2 or len(set(ys)) < 2:
        return 0.0
    rho = stats.spearmanr(xs, ys).statistic
    return 0.0 if rho != rho else float(rho)


def cohen_kappa(a: List[str], b: List[str]) -> float:
    n = len(a)
    if n == 0 or n != len(b):
        raise ValueError("Label lists must be non-empty and equal length")
    observed = sum(x == y for x, y in zip(a, b)) / n
    expected = sum((a.count(c) / n) * (b.count(c) / n) for c in set(a) | set(b))
    if expected >= 1.0:
        return 1.0 if observed == 1.0 else 0.0
    return (observed - expected) / (1.0 - expected)


def agreement_with_humans(
    judge_rows: List[Dict[str, Any]], human_rows: List[Dict[str, Any]]
) -> Dict[str, float]:
    human = {str(r["id"]): str(r["outcome"]) for r in human_rows}
    pairs = [
        (str(r["outcome"]), human[str(r["id"])])
        for r in judge_rows
        if str(r["id"]) in human
    ]
    if not pairs:
        return {"n": 0, "agreement": 0.0, "kappa": 0.0}
    j, h = [p[0] for p in pairs], [p[1] for p in pairs]
    return {
        "n": len(pairs),
        "agreement": sum(x == y for x, y in pairs) / len(pairs),
        "kappa": cohen_kappa(j, h),
    }


def variant_stability(scores_by_variant: Dict[str, List[float]]) -> Dict[str, float]:
    pairs = list(itertools.combinations(scores_by_variant.values(), 2))
    if not pairs:
        return {"meanSpearman": 1.0, "maxMeanAbsDiff": 0.0}
    rhos = [spearman(a, b) for a, b in pairs]
    diffs = [float(np.mean(np.abs(np.array(a) - np.array(b)))) for a, b in pairs]
    return {"meanSpearman": float(np.mean(rhos)), "maxMeanAbsDiff": max(diffs)}


def read_csv(path: str) -> List[Dict[str, str]]:
    with open(path, newline="", encoding="utf-8") as fh:
        return list(csv.DictReader(fh))


def doc_text(doc: Any) -> str:
    if isinstance(doc, str):
        return doc
    return str(doc.get("processedText") or doc.get("text") or doc.get("rawText") or "")


def non_empty_texts(docs: List[Any]) -> List[str]:
    texts = (doc_text(doc) for doc in docs)
    return [t for t in texts if t.strip()]


def cmd_agreement(args: argparse.Namespace) -> None:
    out = agreement_with_humans(read_csv(args.judge), read_csv(args.human))
    print("| n | agreement | kappa |\n|---|---|---|")
    print(f"| {out['n']} | {out['agreement']:.3f} | {out['kappa']:.3f} |")


def cmd_stability(args: argparse.Namespace) -> None:
    import llm_curator

    docs = json.loads(Path(args.corpus).read_text(encoding="utf-8"))[: args.n]
    prompts = {"base": CURATION_SYSTEM_PROMPT}
    for i, variant in enumerate(CURATION_PROMPT_VARIANTS, 1):
        prompts[f"variant{i}"] = variant
    scores: Dict[str, List[float]] = {name: [] for name in prompts}
    docs = non_empty_texts(docs)
    for text in docs:
        for name, prompt in prompts.items():
            result = llm_curator.curate(
                {
                    "text": text,
                    "system_prompt": prompt,
                    "judge_runs": 1,
                }
            )
            scores[name].append(float(result["curation"]["overall"]))
    out = variant_stability(scores)
    print("| docs | meanSpearman | maxMeanAbsDiff |\n|---|---|---|")
    print(f"| {len(docs)} | {out['meanSpearman']:.3f} | {out['maxMeanAbsDiff']:.3f} |")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)
    ag = sub.add_parser("agreement")
    ag.add_argument("--judge", required=True)
    ag.add_argument("--human", required=True)
    ag.set_defaults(func=cmd_agreement)
    st = sub.add_parser("stability")
    st.add_argument("corpus")
    st.add_argument("--n", type=int, default=30)
    st.set_defaults(func=cmd_stability)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
