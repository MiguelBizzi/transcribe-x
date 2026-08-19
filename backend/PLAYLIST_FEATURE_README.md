# Playlist Transcription Feature

This document describes the new playlist transcription functionality added to the Transcribe-X backend.

## Overview

The playlist transcription feature allows users to transcribe entire YouTube playlists with a single request. Users can:

- Submit a YouTube playlist URL
- Get transcriptions for all videos in the playlist
- Download all transcriptions as a group
- Track playlist-level statistics and progress

## Architecture

The feature uses a **hybrid approach** for optimal performance and reliability:

1. **YouTube Service (TypeScript)**: Handles playlist metadata, video listings, and credit calculations
2. **Python Service**: Only used for the actual transcription of individual videos
3. **Database**: Stores playlist metadata and links transcriptions to playlists

### Why This Architecture?

- **Faster Playlist Processing**: YouTube API calls are handled in TypeScript (no Python process spawning overhead)
- **Better Error Handling**: TypeScript provides better type safety and error handling for API calls
- **Credit Validation**: Credits are calculated upfront before any transcription begins
- **Modular Design**: Python service remains focused solely on transcription, YouTube service handles metadata

## Database Changes

### New Models

#### Playlist Model

```prisma
model Playlist {
    id                  String   @id @default(uuid())
    userId              String
    youtubeId           String
    title               String
    description         String?
    channelTitle        String?
    channelId           String?
    thumbnail           String?
    videoCount          Int
    status              TranscriptionStatus
    totalDuration       Int?     // in seconds
    totalWordCount      Int?
    errorMessage        String?
    processingStartedAt DateTime?
    completedAt         DateTime?
    createdAt           DateTime  @default(now())
    updatedAt           DateTime  @updatedAt

    user           User           @relation(fields: [userId], references: [id], onDelete: Cascade)
    transcriptions Transcription[]
}
```

#### Updated Transcription Model

```prisma
model Transcription {
    // ... existing fields ...

    // New fields for playlist support
    playlistId          String?
    videoIndex          Int?        // Position in playlist
    isPlaylistVideo     Boolean     @default(false)

    playlist     Playlist?     @relation(fields: [playlistId], references: [id], onDelete: SetNull)
}
```

### Database Migration

The database schema has already been updated. If you need to reset or recreate:

```bash
npx prisma db pull
npx prisma generate
```

## New API Endpoints

### 1. Create Playlist Transcription

**POST** `/transcriptions/playlist`

Creates transcriptions for all videos in a YouTube playlist.

**Request Body:**

```json
{
    "playlistUrl": "https://www.youtube.com/playlist?list=PL..."
}
```

**Response:**

```json
{
    "message": "Playlist transcription created successfully",
    "playlist": {
        "id": "uuid",
        "youtubeId": "playlist_id",
        "title": "Playlist Title",
        "videoCount": 10,
        "status": "COMPLETED",
        "totalDuration": 3600,
        "totalWordCount": 5000,
        "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "result": {
        "totalVideos": 10,
        "processedVideos": 10,
        "failedVideos": 0,
        "totalCreditsUsed": 5
    },
    "credits": {
        "used": 5,
        "remaining": 15,
        "total": 20
    }
}
```

### 2. Get User Playlists

**GET** `/transcriptions/playlists`

Retrieves all playlists for the authenticated user.

**Response:**

```json
{
    "playlists": [
        {
            "id": "uuid",
            "youtubeId": "playlist_id",
            "title": "Playlist Title",
            "description": "Playlist description",
            "channelTitle": "Channel Name",
            "thumbnail": "thumbnail_url",
            "videoCount": 10,
            "status": "COMPLETED",
            "totalDuration": 3600,
            "totalWordCount": 5000,
            "createdAt": "2024-01-01T00:00:00.000Z",
            "transcriptions": [
                {
                    "id": "uuid",
                    "youtubeId": "video_id",
                    "title": "Video Title",
                    "status": "COMPLETED",
                    "duration": 360,
                    "wordCount": 500,
                    "videoIndex": 1,
                    "createdAt": "2024-01-01T00:00:00.000Z"
                }
            ]
        }
    ]
}
```

### 3. Get Playlist by ID

**GET** `/transcriptions/playlists/:id`

Retrieves a specific playlist with all its transcriptions.

**Response:**

```json
{
    "playlist": {
        "id": "uuid",
        "youtubeId": "playlist_id",
        "title": "Playlist Title",
        "description": "Playlist description",
        "channelTitle": "Channel Name",
        "thumbnail": "thumbnail_url",
        "videoCount": 10,
        "status": "COMPLETED",
        "totalDuration": 3600,
        "totalWordCount": 5000,
        "createdAt": "2024-01-01T00:00:00.000Z",
        "transcriptions": [
            {
                "id": "uuid",
                "youtubeId": "video_id",
                "title": "Video Title",
                "status": "COMPLETED",
                "content": "Full transcript text...",
                "duration": 360,
                "wordCount": 500,
                "language": "en",
                "timestamps": [...],
                "videoIndex": 1,
                "createdAt": "2024-01-01T00:00:00.000Z"
            }
        ]
    }
}
```

## Credit System

Playlist transcriptions use the same credit system as individual video transcriptions:

- 1 credit = 10 minutes of transcription
- Credits are calculated based on the total duration of all videos in the playlist
- Credits are deducted upfront before processing begins
- If insufficient credits, the request is rejected

## YouTube Data API Integration

The feature uses the YouTube Data API v3 through the **TypeScript YouTube service** to:

1. **Extract Playlist ID**: Parse YouTube playlist URLs to extract the playlist ID
2. **Get Playlist Details**: Fetch playlist metadata (title, description, channel info)
3. **List Playlist Videos**: Get all video IDs and metadata from the playlist
4. **Get Video Details**: Fetch individual video information for credit calculation

### Required API Permissions

Ensure your YouTube Data API key has access to:

- `youtube.playlists.list` - For playlist metadata
- `youtube.playlistItems.list` - For playlist video listings
- `youtube.videos.list` - For video details

## Processing Flow

1. **Validation**: Check playlist URL format and user authentication
2. **YouTube API Calls**: Fetch playlist details and video list using TypeScript service
3. **Credit Check**: Calculate total credits needed and verify user balance
4. **Playlist Creation**: Create playlist record in database
5. **Video Processing**: Process each video in the playlist sequentially
6. **Transcription**: Use Python service for individual video transcriptions
7. **Credit Deduction**: Deduct credits for each successful transcription
8. **Status Update**: Update playlist status based on processing results
9. **Response**: Return comprehensive results to the user

## Error Handling

The system handles various error scenarios:

- **Invalid Playlist URL**: Returns 400 with validation error
- **Insufficient Credits**: Returns 402 with credit details
- **Playlist Not Found**: Returns 400 if playlist doesn't exist
- **Individual Video Failures**: Tracks failed videos but continues processing
- **API Rate Limits**: Handles YouTube API quota exhaustion gracefully

## Frontend Integration

The frontend can use these endpoints to:

- Display a playlist input form
- Show processing progress and status
- List user's playlists with video counts
- Provide bulk download functionality
- Display playlist-level statistics

## Security Considerations

- All endpoints require authentication
- Users can only access their own playlists
- Credit validation prevents abuse
- Rate limiting should be implemented for playlist creation

## Performance Considerations

- **Fast Playlist Processing**: YouTube API calls are handled in TypeScript (no Python overhead)
- **Sequential Video Processing**: Videos are processed one by one to avoid overwhelming the Python service
- **Credit Pre-validation**: Credits are checked upfront to avoid wasted processing
- **Efficient Database Queries**: Proper indexing for playlist and transcription relationships

## Testing

### Test YouTube API Integration

```bash
# Install Python dependencies
pip install -r scripts/requirements_youtube_api.txt

# Test with your API key
python scripts/test_youtube_api.py YOUR_API_KEY
```

### Test Playlist Endpoints

1. Start the server: `npm run dev`
2. Test playlist creation: `POST /transcriptions/playlist`
3. Test playlist listing: `GET /transcriptions/playlists`
4. Test playlist details: `GET /transcriptions/playlists/:id`

## Future Enhancements

Potential improvements for the playlist feature:

1. **Background Processing**: Move playlist processing to background jobs for very large playlists
2. **Progress Tracking**: Real-time progress updates during processing
3. **Batch Operations**: Allow users to select specific videos from playlists
4. **Export Formats**: Support for exporting entire playlists in various formats
5. **Collaboration**: Share playlists between users
6. **Analytics**: Track playlist usage and performance metrics
7. **Caching**: Cache playlist metadata to reduce API calls
8. **Parallel Processing**: Process multiple videos simultaneously (with rate limiting)
