#!/usr/bin/env python3
"""
Transcript post-processing and quality analysis.

Reads a JSON payload from stdin:
    { "text": str, "language_code": str | null, "is_generated": bool }

Prints a JSON result to stdout:
    { "success": true, "processedText": str, "qualityMetrics": {...} }
"""

from __future__ import annotations

import json
import re
import sys
import time
import traceback
import unicodedata
from typing import Any, Dict, List, Optional, Set, Tuple

FILLERS: Dict[str, Set[str]] = {
    "en": {
        "uh", "um", "uhm", "uhh", "umm", "ah", "ahh", "er", "erm",
        "hmm", "hm", "huh", "mhm", "mm", "uh-huh", "uhhuh",
    },
    "pt": {
        "ah", "eh", "né", "ne", "hm", "hmm", "ãh", "ahn", "uhn",
        "hum", "éh", "hã", "hãã",
    },
    "es": {
        "eh", "ehh", "hmm", "hm", "eee", "mmm",
    },
    "fr": {
        "euh", "heu", "hmm", "hm", "euhm", "bah",
    },
    "de": {
        "äh", "ähm", "hmm", "hm", "ähh", "öh",
    },
}

LANGUAGE_ALIASES = {
    "en-us": "en",
    "en-gb": "en",
    "pt-br": "pt",
    "pt-pt": "pt",
    "es-es": "es",
    "es-mx": "es",
    "fr-fr": "fr",
    "de-de": "de",
}

FUNCTION_LETTERS: Dict[str, Set[str]] = {
    "pt": {"a", "à", "e", "é", "o", "ó"},
    "en": {"a", "i"},
    "es": {"a", "e", "o", "y"},
}
_DEFAULT_FUNCTION_LETTERS: Set[str] = set().union(*FUNCTION_LETTERS.values())

REPEATED_COMMA_RE = re.compile(r",(?:\s*,)+")
COMMA_BEFORE_PUNCT_RE = re.compile(r",\s*([.;:!?])")
OVER_DELETION_THRESHOLD = 0.75

TIMESTAMP_PATTERNS = [
    re.compile(r"\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\]"),
    re.compile(r"\((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\)"),
    re.compile(r"\b(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{1,3}\b"),
    re.compile(r"\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b"),
]

SQUARE_BRACKET_RE = re.compile(r"\[[^\[\]]*\]")
MUSIC_NOTE_RE = re.compile(r"♪[^♪]*♪")
STAGE_DIRECTION_RE = re.compile(r"\([^()]*\)|\{[^{}]*\}")

# Prefixes, matched after accent folding. Short words that would collide
# with ordinary vocabulary live in NONVERBAL_EXACT instead.
NONVERBAL_STEMS: Tuple[str, ...] = (
    "suspir",
    "risad",
    "rindo",
    "riso",
    "laugh",
    "music",
    "paus",
    "silenc",
    "toss",
    "pigarr",
    "espirr",
    "gaguej",
    "inaud",
    "incompreens",
    "aplaus",
    "applau",
    "cheer",
    "scream",
    "instrument",
    "sigh",
    "cough",
    "sneez",
    "stutter",
    "unintell",
    "gasp",
    "chuckl",
    "breath",
    "soupir",
    "rire",
    "toux",
    "eternu",
    "begai",
    "seufz",
    "husten",
    "niesen",
    "stotter",
    "unversta",
    "estornud",
    "tartamud",
    "llant",
    "grito",
    "trilha",
    "barulh",
    "ruid",
    "bocej",
    "gemid",
    "assov",
    "enfase",
    "choro",
    "palma",
    "lachen",
    "lacht",
    "gelacht",
)
NONVERBAL_EXACT: Set[str] = {
    "tos",
    "tose",
    "toser",
    "tosiendo",
    "sing",
    "sings",
    "singing",
    "sang",
    "sung",
    "canto",
    "cantar",
    "cantando",
}
STAGE_MODIFIERS: Set[str] = {
    "alto",
    "alta",
    "altos",
    "altas",
    "baixo",
    "baixa",
    "longo",
    "longa",
    "curto",
    "curta",
    "nervosa",
    "nervoso",
    "nervosamente",
    "tocando",
    "de",
    "do",
    "da",
    "dos",
    "das",
    "fundo",
    "plateia",
    "e",
    "ou",
    "com",
    "um",
    "uma",
    "o",
    "a",
    "high",
    "low",
    "long",
    "short",
    "loud",
    "loudly",
    "soft",
    "softly",
    "nervous",
    "nervously",
    "playing",
    "of",
    "the",
    "background",
    "audience",
    "and",
    "largo",
    "larga",
    "bajo",
    "del",
    "y",
    "fort",
    "forte",
    "longue",
    "bas",
    "basse",
    "nerveusement",
    "du",
    "fond",
    "et",
    "laut",
    "leise",
    "lang",
    "lange",
    "nervos",
    "von",
    "und",
    "hintergrund",
}

WORD_RE = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*", re.UNICODE)
WHITESPACE_RE = re.compile(r"[ \t]+")
MULTILINE_RE = re.compile(r"\n{3,}")
ELLIPSIS_RE = re.compile(r"\.{2,}")
SPACE_PUNCT_RE = re.compile(r"\s+([,.;:!?])")
MISSING_SPACE_RE = re.compile(r"([.!?])([^\s\d])")


def normalize_language(code: Optional[str]) -> str:
    if not code:
        return "en"
    lowered = code.strip().lower().replace("_", "-")
    if lowered in LANGUAGE_ALIASES:
        return LANGUAGE_ALIASES[lowered]
    return lowered.split("-")[0] or "en"


def detect_language(text: str, fallback: str) -> str:
    try:
        from langdetect import detect, LangDetectException

        if len(text.split()) < 5:
            return fallback
        detected = detect(text)
        return normalize_language(detected)
    except Exception:
        return fallback


def remove_timestamps(text: str) -> Tuple[str, int]:
    removed = 0
    cleaned = text
    for pattern in TIMESTAMP_PATTERNS:
        matches = pattern.findall(cleaned)
        removed += len(matches)
        cleaned = pattern.sub(" ", cleaned)
    return cleaned, removed


def _fold_token(token: str) -> str:
    decomposed = unicodedata.normalize("NFD", token.lower())
    return "".join(
        char for char in decomposed if unicodedata.category(char) != "Mn"
    )


def _is_nonverbal_word(folded: str) -> bool:
    if folded in NONVERBAL_EXACT:
        return True
    return any(folded.startswith(stem) for stem in NONVERBAL_STEMS)


def _is_stage_direction(inner: str) -> bool:
    """Parenthetical is a sound or action note, not spoken text."""
    if re.search(r"\d", inner):
        return False
    words = WORD_RE.findall(inner)
    if not words or len(words) > 6:
        return False
    folded = [_fold_token(word) for word in words]
    if not any(_is_nonverbal_word(word) for word in folded):
        return False
    return all(
        _is_nonverbal_word(word) or word in STAGE_MODIFIERS for word in folded
    )


def remove_nonverbal_annotations(text: str) -> str:
    """Drop caption stage directions.

    Square brackets always go: in transcripts they mark non-speech.
    Parentheses and braces go only when the inside is a short sound or
    action note. Musical notes (♪) go with them.
    """
    cleaned = text
    previous = None
    while previous != cleaned:
        previous = cleaned
        cleaned = SQUARE_BRACKET_RE.sub(" ", cleaned)

    cleaned = MUSIC_NOTE_RE.sub(" ", cleaned)
    cleaned = cleaned.replace("♪", " ")

    def replace_stage_direction(match: re.Match[str]) -> str:
        inner = match.group(0)[1:-1]
        if _is_stage_direction(inner):
            return " "
        return match.group(0)

    return STAGE_DIRECTION_RE.sub(replace_stage_direction, cleaned)


def tokenize_words(text: str) -> List[str]:
    return [match.group(0) for match in WORD_RE.finditer(text)]


def count_fillers(words: List[str], language: str) -> int:
    fillers = FILLERS.get(language, FILLERS["en"]) | FILLERS["en"]
    return sum(1 for word in words if word.lower() in fillers)


def remove_fillers(text: str, language: str) -> str:
    fillers = FILLERS.get(language, FILLERS["en"]) | FILLERS["en"]

    def replace(match: re.Match[str]) -> str:
        token = match.group(0)
        if token.lower() in fillers:
            return ""
        return token

    return WORD_RE.sub(replace, text)


def collapse_repetitions(text: str) -> Tuple[str, int]:
    words = text.split()
    if not words:
        return text, 0

    collapsed: List[str] = []
    removed = 0
    i = 0
    while i < len(words):
        matched = False
        for n in (3, 2, 1):
            if i + 2 * n <= len(words):
                current = [w.lower() for w in words[i : i + n]]
                nxt = [w.lower() for w in words[i + n : i + 2 * n]]
                if current == nxt:
                    collapsed.extend(words[i : i + n])
                    removed += n
                    i += 2 * n
                    while i + n <= len(words) and [
                        w.lower() for w in words[i : i + n]
                    ] == current:
                        removed += n
                        i += n
                    matched = True
                    break
        if not matched:
            collapsed.append(words[i])
            i += 1

    return " ".join(collapsed), removed


def function_letters(language: str) -> Set[str]:
    return FUNCTION_LETTERS.get(language, _DEFAULT_FUNCTION_LETTERS)


def _drop_isolated_letters(text: str, language: str) -> Tuple[str, int]:
    allowed = function_letters(language)
    removed = 0

    def replace(match: re.Match[str]) -> str:
        nonlocal removed
        token = match.group(0)
        if len(token) == 1 and token.lower() not in allowed:
            removed += 1
            return ""
        return token

    return WORD_RE.sub(replace, text), removed


def _orphan_comma_indexes(text: str) -> List[int]:
    """Commas that do not sit between two words."""
    indexes: List[int] = []
    for index, char in enumerate(text):
        if char != ",":
            continue
        before = text[:index].rstrip()
        after = text[index + 1 :].lstrip()
        before_ok = bool(before) and re.search(r"[^\W\d_]$", before) is not None
        after_ok = bool(after) and re.match(r"[^\W\d_]", after) is not None
        if not (before_ok and after_ok):
            indexes.append(index)
    return indexes


def _remove_orphan_commas(text: str) -> str:
    cleaned = REPEATED_COMMA_RE.sub(",", text)
    cleaned = COMMA_BEFORE_PUNCT_RE.sub(r"\1", cleaned)
    indexes = set(_orphan_comma_indexes(cleaned))
    if not indexes:
        return cleaned
    return "".join(char for index, char in enumerate(cleaned) if index not in indexes)


def count_residual_artifacts(text: str, language: str) -> Tuple[int, int]:
    """Orphan commas and isolated non-word letters still present in text."""
    without_letters, letters = _drop_isolated_letters(text, language)
    without_commas = _remove_orphan_commas(without_letters)
    commas = without_letters.count(",") - without_commas.count(",")
    return commas, letters


def strip_residual_artifacts(text: str, language: str) -> str:
    without_letters, _ = _drop_isolated_letters(text, language)
    return _remove_orphan_commas(without_letters)


def count_immediate_repetitions(words: List[str]) -> int:
    """Tokens that repeat the previous token, case-insensitive."""
    count = 0
    previous: Optional[str] = None
    for word in words:
        lowered = word.lower()
        if previous is not None and lowered == previous:
            count += 1
        previous = lowered
    return count


def normalize_sentences(text: str) -> str:
    cleaned = text.replace("\u00a0", " ")
    cleaned = ELLIPSIS_RE.sub("...", cleaned)
    cleaned = WHITESPACE_RE.sub(" ", cleaned)
    cleaned = MULTILINE_RE.sub("\n\n", cleaned)
    cleaned = SPACE_PUNCT_RE.sub(r"\1", cleaned)
    cleaned = MISSING_SPACE_RE.sub(r"\1 \2", cleaned)
    cleaned = cleaned.strip()

    if not cleaned:
        return cleaned

    parts = re.split(r"([.!?]+)\s+", cleaned)
    rebuilt: List[str] = []
    for i, part in enumerate(parts):
        snippet = part.strip()
        if not snippet:
            continue
        if i % 2 == 0:
            rebuilt.append(snippet[:1].upper() + snippet[1:] if snippet else snippet)
        else:
            rebuilt.append(snippet)

    result = ""
    for i, snippet in enumerate(rebuilt):
        if i == 0:
            result = snippet
        elif re.fullmatch(r"[.!?]+", snippet):
            result += snippet
        else:
            result += " " + snippet

    if result and result[-1] not in ".!?":
        result += "."

    return result


def maybe_spellcheck(text: str, language: str, is_generated: bool) -> str:
    if not is_generated:
        return text

    if len(text.split()) > 2500:
        return text

    try:
        from spellchecker import SpellChecker
    except ImportError:
        return text

    supported = {"en", "es", "fr", "pt", "de"}
    lang = language if language in supported else "en"

    try:
        checker = SpellChecker(language=lang)
    except Exception:
        return text

    def replace(match: re.Match[str]) -> str:
        token = match.group(0)
        if not token.isalpha() or len(token) < 3:
            return token
        lowered = token.lower()
        if lowered in checker:
            return token
        correction = checker.correction(lowered)
        if not correction or correction == lowered:
            return token
        # Nearest-neighbor edits rewrite unknown words (frontend → fronte).
        # Only restore accents when the letter sequence is unchanged.
        if _fold_token(correction) != _fold_token(token):
            return token
        if token[0].isupper():
            return correction.capitalize()
        return correction

    return WORD_RE.sub(replace, text)


def sentence_length_score(avg_sentence_length: float) -> float:
    if avg_sentence_length <= 0:
        return 0.0
    if 8 <= avg_sentence_length <= 25:
        return 1.0
    if avg_sentence_length < 8:
        return max(0.0, avg_sentence_length / 8)
    return max(0.0, 1.0 - ((avg_sentence_length - 25) / 40))


def _mtld_direction(words: List[str], threshold: float) -> float:
    """One-pass MTLD (McCarthy & Jarvis, 2010)."""
    if not words:
        return 0.0

    types: Set[str] = set()
    token_count = 0
    factor_count = 0.0

    for word in words:
        token_count += 1
        types.add(word.lower())
        ttr = len(types) / token_count
        if ttr <= threshold:
            factor_count += 1.0
            types = set()
            token_count = 0

    if token_count > 0:
        ttr = len(types) / token_count
        if ttr < 1.0:
            factor_count += (1.0 - ttr) / (1.0 - threshold)

    if factor_count == 0.0:
        return float(len(words))

    return len(words) / factor_count


def compute_mtld(words: List[str], threshold: float = 0.72) -> Optional[float]:
    """Bidirectional MTLD, robust to text length (McCarthy & Jarvis, 2010).

    Returns None below 10 tokens. Zero would look like a worse score, but the
    measure is simply undefined on a short sample.
    """
    if len(words) < 10:
        return None
    forward = _mtld_direction(words, threshold)
    backward = _mtld_direction(list(reversed(words)), threshold)
    return (forward + backward) / 2.0


def compute_mattr(words: List[str], window: int = 50) -> float:
    """Moving Average Type-Token Ratio (Covington & McFall, 2010)."""
    count = len(words)
    if count == 0:
        return 0.0

    lowered = [word.lower() for word in words]
    if count < window:
        return len(set(lowered)) / count

    ttr_sum = 0.0
    windows = count - window + 1
    for index in range(windows):
        chunk = lowered[index : index + window]
        ttr_sum += len(set(chunk)) / window
    return ttr_sum / windows


def compute_metrics(
    original_text: str,
    processed_text: str,
    hesitation_count: int,
    repetition_count: int,
    timestamp_markers_removed: int,
    detected_language: str,
    duration_ms: int,
) -> Dict[str, Any]:
    original_words = tokenize_words(original_text)
    processed_words = tokenize_words(processed_text)
    original_count = len(original_words)
    processed_count = len(processed_words)

    noise_reduction = 0.0
    if original_count > 0:
        noise_reduction = max(0.0, (original_count - processed_count) / original_count)

    unique_tokens = {word.lower() for word in processed_words}
    lexical_diversity = (
        len(unique_tokens) / processed_count if processed_count > 0 else 0.0
    )
    mtld_score = compute_mtld(processed_words)
    mattr_score = compute_mattr(processed_words)

    sentences = [
        s.strip()
        for s in re.split(r"[.!?]+", processed_text)
        if s.strip()
    ]
    avg_sentence_length = (
        processed_count / len(sentences) if sentences else float(processed_count)
    )

    residual_commas, residual_letters = count_residual_artifacts(
        processed_text, detected_language
    )
    if processed_count == 0:
        artifact_rate = 1.0
        residue_rate = 1.0
    else:
        artifact_rate = min(
            1.0, (residual_commas + residual_letters) / processed_count
        )
        fillers_left = count_fillers(processed_words, detected_language)
        repeats_left = count_immediate_repetitions(processed_words)
        residue_rate = min(1.0, (fillers_left + repeats_left) / processed_count)

    # Scored on this version alone. Noise reduction is a pipeline diagnostic,
    # not a bonus for the raw text (where the rate is always 0).
    quality_score = (
        sentence_length_score(avg_sentence_length) * 0.4
        + (1.0 - artifact_rate) * 0.3
        + (1.0 - residue_rate) * 0.3
    )
    if noise_reduction > OVER_DELETION_THRESHOLD:
        over_deletion = (noise_reduction - OVER_DELETION_THRESHOLD) / (
            1.0 - OVER_DELETION_THRESHOLD
        )
        quality_score *= max(0.0, 1.0 - over_deletion)

    return {
        "originalWordCount": original_count,
        "processedWordCount": processed_count,
        "noiseReductionRate": round(noise_reduction, 4),
        "lexicalDiversity": round(lexical_diversity, 4),
        "mtldScore": None if mtld_score is None else round(mtld_score, 4),
        "mattrScore": round(mattr_score, 4),
        "avgSentenceLength": round(avg_sentence_length, 2),
        "hesitationCount": hesitation_count,
        "repetitionCount": repetition_count,
        "timestampMarkersRemoved": timestamp_markers_removed,
        "detectedLanguage": detected_language,
        "processingDurationMs": duration_ms,
        "artifactRate": round(artifact_rate, 4),
        "residualCommaCount": residual_commas,
        "residualLetterCount": residual_letters,
        "qualityScore": round(min(max(quality_score, 0.0), 1.0), 4),
    }


def process_text(
    text: str,
    language_code: Optional[str] = None,
    is_generated: bool = False,
) -> Dict[str, Any]:
    started = time.perf_counter()
    original = text or ""
    fallback_language = normalize_language(language_code)
    language = detect_language(original, fallback_language)

    without_timestamps, timestamp_count = remove_timestamps(original)
    without_markers = remove_nonverbal_annotations(without_timestamps)
    hesitation_count = count_fillers(tokenize_words(without_markers), language)
    without_fillers = remove_fillers(without_markers, language)
    without_repeats, repetition_count = collapse_repetitions(without_fillers)
    spellchecked = maybe_spellcheck(without_repeats, language, is_generated)
    without_residue = strip_residual_artifacts(spellchecked, language)
    processed = normalize_sentences(without_residue)

    duration_ms = int((time.perf_counter() - started) * 1000)
    metrics = compute_metrics(
        original,
        processed,
        hesitation_count,
        repetition_count,
        timestamp_count,
        language,
        duration_ms,
    )

    return {
        "success": True,
        "processedText": processed,
        "qualityMetrics": metrics,
    }


def analyze_text(
    text: str,
    language_code: Optional[str] = None,
    reference_text: Optional[str] = None,
) -> Dict[str, Any]:
    started = time.perf_counter()
    target = text or ""
    fallback_language = normalize_language(language_code)
    language = detect_language(target, fallback_language)
    hesitation_count = count_fillers(tokenize_words(target), language)
    duration_ms = int((time.perf_counter() - started) * 1000)
    baseline = reference_text if reference_text and reference_text.strip() else target
    metrics = compute_metrics(
        baseline,
        target,
        hesitation_count,
        0,
        0,
        language,
        duration_ms,
    )
    return {
        "success": True,
        "processedText": target,
        "qualityMetrics": metrics,
    }


def read_payload() -> Dict[str, Any]:
    raw = sys.stdin.read()
    if not raw.strip():
        raise ValueError("Empty stdin payload")
    payload = json.loads(raw)
    if not isinstance(payload, dict):
        raise ValueError("Payload must be a JSON object")
    return payload


def main() -> None:
    try:
        payload = read_payload()
        if payload.get("analyze_only"):
            result = analyze_text(
                text=str(payload.get("text") or ""),
                language_code=payload.get("language_code"),
                reference_text=payload.get("reference_text"),
            )
        else:
            result = process_text(
                text=str(payload.get("text") or ""),
                language_code=payload.get("language_code"),
                is_generated=bool(payload.get("is_generated", False)),
            )
        print(json.dumps(result, ensure_ascii=False))
    except Exception as exc:
        print(
            json.dumps(
                {
                    "success": False,
                    "error": str(exc),
                    "traceback": traceback.format_exc(),
                },
                ensure_ascii=False,
            )
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
