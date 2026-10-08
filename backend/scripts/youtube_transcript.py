#!/usr/bin/env python3
"""
YouTube Transcript Fetcher Script

This script fetches transcripts from YouTube videos using the youtube-transcript-api library.
It's designed to be called from Node.js backend via child_process.

Usage:
    python youtube_transcript.py <video_id>

Returns:
    JSON string with transcript data or error information
"""

import sys
import json
import traceback
from typing import Any, Dict, List

try:
    from requests import Session, Timeout
    from youtube_transcript_api import (
        AgeRestricted,
        InvalidVideoId,
        IpBlocked,
        NoTranscriptFound,
        RequestBlocked,
        TranscriptsDisabled,
        VideoUnavailable,
        VideoUnplayable,
        YouTubeTranscriptApi,
    )
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "youtube_transcript_api not installed. Run: pip install youtube-transcript-api",
        "error_type": "import_error"
    }))
    sys.exit(1)


PREFERRED_LANGUAGES = [
    "pt",
    "pt-BR",
    "pt-PT",
    "en",
    "en-US",
    "en-GB",
    "es",
    "fr",
    "de",
]


class TimeoutSession(Session):
    def request(self, method, url, **kwargs):
        kwargs.setdefault("timeout", (5, 20))
        return super().request(method, url, **kwargs)


def available_languages_from(exc: NoTranscriptFound) -> List[Dict[str, Any]]:
    languages: List[Dict[str, Any]] = []
    try:
        for transcript in exc._transcript_data:
            languages.append({
                "language": transcript.language,
                "language_code": transcript.language_code,
                "is_generated": transcript.is_generated,
                "is_translatable": transcript.is_translatable,
            })
    except Exception:
        return []
    return languages


def classify_error(exc: BaseException) -> Dict[str, Any]:
    if isinstance(exc, (IpBlocked, RequestBlocked, Timeout)):
        return {
            "error": "YouTube is temporarily limiting caption requests",
            "error_type": "rate_limited",
        }

    if isinstance(exc, NoTranscriptFound):
        return {
            "error": "No transcript available in preferred languages",
            "error_type": "no_transcript",
            "available_languages": available_languages_from(exc),
        }

    if isinstance(exc, TranscriptsDisabled):
        return {
            "error": "Subtitles are disabled for this video",
            "error_type": "no_transcript",
        }

    if isinstance(exc, (VideoUnavailable, VideoUnplayable, AgeRestricted)):
        return {
            "error": "Video unavailable",
            "error_type": "video_unavailable",
        }

    if isinstance(exc, InvalidVideoId):
        return {
            "error": "Invalid video ID",
            "error_type": "invalid_video_id",
        }

    message = str(exc)
    lowered = message.lower()
    if "timeout" in lowered or "429" in message:
        return {
            "error": message,
            "error_type": "rate_limited",
        }

    return {
        "error": message,
        "error_type": "api_error",
    }


def fallback_transcript(exc: NoTranscriptFound):
    transcripts = list(exc._transcript_data)
    if not transcripts:
        return None

    def rank(transcript) -> tuple:
        code = (transcript.language_code or "").lower()
        if code.startswith("pt"):
            return (0, transcript.is_generated)
        if code.startswith("en"):
            return (1, transcript.is_generated)
        return (2, transcript.is_generated)

    return sorted(transcripts, key=rank)[0]


def build_transcript_result(video_id: str, transcript) -> Dict[str, Any]:
    transcript_data: Dict[str, Any] = {
        "success": True,
        "video_id": video_id,
        "language": transcript.language,
        "language_code": transcript.language_code,
        "is_generated": transcript.is_generated,
        "word_count": 0,
        "duration_seconds": 0,
        "snippets": [],
        "raw_text": "",
        "timestamps": [],
    }

    all_text = []
    for snippet in transcript:
        snippet_data = {
            "text": snippet.text,
            "start": snippet.start,
            "duration": snippet.duration,
        }
        transcript_data["snippets"].append(snippet_data)
        transcript_data["timestamps"].append(snippet_data)
        all_text.append(snippet.text)
        transcript_data["duration_seconds"] = max(
            transcript_data["duration_seconds"],
            snippet.start + snippet.duration,
        )

    transcript_data["raw_text"] = " ".join(all_text)
    transcript_data["word_count"] = len(transcript_data["raw_text"].split())

    if not transcript_data["raw_text"].strip():
        return {
            "success": False,
            "error": "No transcript available for this video",
            "error_type": "no_transcript",
            "video_id": video_id,
        }

    return transcript_data


def get_video_transcript(video_id: str) -> Dict[str, Any]:
    """
    Fetch transcript for a YouTube video.

    Args:
        video_id (str): YouTube video ID

    Returns:
        Dict containing transcript data or error information
    """
    try:
        ytt_api = YouTubeTranscriptApi(http_client=TimeoutSession())
        try:
            transcript = ytt_api.fetch(video_id, languages=PREFERRED_LANGUAGES)
        except NoTranscriptFound as exc:
            fallback = fallback_transcript(exc)
            if fallback is None:
                raise
            transcript = fallback.fetch()

        return build_transcript_result(video_id, transcript)

    except Exception as exc:
        error_info = classify_error(exc)
        error_info["success"] = False
        error_info["video_id"] = video_id
        return error_info


def main():
    """Main function to handle command line execution"""
    try:
        if len(sys.argv) != 2:
            print(json.dumps({
                "success": False,
                "error": "Usage: python youtube_transcript.py <video_id>",
                "error_type": "usage_error"
            }))
            sys.exit(1)

        video_id = sys.argv[1].strip()

        if not video_id or len(video_id) < 8:
            print(json.dumps({
                "success": False,
                "error": "Invalid video ID format",
                "error_type": "invalid_video_id",
                "video_id": video_id
            }))
            sys.exit(1)

        result = get_video_transcript(video_id)

        print(json.dumps(result, ensure_ascii=False))

        sys.exit(0 if result["success"] else 1)

    except Exception as e:
        error_result = {
            "success": False,
            "error": f"Unexpected error: {str(e)}",
            "error_type": "unexpected_error",
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_result, ensure_ascii=False))
        sys.exit(1)


if __name__ == "__main__":
    main()
