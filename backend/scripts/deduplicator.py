#!/usr/bin/env python3
"""
Exact and near-duplicate detection for transcription segments.

Reads a JSON payload from stdin:
    {
        "segments": [{ "id": str, "text": str }],
        "jaccard_threshold": float,
        "ngram_size": int
    }

Prints a JSON result to stdout with duplicate groups.
Based on MinHash + Jaccard (Lee et al., 2022).
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import traceback
from typing import Any, Dict, List, Set, Tuple

WORD_RE = re.compile(r"[^\W\d_]+(?:['’-][^\W\d_]+)*", re.UNICODE)


def tokenize(text: str) -> List[str]:
    return [match.group(0).lower() for match in WORD_RE.finditer(text or "")]


def normalize_text(text: str) -> str:
    tokens = tokenize(text)
    return " ".join(tokens)


def exact_hash(text: str) -> str:
    return hashlib.sha256(normalize_text(text).encode("utf-8")).hexdigest()


def ngrams(tokens: List[str], n: int) -> List[str]:
    if n <= 1 or len(tokens) < n:
        return tokens
    return [" ".join(tokens[i : i + n]) for i in range(len(tokens) - n + 1)]


def build_minhash(text: str, ngram_size: int, num_perm: int = 128):
    from datasketch import MinHash

    mh = MinHash(num_perm=num_perm)
    tokens = tokenize(text)
    grams = ngrams(tokens, ngram_size) or tokens or [""]
    for gram in grams:
        mh.update(gram.encode("utf-8"))
    return mh


class UnionFind:
    def __init__(self, ids: List[str]) -> None:
        self.parent = {item: item for item in ids}

    def find(self, item: str) -> str:
        while self.parent[item] != item:
            self.parent[item] = self.parent[self.parent[item]]
            item = self.parent[item]
        return item

    def union(self, left: str, right: str) -> None:
        root_left = self.find(left)
        root_right = self.find(right)
        if root_left != root_right:
            self.parent[root_right] = root_left

    def groups(self) -> Dict[str, List[str]]:
        clustered: Dict[str, List[str]] = {}
        for item in self.parent:
            clustered.setdefault(self.find(item), []).append(item)
        return clustered


def pick_canonical(members: List[Dict[str, Any]]) -> str:
    return max(members, key=lambda item: (len(item.get("text") or ""), item["id"]))["id"]


def deduplicate(
    segments: List[Dict[str, Any]],
    jaccard_threshold: float = 0.8,
    ngram_size: int = 3,
) -> Dict[str, Any]:
    usable = [
        {
            "id": str(segment.get("id") or ""),
            "text": str(segment.get("text") or ""),
        }
        for segment in segments
        if str(segment.get("id") or "").strip()
    ]
    usable = [segment for segment in usable if normalize_text(segment["text"])]

    if not usable:
        return {
            "success": True,
            "groups": [],
            "duplicates": [],
            "stats": {
                "inputCount": len(segments),
                "comparedCount": 0,
                "exactDuplicateCount": 0,
                "nearDuplicateCount": 0,
                "keptCount": 0,
                "groupCount": 0,
            },
        }

    ids = [segment["id"] for segment in usable]
    by_id = {segment["id"]: segment for segment in usable}
    uf = UnionFind(ids)
    exact_pairs: Set[Tuple[str, str]] = set()

    hash_buckets: Dict[str, List[str]] = {}
    for segment in usable:
        digest = exact_hash(segment["text"])
        hash_buckets.setdefault(digest, []).append(segment["id"])

    for bucket in hash_buckets.values():
        for extra_id in bucket[1:]:
            uf.union(bucket[0], extra_id)
            exact_pairs.add(tuple(sorted((bucket[0], extra_id))))

    from datasketch import MinHashLSH

    lsh = MinHashLSH(threshold=jaccard_threshold, num_perm=128)
    signatures = {}
    for segment in usable:
        signature = build_minhash(segment["text"], ngram_size)
        signatures[segment["id"]] = signature
        lsh.insert(segment["id"], signature)

    near_pairs: Set[Tuple[str, str]] = set()
    for segment_id, signature in signatures.items():
        for candidate_id in lsh.query(signature):
            if candidate_id == segment_id:
                continue
            pair = tuple(sorted((segment_id, candidate_id)))
            if pair in exact_pairs:
                continue
            jaccard = signature.jaccard(signatures[candidate_id])
            if jaccard >= jaccard_threshold:
                uf.union(segment_id, candidate_id)
                near_pairs.add(pair)

    groups = []
    duplicates = []
    exact_duplicate_ids: Set[str] = set()
    near_duplicate_ids: Set[str] = set()

    for members_ids in uf.groups().values():
        members = [by_id[member_id] for member_id in members_ids]
        canonical_id = pick_canonical(members)
        canonical_hash = exact_hash(by_id[canonical_id]["text"])
        member_payload = []
        for member in members:
            kind = "canonical"
            if member["id"] != canonical_id:
                kind = (
                    "exact"
                    if exact_hash(member["text"]) == canonical_hash
                    else "near"
                )
                if kind == "exact":
                    exact_duplicate_ids.add(member["id"])
                else:
                    near_duplicate_ids.add(member["id"])
                duplicates.append(
                    {
                        "id": member["id"],
                        "canonicalId": canonical_id,
                        "kind": kind,
                    }
                )
            member_payload.append({"id": member["id"], "kind": kind})

        if len(members) > 1:
            groups.append(
                {
                    "groupId": canonical_id,
                    "canonicalId": canonical_id,
                    "members": member_payload,
                }
            )

    kept_count = len(usable) - len(duplicates)
    return {
        "success": True,
        "groups": groups,
        "duplicates": duplicates,
        "stats": {
            "inputCount": len(segments),
            "comparedCount": len(usable),
            "exactDuplicateCount": len(exact_duplicate_ids),
            "nearDuplicateCount": len(near_duplicate_ids),
            "keptCount": kept_count,
            "groupCount": len(groups),
        },
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
        result = deduplicate(
            segments=list(payload.get("segments") or []),
            jaccard_threshold=float(payload.get("jaccard_threshold") or 0.8),
            ngram_size=int(payload.get("ngram_size") or 3),
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
