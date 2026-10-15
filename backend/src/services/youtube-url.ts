const VIDEO_PATTERNS = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
]

const PLAYLIST_PATTERNS = [
    /(?:youtube\.com\/playlist\?list=|youtube\.com\/watch\?.*&list=)([^&\n?#]+)/,
]

export function extractVideoId(url: string): string | null {
    for (const pattern of VIDEO_PATTERNS) {
        const match = url.match(pattern)
        if (match) {
            return match[1]
        }
    }

    return null
}

export function extractPlaylistId(url: string): string | null {
    for (const pattern of PLAYLIST_PATTERNS) {
        const match = url.match(pattern)
        if (match) {
            return match[1]
        }
    }

    return null
}

export function isPlaylistUrl(url: string): boolean {
    return extractPlaylistId(url) !== null
}

export function isVideoUrl(url: string): boolean {
    return extractVideoId(url) !== null
}

export function isValidYouTubeUrl(url: string): boolean {
    return extractVideoId(url) !== null
}

export function parseIso8601Duration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
    if (!match) return 0

    const hours = parseInt(match[1] || '0')
    const minutes = parseInt(match[2] || '0')
    const seconds = parseInt(match[3] || '0')

    return hours * 3600 + minutes * 60 + seconds
}
