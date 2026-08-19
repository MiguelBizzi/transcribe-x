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
from typing import Dict, Any, Optional

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print(json.dumps({
        "success": False,
        "error": "youtube_transcript_api not installed. Run: pip install youtube-transcript-api",
        "error_type": "import_error"
    }))
    sys.exit(1)


def get_video_transcript(video_id: str) -> Dict[str, Any]:
    """
    Fetch transcript for a YouTube video
    
    Args:
        video_id (str): YouTube video ID
        
    Returns:
        Dict containing transcript data or error information
    """
    try:
        # Initialize the API
        ytt_api = YouTubeTranscriptApi()
        
        # Try to fetch transcript with language fallbacks
        # Priority: English, Portuguese, Spanish, French, German
        languages = ['en', 'pt', 'es', 'fr', 'de']
        
        transcript = None
        used_language = None
        
        for lang in languages:
            try:
                transcript = ytt_api.fetch(video_id, languages=[lang])
                used_language = lang
                break
            except Exception as e:
                # Continue to next language if this one fails
                continue
        
        if not transcript:
            # If no transcript found in preferred languages, try to list available ones
            try:
                transcript_list = ytt_api.list(video_id)
                available_languages = [
                    {
                        "language": t.language,
                        "language_code": t.language_code,
                        "is_generated": t.is_generated,
                        "is_translatable": t.is_translatable
                    }
                    for t in transcript_list
                ]
                
                return {
                    "success": False,
                    "error": "No transcript available in preferred languages",
                    "error_type": "no_transcript",
                    "video_id": video_id,
                    "available_languages": available_languages
                }
            except Exception:
                return {
                    "success": False,
                    "error": "No transcript available for this video",
                    "error_type": "no_transcript",
                    "video_id": video_id
                }
        
        transcript_data = {
            "success": True,
            "video_id": video_id,
            "language": transcript.language,
            "language_code": transcript.language_code,
            "is_generated": transcript.is_generated,
            "word_count": 0,
            "duration_seconds": 0,
            "snippets": [],
            "raw_text": "",
            "timestamps": []
        }
        
        all_text = []
        for snippet in transcript:
            snippet_data = {
                "text": snippet.text,
                "start": snippet.start,
                "duration": snippet.duration
            }
            transcript_data["snippets"].append(snippet_data)
            
            transcript_data["timestamps"].append({
                "text": snippet.text,
                "start": snippet.start,
                "duration": snippet.duration
            })
            
            all_text.append(snippet.text)
            
            transcript_data["duration_seconds"] = max(
                transcript_data["duration_seconds"], 
                snippet.start + snippet.duration
            )
        
        transcript_data["raw_text"] = " ".join(all_text)
        transcript_data["word_count"] = len(transcript_data["raw_text"].split())
        
        return transcript_data
        
    except Exception as e:
        error_info = {
            "success": False,
            "error": str(e),
            "error_type": "api_error",
            "video_id": video_id
        }
        
        if "Video unavailable" in str(e):
            error_info["error_type"] = "video_unavailable"
        elif "No transcript available" in str(e):
            error_info["error_type"] = "no_transcript"
        elif "Video ID" in str(e) and "invalid" in str(e):
            error_info["error_type"] = "invalid_video_id"
        
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