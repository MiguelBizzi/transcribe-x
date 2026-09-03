#!/usr/bin/env python3
"""
WRAP-style post-curation rewriting (Maini et al., 2024).

Rewrites cleaned transcripts in two modes:
- pretraining: structured encyclopedic/narrative prose
- sft: instruction-response pairs grounded only in the source

Form-only rewrite: grammar, fluency, cohesion. No new facts.
"""

from __future__ import annotations

import json
import os
import re
import sys
import traceback
from typing import Any, Dict, List, Optional

CHUNK_CHARS = 3000
VALID_MODES = {"pretraining", "sft"}

PRETRAINING_SYSTEM_PROMPT = """You rewrite speech transcripts for continued pretraining of language models, following WRAP (Maini et al., 2024).

Rules:
- Improve form only: grammar, punctuation, fluency, paragraph structure, residual disfluency.
- Keep the same language as the source.
- Do not invent facts, names, numbers, claims, or examples.
- Do not change meaning, omit substantial content, or translate.
- Do not add a title, preamble, or commentary about the rewrite.
- Output JSON: {"rewritten": "<full rewritten text>"}
"""

SFT_SYSTEM_PROMPT = """You convert speech transcripts into instruction-response pairs for supervised fine-tuning, following WRAP (Maini et al., 2024) question-answer format.

Rules:
- Every instruction and output must be grounded only in the source transcript.
- Improve form only: grammar, fluency, clarity. Do not invent facts.
- Keep the same language as the source.
- Do not add knowledge that is not in the transcript.
- Cover the main informational content; skip empty talk.
- Output JSON: {"pairs": [{"instruction": "...", "output": "..."}]}
"""


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


def build_user_prompt(
    text: str,
    title: Optional[str],
    language_code: Optional[str],
    chunk_index: int,
    chunk_count: int,
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


def complete_with_openai(
    system_prompt: str,
    user_prompt: str,
    model: str,
    api_key: str,
) -> str:
    from openai import OpenAI

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=model,
        temperature=0.2,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("Empty OpenAI response")
    return content


def complete_with_ollama(
    system_prompt: str,
    user_prompt: str,
    model: str,
    base_url: str,
) -> str:
    import httpx

    url = base_url.rstrip("/") + "/api/chat"
    response = httpx.post(
        url,
        json={
            "model": model,
            "stream": False,
            "format": "json",
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
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


def call_llm(
    system_prompt: str,
    user_prompt: str,
    provider: str,
    openai_model: str,
    ollama_model: str,
    openai_api_key: str,
    ollama_base_url: str,
) -> tuple[str, str, str]:
    used_provider = provider
    used_model = openai_model if provider == "openai" else ollama_model
    try:
        if provider == "openai":
            if not openai_api_key:
                raise ValueError("OPENAI_API_KEY is required for OpenAI rewriting")
            raw = complete_with_openai(
                system_prompt, user_prompt, openai_model, openai_api_key
            )
        else:
            raw = complete_with_ollama(
                system_prompt, user_prompt, ollama_model, ollama_base_url
            )
        return raw, used_provider, used_model
    except Exception as primary_error:
        if provider == "openai":
            raw = complete_with_ollama(
                system_prompt, user_prompt, ollama_model, ollama_base_url
            )
            return raw, "ollama", ollama_model
        if openai_api_key:
            raw = complete_with_openai(
                system_prompt, user_prompt, openai_model, openai_api_key
            )
            return raw, "openai", openai_model
        raise primary_error


def normalize_pairs(value: Any) -> List[Dict[str, str]]:
    if not isinstance(value, list):
        return []
    pairs: List[Dict[str, str]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        instruction = str(
            item.get("instruction") or item.get("question") or ""
        ).strip()
        output = str(item.get("output") or item.get("answer") or "").strip()
        if instruction and output:
            pairs.append({"instruction": instruction, "output": output})
    return pairs


def pairs_to_markdown(pairs: List[Dict[str, str]]) -> str:
    blocks = []
    for index, pair in enumerate(pairs, start=1):
        blocks.append(
            f"### {index}. {pair['instruction']}\n\n{pair['output']}"
        )
    return "\n\n".join(blocks)


def rewrite(payload: Dict[str, Any]) -> Dict[str, Any]:
    text = str(payload.get("text") or "").strip()
    if not text:
        raise ValueError("Text is required")

    mode = str(payload.get("mode") or "pretraining").strip().lower()
    if mode not in VALID_MODES:
        raise ValueError(f"Unsupported mode: {mode}")

    provider = str(
        payload.get("provider") or os.getenv("CURATION_LLM_PROVIDER") or "openai"
    ).lower()
    if provider not in {"openai", "ollama"}:
        raise ValueError(f"Unsupported provider: {provider}")

    openai_model = str(payload.get("openai_model") or os.getenv("OPENAI_MODEL") or "gpt-4o-mini")
    ollama_model = str(payload.get("ollama_model") or os.getenv("OLLAMA_MODEL") or "llama3")
    openai_api_key = str(payload.get("openai_api_key") or os.getenv("OPENAI_API_KEY") or "")
    ollama_base_url = str(
        payload.get("ollama_base_url")
        or os.getenv("OLLAMA_BASE_URL")
        or "http://localhost:11434"
    )

    chunks = split_chunks(text)
    system_prompt = PRETRAINING_SYSTEM_PROMPT if mode == "pretraining" else SFT_SYSTEM_PROMPT
    rewritten_parts: List[str] = []
    pairs: List[Dict[str, str]] = []
    used_provider = provider
    used_model = openai_model if provider == "openai" else ollama_model

    for index, chunk in enumerate(chunks):
        user_prompt = build_user_prompt(
            chunk,
            payload.get("title"),
            payload.get("language_code"),
            index,
            len(chunks),
        )
        raw, used_provider, used_model = call_llm(
            system_prompt,
            user_prompt,
            provider,
            openai_model,
            ollama_model,
            openai_api_key,
            ollama_base_url,
        )
        parsed = extract_json(raw)
        if mode == "sft":
            pairs.extend(normalize_pairs(parsed.get("pairs")))
        else:
            rewritten = str(parsed.get("rewritten") or parsed.get("text") or "").strip()
            if rewritten:
                rewritten_parts.append(rewritten)

    if mode == "sft":
        if not pairs:
            raise ValueError("Rewrite produced no instruction-response pairs")
        rewritten_content = pairs_to_markdown(pairs)
        rewrite_data: Dict[str, Any] = {
            "mode": mode,
            "provider": used_provider,
            "model": used_model,
            "chunkCount": len(chunks),
            "pairCount": len(pairs),
            "pairs": pairs,
        }
    else:
        rewritten_content = "\n\n".join(rewritten_parts).strip()
        if not rewritten_content:
            raise ValueError("Rewrite produced empty text")
        rewrite_data = {
            "mode": mode,
            "provider": used_provider,
            "model": used_model,
            "chunkCount": len(chunks),
        }

    return {
        "success": True,
        "rewrittenContent": rewritten_content,
        "rewriteMode": mode,
        "rewriteData": rewrite_data,
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
        result = rewrite(read_payload())
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
