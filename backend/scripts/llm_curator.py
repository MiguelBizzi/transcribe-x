#!/usr/bin/env python3
"""
LLM-assisted transcript curation.

Reads a JSON payload from stdin and scores coherence, richness, and
apparent factuality for fine-tuning dataset curation.

Long texts are split into sentence chunks and judged
per chunk, then aggregated.
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback
from typing import Any, Dict, List, Optional

CHUNK_CHARS = 6000
MAX_CHUNKS = 10
VALID_RECOMMENDATIONS = {"sft_example", "pretraining", "discard"}

SYSTEM_PROMPT = """You are a data curator for LLM fine-tuning datasets.
Evaluate the transcript excerpt and return a JSON object with:
- coherence: 0-10 (semantic coherence, discourse structure)
- richness: 0-10 (content density, informational value)
- factuality: 0-10 (apparent factual correctness; penalize contradictions, hallucinated-sounding claims, and empty talk)
- recommendation: one of "sft_example", "pretraining", "discard"
- rationale: one or two short sentences in the same language as the transcript

Use "sft_example" for high-quality, self-contained instructional or explanatory content.
Use "pretraining" for coherent but less structured continuous text.
Use "discard" for noise, ads, empty talk, or incoherent fragments.
Return JSON only."""


def clamp_score(value: Any) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = 0.0
    return round(min(max(number, 0.0), 10.0), 2)


def extract_json(raw: str) -> Dict[str, Any]:
    text = (raw or "").strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fenced:
        text = fenced.group(1)
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1 and end > start:
            text = text[start : end + 1]
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("LLM response is not a JSON object")
    return parsed


def split_chunks(text: str, max_chars: int = CHUNK_CHARS) -> List[str]:
    cleaned = (text or "").strip()
    if not cleaned:
        return []
    if len(cleaned) <= max_chars:
        return [cleaned]

    sentences = re.split(r"(?<=[.!?])\s+", cleaned)
    chunks: List[str] = []
    current = ""
    for sentence in sentences:
        snippet = sentence.strip()
        if not snippet:
            continue
        candidate = f"{current} {snippet}".strip() if current else snippet
        if len(candidate) <= max_chars:
            current = candidate
            continue
        if current:
            chunks.append(current)
        if len(snippet) <= max_chars:
            current = snippet
        else:
            for index in range(0, len(snippet), max_chars):
                piece = snippet[index : index + max_chars].strip()
                if piece:
                    chunks.append(piece)
            current = ""
    if current:
        chunks.append(current)
    return chunks


def select_chunks(chunks: List[str], max_chunks: int = MAX_CHUNKS) -> List[str]:
    if len(chunks) <= max_chunks:
        return chunks
    if max_chunks <= 1:
        return chunks[:1]

    count = len(chunks)
    indices: List[int] = []
    seen = set()
    for step in range(max_chunks):
        index = round(step * (count - 1) / (max_chunks - 1))
        if index not in seen:
            seen.add(index)
            indices.append(index)
    return [chunks[index] for index in indices]


def aggregate_recommendation(recommendations: List[str]) -> str:
    if any(item == "discard" for item in recommendations):
        return "discard"
    if not recommendations:
        return "pretraining"
    sft_count = sum(1 for item in recommendations if item == "sft_example")
    if sft_count > len(recommendations) / 2:
        return "sft_example"
    return "pretraining"


def aggregate_curations(curations: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not curations:
        raise ValueError("No chunk curations to aggregate")

    coherence = round(
        sum(item["coherence"] for item in curations) / len(curations), 2
    )
    richness = round(
        sum(item["richness"] for item in curations) / len(curations), 2
    )
    factuality = round(
        sum(item["factuality"] for item in curations) / len(curations), 2
    )
    overall = round((coherence + richness + factuality) / 3.0, 2)
    recommendation = aggregate_recommendation(
        [str(item["recommendation"]) for item in curations]
    )
    rationales = [
        str(item.get("rationale") or "").strip()
        for item in curations
        if str(item.get("rationale") or "").strip()
    ]
    rationale = " ".join(rationales[:3])
    last = curations[-1]
    return {
        "coherence": coherence,
        "richness": richness,
        "factuality": factuality,
        "overall": overall,
        "recommendation": recommendation,
        "rationale": rationale,
        "provider": last.get("provider"),
        "model": last.get("model"),
        "chunkCount": len(curations),
    }


def build_user_prompt(
    text: str,
    title: Optional[str],
    language_code: Optional[str],
    chunk_index: int = 0,
    chunk_count: int = 1,
) -> str:
    header = []
    if title:
        header.append(f"Title: {title}")
    if language_code:
        header.append(f"Language: {language_code}")
    if chunk_count > 1:
        header.append(f"Chunk: {chunk_index + 1}/{chunk_count}")
    prefix = "\n".join(header)
    if prefix:
        return f"{prefix}\n\nTranscript:\n{text}"
    return f"Transcript:\n{text}"


def curate_with_openai(prompt: str, model: str, api_key: str) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("Empty OpenAI response")
    return content


def curate_with_ollama(prompt: str, model: str, base_url: str) -> str:
    import httpx

    url = base_url.rstrip("/") + "/api/chat"
    response = httpx.post(
        url,
        json={
            "model": model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
        },
        timeout=90.0,
    )
    response.raise_for_status()
    payload = response.json()
    content = (payload.get("message") or {}).get("content")
    if not content:
        raise ValueError("Empty Ollama response")
    return content


def complete_with_fallback(
    prompt: str,
    provider: str,
    openai_model: str,
    ollama_model: str,
    openai_api_key: str,
    ollama_base_url: str,
) -> tuple[str, str, str]:
    used_provider = provider
    used_model = openai_model if provider == "openai" else ollama_model
    raw = ""

    try:
        if provider == "openai":
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY is required for OpenAI curation")
            raw = curate_with_openai(prompt, openai_model, openai_api_key)
        else:
            raw = curate_with_ollama(prompt, ollama_model, ollama_base_url)
    except Exception as primary_error:
        fallback_provider = "ollama" if provider == "openai" else "openai"
        if fallback_provider == "ollama":
            raw = curate_with_ollama(prompt, ollama_model, ollama_base_url)
            used_provider = "ollama"
            used_model = ollama_model
        elif openai_api_key:
            raw = curate_with_openai(prompt, openai_model, openai_api_key)
            used_provider = "openai"
            used_model = openai_model
        else:
            raise primary_error

    return raw, used_provider, used_model


def parse_curation(
    raw: str,
    used_provider: str,
    used_model: str,
) -> Dict[str, Any]:
    parsed = extract_json(raw)
    coherence = clamp_score(parsed.get("coherence"))
    richness = clamp_score(parsed.get("richness"))
    factuality = clamp_score(parsed.get("factuality"))
    overall = round((coherence + richness + factuality) / 3.0, 2)
    recommendation = str(parsed.get("recommendation") or "pretraining").strip()
    if recommendation not in VALID_RECOMMENDATIONS:
        recommendation = "pretraining"

    return {
        "coherence": coherence,
        "richness": richness,
        "factuality": factuality,
        "overall": overall,
        "recommendation": recommendation,
        "rationale": str(parsed.get("rationale") or "").strip(),
        "provider": used_provider,
        "model": used_model,
        "chunkCount": 1,
    }


def curate(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(payload.get("text") or "")
    if not text.strip():
        raise ValueError("Text is required")

    provider = str(
        payload.get("provider") or os.getenv("CURATION_LLM_PROVIDER") or "openai"
    ).lower()
    if provider not in {"openai", "ollama"}:
        raise ValueError(f"Unsupported provider: {provider}")

    openai_model = str(payload.get("openai_model") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini")
    ollama_model = str(payload.get("ollama_model") or os.getenv("OLLAMA_MODEL") or "llama3")
    openai_api_key = str(payload.get("openai_api_key") or os.getenv("OPENAI_API_KEY") or "")
    ollama_base_url = str(
        payload.get("ollama_base_url") or os.getenv("OLLAMA_BASE_URL") or "http://localhost:11434"
    )

    chunks = select_chunks(split_chunks(text))
    if not chunks:
        raise ValueError("Text is required")

    curations: List[Dict[str, Any]] = []
    for index, chunk in enumerate(chunks):
        prompt = build_user_prompt(
            chunk,
            payload.get("title"),
            payload.get("language_code"),
            index,
            len(chunks),
        )
        raw, used_provider, used_model = complete_with_fallback(
            prompt,
            provider,
            openai_model,
            ollama_model,
            openai_api_key,
            ollama_base_url,
        )
        curations.append(parse_curation(raw, used_provider, used_model))

    aggregated = aggregate_curations(curations)
    return {"success": True, "curation": aggregated}


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
        result = curate(read_payload())
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
