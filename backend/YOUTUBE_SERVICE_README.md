# YouTube Transcription Service

This document describes the YouTube transcription service implemented in the TranscribeX backend using the `youtube-transcript-api` Python library.

## Overview

The transcription service provides robust functionality to:

- Extract video IDs from various YouTube URL formats
- Fetch transcripts using the official `youtube-transcript-api` Python library
- Handle multiple language fallbacks automatically
- Create transcription records in the database
- Provide detailed transcript metadata (timing, language, generation type)

## Architecture

The service uses a **hybrid approach**:

- **Backend**: Node.js/TypeScript with Fastify
- **Transcription Engine**: Python script using `youtube-transcript-api`
- **Communication**: `child_process` to execute Python scripts from Node.js
- **Data Format**: JSON for seamless integration

## Setup

### 1. Python Requirements

Ensure you have Python 3.8+ installed on your system:

```bash
# Check Python version
python3 --version

# Install pip if not available
sudo apt-get install python3-pip  # Ubuntu/Debian
brew install python3              # macOS
```

### 2. Install Python Dependencies

```bash
cd scripts
chmod +x setup.sh
./setup.sh
```

Or manually:

```bash
cd scripts
pip3 install -r requirements.txt
```

### 3. Verify Installation

```bash
# Test the Python script directly
python3 scripts/youtube_transcript.py dQw4w9WgXcQ

# Test from Node.js
npx tsx src/lib/transcription-service.test.ts
```

## API Endpoints

### POST /transcriptions/video

Creates a new transcription for a YouTube video.

**Headers:**

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body:**

```json
{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

**Response (201):**

```json
{
    "message": "Transcription created successfully",
    "transcription": {
        "id": "uuid",
        "youtubeId": "dQw4w9WgXcQ",
        "title": "YouTube Video dQw4w9WgXcQ",
        "type": "VIDEO",
        "thumbnail": null,
        "status": "COMPLETED",
        "duration": null,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
    }
}
```

**Supported URL Formats:**

- `https://www.youtube.com/watch?v=<videoId>`
- `https://youtu.be/<videoId>`
- `https://www.youtube.com/embed/<videoId>`
- `https://www.youtube.com/v/<videoId>`

## Service Features

### Transcript Fetching

The service automatically:

1. Extracts video ID from YouTube URLs
2. Executes Python script via `child_process`
3. Fetches transcripts using `youtube-transcript-api`
4. Tries multiple language fallbacks (en, pt, es, fr, de)
5. Returns structured transcript data with timing information

### Language Fallback Strategy

Priority order for transcript languages:

1. **English** (`en`)
2. **Portuguese** (`pt`)
3. **Spanish** (`es`)
4. **French** (`fr`)
5. **German** (`de`)

### Transcript Data Structure

Each transcript includes:

- **Raw Text**: Complete transcript content
- **Snippets**: Individual text segments with timing
- **Metadata**: Language, generation type, word count
- **Timing**: Start time and duration for each segment

## Database Integration

### Transcription Model

Records are created with:

- User association
- YouTube video ID
- Transcript content (if available)
- Language detection
- Generation type (manual vs. auto-generated)
- Processing status and timestamps
- Word count calculation

### Activity Tracking

Activity records include:

- `TRANSCRIPTION_CREATED`: When transcription is initiated
- `TRANSCRIPTION_COMPLETED`: When transcript is successfully processed
- Metadata: Language, word count, generation type

## Error Handling

The service handles various scenarios:

- **Python Script Unavailable**: Service health checks
- **Invalid YouTube URLs**: URL format validation
- **No Transcript Available**: Language fallbacks and error reporting
- **Execution Timeouts**: Configurable timeout handling
- **Network Failures**: Graceful error handling

## Configuration

### Service Options

```typescript
const transcriptionService = new TranscriptionService({
    pythonPath: 'python3', // Python executable path
    scriptPath: './scripts/youtube_transcript.py', // Script location
    timeout: 30000, // Execution timeout (30s)
})
```

### Environment Variables

No additional environment variables required - the service uses the Python library's built-in functionality.

## Advantages of This Approach

1. **Reliability**: Uses official, well-maintained Python library
2. **Feature Rich**: Access to timing, language detection, generation type
3. **Language Support**: Automatic fallbacks and language detection
4. **Scalability**: Easy to extend for playlists and channels
5. **Maintenance**: Python library handles YouTube API changes
6. **Performance**: Efficient transcript fetching without browser simulation

## Future Extensibility

The service is designed for future enhancements:

- **Playlist Processing**: Batch transcript fetching
- **Channel Processing**: Multiple video transcriptions
- **Translation Support**: Built-in YouTube translation features
- **Format Conversion**: Multiple output formats (SRT, VTT, etc.)
- **Batch Operations**: Queue-based processing for large volumes

## Testing

### Python Script Testing

```bash
# Test individual video
python3 scripts/youtube_transcript.py dQw4w9WgXcQ

# Test error handling
python3 scripts/youtube_transcript.py invalid_id
```

### Node.js Service Testing

```bash
# Run comprehensive tests
npx tsx src/lib/transcription-service.test.ts

# Test specific functionality
npx tsx -e "
import { transcriptionService } from './src/lib/transcription-service'
transcriptionService.checkPythonScript().then(console.log)
"
```

## Troubleshooting

### Common Issues

1. **Python Not Found**: Ensure `python3` is in PATH
2. **Dependencies Missing**: Run `pip3 install -r requirements.txt`
3. **Permission Denied**: Make script executable with `chmod +x`
4. **Timeout Errors**: Increase timeout in service configuration

### Debug Mode

Enable detailed logging:

```typescript
// Add to your service configuration
const transcriptionService = new TranscriptionService({
    timeout: 60000, // Increase timeout for debugging
})
```

## Security Considerations

- **Input Validation**: YouTube URL and video ID validation
- **Process Isolation**: Python scripts run in isolated processes
- **Timeout Protection**: Prevents hanging processes
- **Error Sanitization**: Safe error messages for users
- **Authentication Required**: JWT token validation for all requests

## Performance

- **Execution Time**: Typically 2-5 seconds per transcript
- **Memory Usage**: Minimal overhead (Python process per request)
- **Concurrency**: Handles multiple requests simultaneously
- **Caching**: Consider implementing Redis for repeated requests

## Example Usage

```typescript
import { transcriptionService } from '@/lib/transcription-service'

// Get transcript from URL
const result = await transcriptionService.getTranscriptByUrl(
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
)

if (result.success) {
    console.log(`Found transcript with ${result.word_count} words`)
    console.log(`Language: ${result.language}`)
    console.log(`Content: ${result.raw_text}`)
} else {
    console.log(`Error: ${result.error}`)
}
```
