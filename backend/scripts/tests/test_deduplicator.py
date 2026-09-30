import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from deduplicator import deduplicate, exact_hash


def test_exact_hash_normalizes_punctuation():
    assert exact_hash("Hello, world!") == exact_hash("hello world")


def test_exact_duplicates_are_grouped():
    result = deduplicate(
        [
            {"id": "a", "text": "welcome back to the channel today"},
            {"id": "b", "text": "welcome back to the channel today"},
            {"id": "c", "text": "an entirely different lecture about calculus"},
        ]
    )
    assert result["success"] is True
    assert result["stats"]["exactDuplicateCount"] == 1
    assert result["stats"]["keptCount"] == 2
    duplicate_ids = {item["id"] for item in result["duplicates"]}
    assert "a" in duplicate_ids or "b" in duplicate_ids
    assert "c" not in duplicate_ids


def test_near_duplicates_pass_jaccard_threshold():
    shared = (
        "today we will study linear algebra vectors and matrices "
        "in this lecture about vector spaces and linear maps"
    )
    result = deduplicate(
        [
            {"id": "a", "text": shared},
            {"id": "b", "text": shared + " again"},
            {"id": "c", "text": "baking bread requires flour water yeast and time"},
        ],
        jaccard_threshold=0.8,
        ngram_size=3,
    )
    duplicate_ids = {item["id"] for item in result["duplicates"]}
    assert "a" in duplicate_ids or "b" in duplicate_ids
    assert "c" not in duplicate_ids


def test_distinct_texts_are_not_merged():
    result = deduplicate(
        [
            {"id": "a", "text": "photosynthesis converts light into chemical energy"},
            {"id": "b", "text": "the stock market closed mixed after a volatile session"},
        ]
    )
    assert result["duplicates"] == []
    assert result["stats"]["keptCount"] == 2
