#!/usr/bin/env python3
"""
LLM-assisted punctuation restoration for auto-generated captions.

YouTube's automatic captions arrive as one unpunctuated stream: no sentence
boundaries, no commas, no capitalization. The LLM proposes punctuation for
each chunk, but its words are never trusted. The proposal is aligned to the
source tokens and only punctuation and capitalization are copied back, so the
word sequence of the output is identical to the input by construction.
"""

from __future__ import annotations

import difflib
import os
import re
import unicodedata
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional, Tuple

CHUNK_WORDS = 250
MAX_WORKERS = 6
ATTEMPTS = 2
MIN_WORDS = 20
# Sentence marks per word below which a text counts as unpunctuated. Written
# Portuguese and English run around 0.06–0.1; auto captions sit at 0.
SENTENCE_MARK_DENSITY = 0.02

SYSTEM_PROMPT = """You restore punctuation in speech transcripts.
Insert punctuation (. , ? ! ; :) and sentence capitalization.
Never add, remove, reorder, translate, or correct words: every word must stay exactly as given.
The excerpt may begin or end mid-sentence.
Return JSON only: {"text": "<the excerpt with punctuation>"}"""

WORD_RE = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*", re.UNICODE)
SENTENCE_MARK_RE = re.compile(r"[.!?]")
TRAILING_PUNCT_RE = re.compile(r"([.,!?;:]+)[\"'”’)\]]*$")

Completer = Callable[[str], str]


def _fold(token: str) -> str:
    decomposed = unicodedata.normalize("NFD", token.lower())
    return "".join(c for c in decomposed if unicodedata.category(c) != "Mn")


def word_keys(text: str) -> List[str]:
    """Folded word sequence: what punctuation restoration must preserve."""
    return [_fold(match) for match in WORD_RE.findall(text)]


def needs_punctuation(text: str) -> bool:
    words = WORD_RE.findall(text)
    if len(words) < MIN_WORDS:
        return False
    marks = len(SENTENCE_MARK_RE.findall(text))
    return marks / len(words) < SENTENCE_MARK_DENSITY


def split_word_chunks(words: List[str], size: int = CHUNK_WORDS) -> List[List[str]]:
    return [words[index : index + size] for index in range(0, len(words), size)]


def _token_key(token: str, position: int) -> str:
    key = "".join(_fold(match) for match in WORD_RE.findall(token))
    # Tokens with no letters (">>", "2020") align only with themselves.
    return key or f"\0{position}:{token}"


def _trailing_punct(token: str) -> str:
    match = TRAILING_PUNCT_RE.search(token)
    return match.group(1) if match else ""


def _strip_trailing_punct(token: str) -> str:
    return TRAILING_PUNCT_RE.sub("", token) or token


def _merge(source: str, proposed: str) -> str:
    core = _strip_trailing_punct(source)
    proposed_core = _strip_trailing_punct(proposed)
    # Take the model's casing only for lowercase source words: a capital in
    # the source (a name, "R", "PIB") is kept.
    if core.islower() and proposed_core.lower() == core:
        core = proposed_core
    return core + _trailing_punct(proposed)


def project_punctuation(source: str, proposed: str) -> str:
    """Copy punctuation and casing from ``proposed`` onto the words of ``source``."""
    source_tokens = source.split()
    proposed_tokens = proposed.split()
    if not source_tokens:
        return source

    matcher = difflib.SequenceMatcher(
        a=[_token_key(t, i) for i, t in enumerate(source_tokens)],
        b=[_token_key(t, -1 - i) for i, t in enumerate(proposed_tokens)],
        autojunk=False,
    )
    output: List[str] = []
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            for offset in range(i2 - i1):
                output.append(
                    _merge(source_tokens[i1 + offset], proposed_tokens[j1 + offset])
                )
            continue
        if tag in ("replace", "delete"):
            output.extend(source_tokens[i1:i2])
        # A boundary proposed on rewritten or invented words still belongs
        # after the last source word of the region.
        if j2 > j1 and output and not _trailing_punct(output[-1]):
            output[-1] += _trailing_punct(proposed_tokens[j2 - 1])
    return " ".join(output)


def restore_punctuation(
    text: str,
    completer: Completer,
    chunk_words: int = CHUNK_WORDS,
    max_workers: int = MAX_WORKERS,
) -> Tuple[str, Dict[str, int]]:
    """Punctuate ``text`` chunk by chunk. A chunk whose call fails stays as is."""
    chunks = [" ".join(chunk) for chunk in split_word_chunks(text.split(), chunk_words)]

    def punctuate(chunk: str) -> Optional[str]:
        for _ in range(ATTEMPTS):
            try:
                return project_punctuation(chunk, completer(chunk))
            except Exception:
                continue
        return None

    with ThreadPoolExecutor(max_workers=max(1, max_workers)) as pool:
        results = list(pool.map(punctuate, chunks))

    restored = [result if result is not None else chunk for chunk, result in zip(chunks, results)]
    stats = {
        "chunks": len(chunks),
        "failedChunks": sum(1 for result in results if result is None),
    }
    return " ".join(restored), stats


def llm_completer(payload: Dict[str, Any]) -> Completer:
    """Chat completion through the curation provider settings."""
    from llm_curator import complete_with_fallback, extract_json

    provider = str(
        payload.get("provider") or os.getenv("CURATION_LLM_PROVIDER") or "openai"
    ).lower()
    openai_model = str(payload.get("openai_model") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini")
    ollama_model = str(payload.get("ollama_model") or os.getenv("OLLAMA_MODEL") or "llama3")
    openai_api_key = str(payload.get("openai_api_key") or os.getenv("OPENAI_API_KEY") or "")
    ollama_base_url = str(
        payload.get("ollama_base_url") or os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434"
    )

    def complete(chunk: str) -> str:
        raw, _, _ = complete_with_fallback(
            chunk,
            provider,
            openai_model,
            ollama_model,
            openai_api_key,
            ollama_base_url,
            SYSTEM_PROMPT,
        )
        return str(extract_json(raw).get("text") or "")

    return complete
