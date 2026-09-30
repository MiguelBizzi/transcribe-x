import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from text_processor import compute_mattr, compute_metrics, compute_mtld, sentence_length_score


def test_mtld_short_text_is_zero():
    assert compute_mtld(["a", "b", "c"]) == 0.0
    assert compute_mtld(["token"] * 9) == 0.0
    assert compute_mtld.__defaults__[0] == 0.72


def test_mtld_repetition_is_lower_than_diverse_text():
    repeated = ["the"] * 40
    diverse = [f"word{index}" for index in range(40)]
    assert compute_mtld(repeated) < compute_mtld(diverse)


def test_mtld_is_bidirectional_average():
    words = ["alpha", "beta", "gamma"] * 12
    assert compute_mtld(words) == compute_mtld(list(reversed(words)))


def test_mattr_short_text_falls_back_to_ttr():
    words = ["one", "two", "two"]
    assert compute_mattr(words, window=50) == 2 / 3


def test_mattr_window_is_less_length_sensitive_than_ttr():
    long_repeated = (["alpha", "beta"] * 80)
    ttr = len(set(long_repeated)) / len(long_repeated)
    mattr = compute_mattr(long_repeated, window=50)
    assert mattr > ttr


def test_quality_score_does_not_use_ttr():
    metrics = compute_metrics(
        original_text="hello hello world",
        processed_text="hello world extra unique tokens here please",
        hesitation_count=0,
        repetition_count=0,
        timestamp_markers_removed=0,
        detected_language="en",
        duration_ms=1,
    )
    processed = "hello world extra unique tokens here please".split()
    mattr = compute_mattr(processed)
    sentences = [s for s in "hello world extra unique tokens here please".split(".") if s.strip()]
    avg = len(processed) / max(len(sentences), 1)
    expected = mattr * 0.4 + (1.0 - metrics["noiseReductionRate"]) * 0.4 + sentence_length_score(avg) * 0.2
    assert abs(metrics["qualityScore"] - round(min(max(expected, 0.0), 1.0), 4)) < 1e-6
    assert metrics["lexicalDiversity"] != metrics["qualityScore"]
