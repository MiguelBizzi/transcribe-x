import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import llm_curator
from judge_reliability import (
    agreement_with_humans,
    cohen_kappa,
    spearman,
    variant_stability,
)


def test_spearman_perfect_and_inverse():
    assert spearman([1, 2, 3], [2, 4, 6]) == pytest.approx(1.0)
    assert spearman([1, 2, 3], [3, 2, 1]) == pytest.approx(-1.0)
    assert spearman([1, 1, 1], [1, 2, 3]) == 0.0


def test_cohen_kappa_known_value():
    assert cohen_kappa(["x", "x", "y", "y"], ["x", "y", "y", "y"]) == pytest.approx(0.5)
    assert cohen_kappa(["x", "x"], ["x", "x"]) == 1.0


def test_agreement_with_humans_joins_on_id():
    judge = [
        {"id": "1", "outcome": "win"},
        {"id": "2", "outcome": "tie"},
        {"id": "3", "outcome": "loss"},
        {"id": "9", "outcome": "win"},
    ]
    human = [
        {"id": "1", "outcome": "win"},
        {"id": "2", "outcome": "tie"},
        {"id": "3", "outcome": "win"},
        {"id": "8", "outcome": "win"},
    ]
    out = agreement_with_humans(judge, human)
    assert out["n"] == 3
    assert out["agreement"] == pytest.approx(2 / 3)


def test_variant_stability_identical_variants():
    out = variant_stability({"a": [1.0, 5.0, 9.0], "b": [1.0, 5.0, 9.0]})
    assert out["meanSpearman"] == 1.0
    assert out["maxMeanAbsDiff"] == 0.0


def test_curate_accepts_system_prompt_override(monkeypatch):
    seen = []

    def fake(prompt, provider, om, olm, key, url, system_prompt=llm_curator.SYSTEM_PROMPT):
        seen.append(system_prompt)
        return "{}", "openai", "m"

    monkeypatch.setattr(llm_curator, "complete_with_fallback", fake)
    monkeypatch.setattr(llm_curator, "parse_curation", lambda raw, p, m: {
        "coherence": 5, "richness": 5, "factuality": 5, "rationale": "r",
        "provider": p, "model": m})
    llm_curator.curate({"text": "hello world", "provider": "openai", "system_prompt": "CUSTOM"})
    assert seen == ["CUSTOM"]


def test_non_empty_texts_skips_empty_docs():
    from judge_reliability import non_empty_texts

    assert non_empty_texts(["a", {"text": ""}, {"processedText": "b"}, {}]) == ["a", "b"]
