import { google } from 'googleapis'
import { env } from '../lib/env'

const youtube = google.youtube('v3')

export interface YouTubeVideoDetails {
    id: string
    title: string
    description: string
    channelTitle: string
    channelId: string
    duration: number
    thumbnail: string
    publishedAt: string
    viewCount: string
    likeCount: string
    tags: string[]
}

export interface YouTubePlaylistDetails {
    id: string
    title: string
    description: string
    channelTitle: string
    channelId: string
    thumbnail: string
    videoCount: number
    publishedAt: string
}

export interface YouTubePlaylistVideo {
    id: string
    title: string
    thumbnail: string
    duration: number
    position: number
}

export class YouTubeService {
    private apiKey: string

    constructor() {
        this.apiKey = env.YOUTUBE_API_KEY
    }

    /**
     * Extract video ID from YouTube URL
     */
    extractVideoId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
            /youtube\.com\/v\/([^&\n?#]+)/,
        ]

        for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match) {
                return match[1]
            }
        }

        return null
    }

    /**
     * Extract playlist ID from YouTube URL
     */
    extractPlaylistId(url: string): string | null {
        const patterns = [
            /(?:youtube\.com\/playlist\?list=|youtube\.com\/watch\?.*&list=)([^&\n?#]+)/,
        ]

        for (const pattern of patterns) {
            const match = url.match(pattern)
            if (match) {
                return match[1]
            }
        }

        return null
    }

    /**
     * Check if URL is a playlist URL
     */
    isPlaylistUrl(url: string): boolean {
        return this.extractPlaylistId(url) !== null
    }

    /**
     * Check if URL is a video URL
     */
    isVideoUrl(url: string): boolean {
        return this.extractVideoId(url) !== null
    }

    /**
     * Fetch playlist details from YouTube by playlist ID
     */
    async getPlaylistDetails(
        playlistId: string,
    ): Promise<YouTubePlaylistDetails> {
        try {
            const response = await youtube.playlists.list({
                key: this.apiKey,
                part: ['snippet', 'contentDetails'],
                id: [playlistId],
            })

            if (!response.data.items || response.data.items.length === 0) {
                throw new Error('Playlist not found')
            }

            const playlist = response.data.items[0]
            const snippet = playlist.snippet!
            const contentDetails = playlist.contentDetails!

            return {
                id: playlist.id!,
                title: snippet.title!,
                description: snippet.description || '',
                channelTitle: snippet.channelTitle!,
                channelId: snippet.channelId!,
                thumbnail:
                    snippet.thumbnails?.high?.url ||
                    snippet.thumbnails?.medium?.url ||
                    '',
                videoCount: contentDetails.itemCount || 0,
                publishedAt: snippet.publishedAt!,
            }
        } catch (error) {
            throw new Error(
                `Failed to fetch playlist details: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    /**
     * Fetch playlist details from YouTube by URL
     */
    async getPlaylistDetailsByUrl(
        url: string,
    ): Promise<YouTubePlaylistDetails> {
        const playlistId = this.extractPlaylistId(url)
        if (!playlistId) {
            throw new Error('Invalid YouTube playlist URL')
        }

        return this.getPlaylistDetails(playlistId)
    }

    /**
     * Fetch all video IDs from a playlist
     */
    async getPlaylistVideoIds(playlistId: string): Promise<string[]> {
        try {
            const videoIds: string[] = []
            let nextPageToken: string | undefined

            do {
                const response = await youtube.playlistItems.list({
                    key: this.apiKey,
                    part: ['contentDetails'],
                    playlistId,
                    maxResults: 50,
                    pageToken: nextPageToken,
                })

                if (response.data.items) {
                    for (const item of response.data.items) {
                        if (item.contentDetails?.videoId) {
                            videoIds.push(item.contentDetails.videoId)
                        }
                    }
                }

                nextPageToken = response.data.nextPageToken || undefined
            } while (nextPageToken)

            return videoIds
        } catch (error) {
            throw new Error(
                `Failed to fetch playlist video IDs: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    /**
     * Fetch playlist videos with details
     */
    async getPlaylistVideos(
        playlistId: string,
    ): Promise<YouTubePlaylistVideo[]> {
        try {
            const videos: YouTubePlaylistVideo[] = []
            let nextPageToken: string | undefined

            do {
                const response = await youtube.playlistItems.list({
                    key: this.apiKey,
                    part: ['snippet', 'contentDetails'],
                    playlistId,
                    maxResults: 50,
                    pageToken: nextPageToken,
                })

                if (response.data.items) {
                    for (const item of response.data.items) {
                        const snippet = item.snippet!
                        const contentDetails = item.contentDetails!

                        if (contentDetails.videoId) {
                            // Get video duration
                            let duration = 0
                            try {
                                const videoDetails = await this.getVideoDetails(
                                    contentDetails.videoId,
                                )
                                duration = videoDetails.duration
                            } catch (_error) {
                                // Skip duration if video is unavailable
                                console.warn(
                                    `Could not get duration for video ${contentDetails.videoId}`,
                                )
                            }

                            videos.push({
                                id: contentDetails.videoId,
                                title: snippet.title!,
                                thumbnail:
                                    snippet.thumbnails?.medium?.url || '',
                                duration,
                                position: videos.length + 1,
                            })
                        }
                    }
                }

                nextPageToken = response.data.nextPageToken || undefined
            } while (nextPageToken)

            return videos
        } catch (error) {
            throw new Error(
                `Failed to fetch playlist videos: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    /**
     * Fetch video details from YouTube by video ID
     */
    async getVideoDetails(videoId: string): Promise<YouTubeVideoDetails> {
        try {
            const response = await youtube.videos.list({
                key: this.apiKey,
                part: ['snippet', 'contentDetails', 'statistics'],
                id: [videoId],
            })

            if (!response.data.items || response.data.items.length === 0) {
                throw new Error('Video not found')
            }

            const video = response.data.items[0]
            const snippet = video.snippet!
            const contentDetails = video.contentDetails!
            const statistics = video.statistics!

            const duration = this.parseDuration(contentDetails.duration!)

            return {
                id: video.id!,
                title: snippet.title!,
                description: snippet.description!,
                channelTitle: snippet.channelTitle!,
                channelId: snippet.channelId!,
                duration,
                thumbnail:
                    snippet.thumbnails?.high?.url ||
                    snippet.thumbnails?.medium?.url ||
                    '',
                publishedAt: snippet.publishedAt!,
                viewCount: statistics.viewCount || '0',
                likeCount: statistics.likeCount || '0',
                tags: snippet.tags || [],
            }
        } catch (error) {
            throw new Error(
                `Failed to fetch video details: ${error instanceof Error ? error.message : 'Unknown error'}`,
            )
        }
    }

    /**
     * Fetch video details from YouTube by URL
     */
    async getVideoDetailsByUrl(url: string): Promise<YouTubeVideoDetails> {
        const videoId = this.extractVideoId(url)
        if (!videoId) {
            throw new Error('Invalid YouTube URL')
        }

        return this.getVideoDetails(videoId)
    }

    /**
     * Parse ISO 8601 duration to seconds
     */
    private parseDuration(duration: string): number {
        const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
        if (!match) return 0

        const hours = parseInt(match[1] || '0')
        const minutes = parseInt(match[2] || '0')
        const seconds = parseInt(match[3] || '0')

        return hours * 3600 + minutes * 60 + seconds
    }

    /**
     * Validate if a string is a valid YouTube URL
     */
    isValidYouTubeUrl(url: string): boolean {
        return this.extractVideoId(url) !== null
    }
}

export const youtubeService = new YouTubeService()
