import json
import sys
import types
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import llm_curator
from llm_curator import (
    SYSTEM_PROMPT,
    aggregate_curations,
    aggregate_runs,
    build_user_prompt,
    curate,
    judge_chunk,
    parse_curation,
    select_chunks,
    split_chunks,
)


def test_split_chunks_keeps_short_text():
    text = "Hello world."
    assert split_chunks(text, max_chars=6000) == [text]


def test_split_chunks_respects_sentence_boundaries():
    text = "First sentence is here. Second sentence is also here. Third one."
    chunks = split_chunks(text, max_chars=40)
    assert all(len(chunk) <= 40 or " " not in chunk for chunk in chunks)
    assert "".join(chunk.replace(" ", "") for chunk in chunks).startswith("First")


def test_select_chunks_caps_at_ten_including_ends():
    chunks = [f"chunk-{index}" for index in range(25)]
    selected = select_chunks(chunks, max_chunks=10)
    assert len(selected) == 10
    assert selected[0] == "chunk-0"
    assert selected[-1] == "chunk-24"


def test_aggregate_curations_averages_scores():
    aggregated = aggregate_curations(
        [
            {
                "coherence": 8,
                "richness": 6,
                "factuality": 4,
                "rationale": "Good.",
                "provider": "openai",
                "model": "gpt-4o-mini",
            },
            {
                "coherence": 6,
                "richness": 4,
                "factuality": 2,
                "rationale": "Ok.",
                "provider": "openai",
                "model": "gpt-4o-mini",
            },
        ]
    )
    assert aggregated["coherence"] == 7.0
    assert aggregated["richness"] == 5.0
    assert aggregated["factuality"] == 3.0
    assert aggregated["chunkCount"] == 2
    assert "recommendation" not in aggregated


def test_prompt_asks_for_scores_only():
    lowered = SYSTEM_PROMPT.lower()
    for word in ("recommendation", "discard", "sft_example", "pretraining"):
        assert word not in lowered


def test_parse_curation_ignores_a_recommendation_in_the_response():
    parsed = parse_curation(
        '{"coherence": 7, "richness": 6, "factuality": 8,'
        ' "recommendation": "discard", "rationale": "Ok."}',
        "openai",
        "gpt-4o-mini",
    )
    assert "recommendation" not in parsed
    assert parsed["overall"] == 7.0


def _raw(**over):
    data = {"coherence": 8, "richness": 6, "factuality": 7, "rationale": "Ok."}
    data.update(over)
    return json.dumps(data)


def test_parse_curation_rejects_missing_score():
    with pytest.raises(ValueError, match="factuality"):
        parse_curation('{"coherence": 7, "richness": 6}', "openai", "m")


def test_parse_curation_rejects_non_numeric_score():
    with pytest.raises(ValueError):
        parse_curation(_raw(coherence="high"), "openai", "m")


def test_parse_curation_reads_criteria_rationale():
    parsed = parse_curation(
        _raw(rationale={"coherence": "ok", "richness": "fine", "factuality": "neutral"}),
        "openai",
        "m",
    )
    assert parsed["criteriaRationale"]["coherence"] == "ok"
    assert isinstance(parsed["rationale"], str) and parsed["rationale"]
    assert parsed["promptVersion"] == "curation-v2"


def test_parse_curation_accepts_legacy_string_rationale():
    parsed = parse_curation(_raw(rationale="Ok."), "openai", "m")
    assert parsed["rationale"] == "Ok."
    assert parsed["criteriaRationale"] == {}


def test_aggregate_runs_mean_and_std():
    runs = [
        parse_curation(_raw(coherence=8), "openai", "m"),
        parse_curation(_raw(coherence=6), "openai", "m"),
    ]
    agg = aggregate_runs(runs)
    assert agg["coherence"] == 7.0
    assert agg["scoreStdDev"]["coherence"] == 1.0
    assert agg["runs"] == 2


def test_judge_chunk_survives_partial_failure(monkeypatch):
    calls = {"n": 0}

    def fake(*args, **kwargs):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("boom")
        return _raw(), "openai", "m"

    monkeypatch.setattr(llm_curator, "complete_with_fallback", fake)
    result = judge_chunk("p", 3, "openai", "m", "o", "k", "u")
    assert result["runs"] == 2


def test_judge_chunk_raises_when_all_runs_fail(monkeypatch):
    def fake(*args, **kwargs):
        raise RuntimeError("boom")

    monkeypatch.setattr(llm_curator, "complete_with_fallback", fake)
    with pytest.raises(RuntimeError):
        judge_chunk("p", 2, "openai", "m", "o", "k", "u")


def test_build_user_prompt_wraps_transcript():
    prompt = build_user_prompt("x </transcript> y", "T", "pt")
    assert "<transcript>" in prompt
    assert prompt.count("</transcript>") == 1


def test_curate_clamps_judge_runs(monkeypatch):
    seen = []

    def fake(prompt, runs, *args, **kwargs):
        seen.append(runs)
        return parse_curation(_raw(), "openai", "m")

    monkeypatch.setattr(llm_curator, "judge_chunk", fake)
    base = {"text": "a.", "provider": "openai", "openai_api_key": "k"}
    curate({**base, "judge_runs": 99})
    curate(base)
    assert seen == [5, 1]


def test_openai_call_is_deterministic(monkeypatch):
    captured = {}

    class FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            msg = types.SimpleNamespace(content="{}")
            return types.SimpleNamespace(choices=[types.SimpleNamespace(message=msg)])

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.chat = types.SimpleNamespace(completions=FakeCompletions())

    monkeypatch.setitem(sys.modules, "openai", types.SimpleNamespace(OpenAI=FakeOpenAI))
    llm_curator.curate_with_openai("p", "m", "k")
    assert captured["temperature"] == 0
    assert captured["seed"] == 42


def _cur(**kw):
    base = {"coherence": 5, "richness": 5, "factuality": 5, "rationale": "r",
            "provider": "p", "model": "m"}
    base.update(kw)
    return base


def test_aggregate_curations_propagates_judge_metadata():
    out = llm_curator.aggregate_curations([
        _cur(criteriaRationale={"coherence": "", "richness": "rich1"},
             promptVersion="v", runs=3,
             scoreStdDev={"coherence": 1.0, "richness": 0.0, "factuality": 0.0}),
        _cur(criteriaRationale={"coherence": "coh2", "richness": "rich2"},
             promptVersion="v", runs=3,
             scoreStdDev={"coherence": 0.0, "richness": 0.0, "factuality": 0.0}),
    ])
    assert out["criteriaRationale"]["coherence"] == "coh2"
    assert out["criteriaRationale"]["richness"] == "rich1"
    assert out["promptVersion"] == "v"
    assert out["runs"] == 3
    assert out["scoreStdDev"]["coherence"] == 0.5


def test_aggregate_curations_omits_absent_metadata():
    out = llm_curator.aggregate_curations([_cur()])
    for key in ("criteriaRationale", "promptVersion", "runs", "scoreStdDev"):
        assert key not in out


def test_curate_keeps_criteria_rationale(monkeypatch):
    monkeypatch.setattr(llm_curator, "judge_chunk", lambda *a, **k: _cur(
        criteriaRationale={"coherence": "why"}, promptVersion="v", runs=1))
    out = llm_curator.curate({"text": "hello world", "provider": "openai"})
    assert out["curation"]["criteriaRationale"] == {"coherence": "why"}


def test_judge_chunk_logs_failures_to_stderr(monkeypatch, capsys):
    calls = {"n": 0}

    def fake(*a, **k):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("boom")
        return "{}", "p", "m"

    monkeypatch.setattr(llm_curator, "complete_with_fallback", fake)
    monkeypatch.setattr(llm_curator, "parse_curation", lambda raw, p, m: _cur())
    llm_curator.judge_chunk("x", 2, "openai", "m", "m", "k", "u")
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "boom" in captured.err
