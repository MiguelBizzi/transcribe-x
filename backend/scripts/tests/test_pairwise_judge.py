import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import evaluate_pipeline as ep
import llm_curator


def test_normalize_winner_variants():
    assert ep.normalize_winner("Version A") == "A"
    assert ep.normalize_winner("a") == "A"
    assert ep.normalize_winner("version_b") == "B"
    assert ep.normalize_winner(" B. ") == "B"
    assert ep.normalize_winner("Tie") == "tie"
    assert ep.normalize_winner(None) == "tie"
    assert ep.normalize_winner("both") == "tie"


def test_resolve_swapped_agreement():
    assert ep.resolve_swapped("processed", "processed") == ("processed", True)
    assert ep.resolve_swapped("raw", "raw") == ("raw", True)


def test_resolve_swapped_disagreement_is_tie():
    assert ep.resolve_swapped("processed", "raw") == ("tie", False)
    assert ep.resolve_swapped("processed", "tie") == ("tie", False)


def test_self_preference_warning():
    assert "self-preference" in ep.self_preference_warning("gpt-4o-mini", "GPT-4o-mini")
    assert ep.self_preference_warning("gpt-4o", "gpt-4o-mini") is None


def test_judge_calls_both_orders(monkeypatch):
    prompts = []

    def fake(prompt, *args):
        prompts.append(prompt)
        return '{"winner": "A", "reason": "x"}', "p", "m"

    monkeypatch.setattr(llm_curator, "complete_with_fallback", fake)
    row = {"id": "d1", "group": "auto", "rawText": "eh hello world", "processedText": "Hello world."}
    out = ep.judge([row], 1, None)
    assert len(prompts) == 2
    raw, proc = ep.excerpt_pair(row)
    assert ep.wrap_pair(raw, proc) in prompts
    assert ep.wrap_pair(proc, raw) in prompts
    assert len(out) == 1
    assert out[0]["outcome"] == "tie" and out[0]["positionConsistent"] is False
    assert out[0]["promptVersion"] == ep.PAIRWISE_PROMPT_VERSION


def test_judge_tolerates_non_string_reason(monkeypatch):
    replies = iter(['{"winner": "A", "reason": ["x", 1]}', '{"winner": "B", "reason": 7}'])
    monkeypatch.setattr(llm_curator, "complete_with_fallback",
                        lambda *a: (next(replies), "p", "m"))
    row = {"id": "d2", "group": "auto", "rawText": "eh hello world", "processedText": "Hello world."}
    out = ep.judge([row], 1, None)
    assert isinstance(out[0]["reason"], str)


def test_restorer_model_by_provider(monkeypatch):
    monkeypatch.setenv("OLLAMA_MODEL", "mistral")
    monkeypatch.setenv("OPENAI_MODEL", "gpt-x")
    assert ep.restorer_model("ollama") == "mistral"
    assert ep.restorer_model("openai") == "gpt-x"
