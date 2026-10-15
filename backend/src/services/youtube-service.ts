import { google } from 'googleapis'
import { env } from '../lib/env'
import {
    extractPlaylistId as parsePlaylistId,
    extractVideoId as parseVideoId,
    isPlaylistUrl as urlIsPlaylist,
    isValidYouTubeUrl as urlIsValidVideo,
    isVideoUrl as urlIsVideo,
    parseIso8601Duration,
} from './youtube-url'

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
        return parseVideoId(url)
    }

    /**
     * Extract playlist ID from YouTube URL
     */
    extractPlaylistId(url: string): string | null {
        return parsePlaylistId(url)
    }

    /**
     * Check if URL is a playlist URL
     */
    isPlaylistUrl(url: string): boolean {
        return urlIsPlaylist(url)
    }

    /**
     * Check if URL is a video URL
     */
    isVideoUrl(url: string): boolean {
        return urlIsVideo(url)
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
        return parseIso8601Duration(duration)
    }

    /**
     * Validate if a string is a valid YouTube URL
     */
    isValidYouTubeUrl(url: string): boolean {
        return urlIsValidVideo(url)
    }
}

export const youtubeService = new YouTubeService()
