import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from text_processor import (
    analyze_text,
    compute_mattr,
    compute_metrics,
    compute_mtld,
    process_text,
)


def test_mtld_short_text_is_undefined():
    assert compute_mtld(["a", "b", "c"]) is None
    assert compute_mtld(["token"] * 9) is None
    assert compute_mtld(["token"] * 10) is not None
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


def test_quality_score_does_not_reward_zero_noise():
    processed = "hello world extra unique tokens here please stay."
    shorter_source = "hello world"
    longer_source = processed + " " + " ".join(["noise"] * 8)
    clean = compute_metrics(
        original_text=shorter_source,
        processed_text=processed,
        hesitation_count=0,
        repetition_count=0,
        timestamp_markers_removed=0,
        detected_language="en",
        duration_ms=1,
    )
    reduced = compute_metrics(
        original_text=longer_source,
        processed_text=processed,
        hesitation_count=0,
        repetition_count=0,
        timestamp_markers_removed=0,
        detected_language="en",
        duration_ms=1,
    )
    assert clean["noiseReductionRate"] == 0.0
    assert reduced["noiseReductionRate"] > 0.0
    assert reduced["noiseReductionRate"] <= 0.75
    assert clean["qualityScore"] == reduced["qualityScore"]


def test_over_deletion_penalty_above_threshold():
    processed = " ".join(["word"] * 20) + "."
    mild = compute_metrics(
        original_text=" ".join(["word"] * 25) + ".",
        processed_text=processed,
        hesitation_count=0,
        repetition_count=0,
        timestamp_markers_removed=0,
        detected_language="en",
        duration_ms=1,
    )
    aggressive = compute_metrics(
        original_text=" ".join(["word"] * 100) + ".",
        processed_text=processed,
        hesitation_count=0,
        repetition_count=0,
        timestamp_markers_removed=0,
        detected_language="en",
        duration_ms=1,
    )
    assert mild["noiseReductionRate"] <= 0.75
    assert aggressive["noiseReductionRate"] > 0.75
    assert aggressive["qualityScore"] < mild["qualityScore"]


def test_mattr_can_fall_when_hapax_noise_is_removed():
    noisy = [token for index in range(60) for token in ("alpha", f"noise{index}")]
    cleaned = ["alpha"] * 60
    assert compute_mattr(cleaned) < compute_mattr(noisy)


ARTIFACT_SAMPLES = [
    "Então, né, a gente vai falar sobre isso, ah, com calma.",
    "Ah, bom dia. Eh, vamos começar, hmm, agora.",
    "e e e então o o o resultado q ficou x assim",
    "fala fala fala sobre métricas, né, de qualidade, eh.",
    "Olá [music] 01:02 pessoal, uh, bem-vindos bem-vindos ao vídeo.",
    "A transcrição automática erra palavras raras e também repete repete trechos, né.",
]


def test_processing_removes_orphan_commas_and_loose_letters():
    for sample in ARTIFACT_SAMPLES:
        processed = process_text(sample, "pt", False)["processedText"]
        assert ",," not in processed
        assert not processed.startswith(",")
        assert ",." not in processed.replace(" ", "")
        assert " q " not in f" {processed.lower()} "
        assert " x " not in f" {processed.lower()} "


def test_processing_keeps_function_words():
    portuguese = process_text("a casa e o jardim", "pt", False)["processedText"]
    assert portuguese.startswith("A casa e o jardim")

    english = process_text("I am a teacher", "en", False)["processedText"]
    assert english.startswith("I am a teacher")

    comma = process_text("não, sim", "pt", False)["processedText"]
    assert comma.startswith("Não, sim")


def test_generated_spellcheck_preserves_unknown_words():
    samples = {
        "com foco em frontend é claro que a gente vai construir a interface completa hoje.": (
            "frontend",
        ),
        "Então bora lá desde a era das cavernas até o momento atual da tecnologia.": (
            "bora",
        ),
        "O dataset de react e javascript ficou pronto para o fine tuning.": (
            "dataset",
            "react",
            "javascript",
        ),
    }
    for sample, words in samples.items():
        processed = process_text(sample, "pt", True)["processedText"].lower()
        for word in words:
            assert word in processed.split()


def test_generated_spellcheck_restores_accents_without_rewriting():
    sample = (
        "Hoje voce nao precisa da transcricao completa para entender o pipeline."
    )
    processed = process_text(sample, "pt", True)["processedText"]
    words = processed.lower().split()
    assert "você" in words
    assert "não" in words
    assert "transcrição" in words
    assert "voce" not in words
    assert "nao" not in words
    assert "transcricao" not in words


# Passages stay inside the 8–25 word fluency band after cleanup. The two
# shortest artifact samples fall below 8 words once fillers are removed, so
# the fluency term would punish length rather than dirtiness.
SCORE_SAMPLES = [
    "Então, né, a gente vai falar sobre isso, ah, com calma e com bastante detalhe hoje.",
    "Ah, bom dia a todos que acompanham esta aula de hoje. Eh, vamos começar, hmm, agora a explicação completa do pipeline inteiro.",
    "e e e então o o o resultado q ficou x assim depois da limpeza completa do texto.",
    "fala fala fala sobre métricas, né, de qualidade, eh, no relatório final do experimento.",
    "Olá [music] 01:02 pessoal, uh, bem-vindos bem-vindos ao vídeo de hoje sobre o pipeline.",
    "A transcrição automática erra palavras raras e também repete repete trechos, né, o tempo todo.",
]


def test_processing_removes_nonverbal_annotations():
    sample = (
        "Então, antes de eu ser cancelado, deixa eu [suspirando][risadas] "
        "deixa eu vir aqui e tentar explicar de uma forma diferente."
    )
    processed = process_text(sample, "pt", False)["processedText"]
    assert "[" not in processed and "]" not in processed
    assert processed.lower().count("deixa eu") == 1

    markers = (
        "[SUSPIRANDO]",
        "(risadas)",
        "{silêncio}",
        "(música tocando)",
        "[music]",
        "♪música♪",
    )
    for marker in markers:
        text = process_text(
            f"Olá pessoal {marker} vamos continuar a explicação agora.",
            "pt",
            False,
        )["processedText"]
        lowered = text.lower()
        assert "[" not in text and "]" not in text
        assert "♪" not in text
        assert "suspirando" not in lowered
        assert "risadas" not in lowered
        assert "silêncio" not in lowered and "silencio" not in lowered
        assert "música" not in lowered and "musica" not in lowered
        assert "music" not in lowered

    spoken = process_text(
        "O resultado (como eu disse) em (2020) ficou claro para todo mundo.",
        "pt",
        False,
    )["processedText"]
    assert "(como eu disse)" in spoken
    assert "(2020)" in spoken

    comma = process_text(
        "eu [risos], então seguimos com a explicação completa.",
        "pt",
        False,
    )["processedText"]
    assert "  " not in comma
    assert ",," not in comma
    assert comma.startswith("Eu, então")


def test_processed_quality_score_is_at_least_raw_on_fixtures():
    for sample in SCORE_SAMPLES:
        raw_score = analyze_text(sample, "pt")["qualityMetrics"]["qualityScore"]
        processed = process_text(sample, "pt", False)
        processed_score = processed["qualityMetrics"]["qualityScore"]
        assert processed["qualityMetrics"]["avgSentenceLength"] >= 8
        assert processed_score >= raw_score
