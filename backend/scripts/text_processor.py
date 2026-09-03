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

TIMESTAMP_PATTERNS = [
    re.compile(r"\[(?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\]"),
    re.compile(r"\((?:\d{1,2}:)?\d{1,2}:\d{2}(?:[.,]\d{1,3})?\)"),
    re.compile(r"\b(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{1,3}\b"),
    re.compile(r"\b(?:\d{1,2}:)?\d{1,2}:\d{2}\b"),
]

CAPTION_MARKERS = re.compile(
    r"\[(?:music|applause|laughter|inaudible|silence|cheering|screaming|"
    r"singing|instrumental|__+)\]",
    re.IGNORECASE,
)

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


def remove_caption_markers(text: str) -> str:
    return CAPTION_MARKERS.sub(" ", text)


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
        if not token.isalpha() or len(token) < 4:
            return token
        lowered = token.lower()
        if lowered in checker:
            return token
        correction = checker.correction(lowered)
        if not correction or correction == lowered:
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


def compute_mtld(words: List[str], threshold: float = 0.72) -> float:
    """Bidirectional MTLD, robust to text length (McCarthy & Jarvis, 2010)."""
    if len(words) < 10:
        return 0.0
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

    quality_score = (
        mattr_score * 0.4
        + (1.0 - min(noise_reduction, 1.0)) * 0.4
        + sentence_length_score(avg_sentence_length) * 0.2
    )

    return {
        "originalWordCount": original_count,
        "processedWordCount": processed_count,
        "noiseReductionRate": round(noise_reduction, 4),
        "lexicalDiversity": round(lexical_diversity, 4),
        "mtldScore": round(mtld_score, 4),
        "mattrScore": round(mattr_score, 4),
        "avgSentenceLength": round(avg_sentence_length, 2),
        "hesitationCount": hesitation_count,
        "repetitionCount": repetition_count,
        "timestampMarkersRemoved": timestamp_markers_removed,
        "detectedLanguage": detected_language,
        "processingDurationMs": duration_ms,
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
    without_markers = remove_caption_markers(without_timestamps)
    hesitation_count = count_fillers(tokenize_words(without_markers), language)
    without_fillers = remove_fillers(without_markers, language)
    without_repeats, repetition_count = collapse_repetitions(without_fillers)
    spellchecked = maybe_spellcheck(without_repeats, language, is_generated)
    processed = normalize_sentences(spellchecked)

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
