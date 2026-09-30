import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from llm_curator import aggregate_curations, aggregate_recommendation, select_chunks, split_chunks


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


def test_discard_wins_recommendation():
    assert (
        aggregate_recommendation(["sft_example", "pretraining", "discard"])
        == "discard"
    )


def test_sft_majority_recommendation():
    assert (
        aggregate_recommendation(["sft_example", "sft_example", "pretraining"])
        == "sft_example"
    )


def test_aggregate_curations_averages_scores():
    aggregated = aggregate_curations(
        [
            {
                "coherence": 8,
                "richness": 6,
                "factuality": 4,
                "recommendation": "sft_example",
                "rationale": "Good.",
                "provider": "openai",
                "model": "gpt-4o-mini",
            },
            {
                "coherence": 6,
                "richness": 4,
                "factuality": 2,
                "recommendation": "pretraining",
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
    assert aggregated["recommendation"] == "pretraining"
