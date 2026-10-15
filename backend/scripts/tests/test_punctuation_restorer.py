import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from punctuation_restorer import (
    needs_punctuation,
    project_punctuation,
    restore_punctuation,
    split_word_chunks,
    word_keys,
)
from text_processor import process_text

UNPUNCTUATED = (
    "olá pessoal hoje vamos falar sobre frações a fração é uma divisão "
    "o numerador fica em cima e o denominador fica embaixo vamos ver um exemplo"
)


def test_needs_punctuation_only_for_unpunctuated_text():
    assert needs_punctuation(UNPUNCTUATED)
    punctuated = "Olá, pessoal. Hoje vamos falar sobre frações. A fração é uma divisão."
    assert not needs_punctuation(punctuated * 3)
    assert not needs_punctuation("texto curto sem pontos")


def test_projection_copies_punctuation_and_case_onto_source_words():
    source = "olá pessoal hoje vamos falar sobre frações"
    llm = "Olá, pessoal! Hoje vamos falar sobre frações."
    assert project_punctuation(source, llm) == llm


def test_projection_never_changes_the_words():
    source = "a gente vai tacar esse R que é para read e o item b"
    # The model rewrote words, dropped one and added one: none of it may leak.
    llm = "A gente vai colocar esse R, que é para leitura. E o item B também."
    projected = project_punctuation(source, llm)
    assert word_keys(projected) == word_keys(source)
    assert "colocar" not in projected and "também" not in projected
    assert "tacar esse R," in projected


def test_split_word_chunks_covers_every_word_once():
    words = [f"w{index}" for index in range(23)]
    chunks = split_word_chunks(words, 10)
    assert [len(chunk) for chunk in chunks] == [10, 10, 3]
    assert [word for chunk in chunks for word in chunk] == words


def test_restore_keeps_failed_chunks_unchanged():
    words = UNPUNCTUATED.split()

    def complete(chunk: str) -> str:
        if chunk.startswith("olá"):
            return chunk.capitalize() + "."
        raise RuntimeError("provider down")

    restored, stats = restore_punctuation(UNPUNCTUATED, complete, chunk_words=10)
    assert word_keys(restored) == word_keys(UNPUNCTUATED)
    assert restored.startswith("Olá pessoal")
    assert stats["chunks"] == 3
    assert stats["failedChunks"] == 2
    assert len(restored.split()) == len(words)


def test_process_text_uses_restorer_and_reports_it():
    def complete(chunk: str) -> str:
        return (
            "Olá, pessoal. Hoje vamos falar sobre frações. A fração é uma divisão. "
            "O numerador fica em cima e o denominador fica embaixo. Vamos ver um exemplo."
        )

    result = process_text(UNPUNCTUATED, "pt", False, punctuation_completer=complete)
    metrics = result["qualityMetrics"]
    assert metrics["punctuationRestored"] is True
    assert metrics["avgSentenceLength"] < 10
    assert word_keys(result["processedText"]) == word_keys(UNPUNCTUATED)


def test_process_text_without_restorer_is_unchanged():
    result = process_text(UNPUNCTUATED, "pt", False)
    assert result["qualityMetrics"]["punctuationRestored"] is False
