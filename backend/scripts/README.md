# YouTube Transcription Scripts

This directory contains Python scripts for YouTube transcript fetching using the `youtube-transcript-api` library.

## Files

- `youtube_transcript.py` - Main Python script for fetching transcripts
- `requirements.txt` - Python dependencies
- `setup.sh` - Automated setup script
- `README.md` - This file

## Quick Setup

### 1. Install Python Dependencies

```bash
# Make setup script executable
chmod +x setup.sh

# Run automated setup
./setup.sh
```

### 2. Manual Installation

```bash
# Install Python dependencies
pip3 install -r requirements.txt

# Make script executable
chmod +x youtube_transcript.py
```

### 3. Test Installation

```bash
# Test with a real YouTube video
python3 youtube_transcript.py dQw4w9WgXcQ

# Test error handling
python3 youtube_transcript.py invalid_id
```

## Script Usage

### Command Line

```bash
python3 youtube_transcript.py <video_id>
```

### Examples

```bash
# Fetch transcript for a specific video
python3 youtube_transcript.py dQw4w9WgXcQ

# Test with different video IDs
python3 youtube_transcript.py 9bZkp7q19f0  # PSY - GANGNAM STYLE
python3 youtube_transcript.py kJQP7kiw5Fk  # Luis Fonsi - Despacito
```

### Output Format

The script returns JSON output:

**Success Response:**

```json
{
    "success": true,
    "video_id": "dQw4w9WgXcQ",
    "language": "English",
    "language_code": "en",
    "is_generated": false,
    "word_count": 123,
    "duration_seconds": 212.5,
    "snippets": [
        {
            "text": "Never gonna give you up",
            "start": 0.0,
            "duration": 2.5
        }
    ],
    "raw_text": "Never gonna give you up..."
}
```

**Error Response:**

```json
{
    "success": false,
    "error": "No transcript available for this video",
    "error_type": "no_transcript",
    "video_id": "invalid_id"
}
```

## Error Types

- `import_error` - Python library not installed
- `usage_error` - Incorrect command line usage
- `invalid_video_id` - Invalid video ID format
- `no_transcript` - No transcript available
- `video_unavailable` - Video not accessible
- `api_error` - YouTube API error
- `unexpected_error` - Unexpected script error

## Language Support

The script automatically tries these languages in order:

1. English (`en`)
2. Portuguese (`pt`)
3. Spanish (`es`)
4. French (`fr`)
5. German (`de`)

## Troubleshooting

### Common Issues

1. **Python not found**

    ```bash
    # Check Python installation
    python3 --version

    # Install Python (Ubuntu/Debian)
    sudo apt-get install python3 python3-pip

    # Install Python (macOS)
    brew install python3
    ```

2. **Dependencies missing**

    ```bash
    # Install requirements
    pip3 install -r requirements.txt

    # Or install manually
    pip3 install youtube-transcript-api
    ```

3. **Permission denied**

    ```bash
    # Make script executable
    chmod +x youtube_transcript.py
    ```

4. **Script not found**

    ```bash
    # Check current directory
    pwd
    ls -la youtube_transcript.py

    # Run from correct location
    python3 /path/to/scripts/youtube_transcript.py <video_id>
    ```

### Debug Mode

For debugging, you can modify the script to add more verbose output:

```python
# Add to the script for debugging
import logging
logging.basicConfig(level=logging.DEBUG)
```

## Integration with Node.js

The script is designed to be called from Node.js using `child_process`:

```typescript
import { spawn } from 'child_process'

const pythonProcess = spawn('python3', [
    'scripts/youtube_transcript.py',
    videoId,
])
// ... handle output and errors
```

## Performance Notes

- **Typical execution time**: 2-5 seconds per transcript
- **Memory usage**: Minimal (single Python process)
- **Network calls**: 1-2 HTTP requests per transcript
- **Concurrency**: Safe for multiple simultaneous executions

## Security Considerations

- **Input validation**: Video ID format validation
- **Process isolation**: Runs in separate Python process
- **Timeout protection**: Configurable execution timeout
- **Error sanitization**: Safe error messages

## Future Enhancements

- **Batch processing**: Multiple video IDs in single execution
- **Format conversion**: SRT, VTT, TXT output formats
- **Translation support**: Built-in YouTube translation
- **Caching**: Local transcript caching
- **Rate limiting**: YouTube API rate limit handling
