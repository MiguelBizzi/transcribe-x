import { transcriptionService } from './transcription-service'
import type { TranscriptResult } from './transcription-service'
import { isRateLimitedResult } from './transcript-errors'

export const INTER_VIDEO_DELAY_MS = 2_000
export const RATE_LIMIT_COOLDOWN_MS = 15_000
const RATE_LIMIT_BACKOFF_MS = [20_000, 40_000, 80_000]
export const PLAYLIST_RATE_LIMIT_BACKOFF_MS = [15_000]

export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function fetchTranscriptWithBackoff(
    videoId: string,
    options?: {
        backoffMs?: number[]
        onWait?: (delayMs: number) => Promise<void>
    },
): Promise<TranscriptResult> {
    const backoffMs = options?.backoffMs ?? RATE_LIMIT_BACKOFF_MS
    let result = await transcriptionService.getTranscriptById(videoId)

    for (const delayMs of backoffMs) {
        if (result.success || !isRateLimitedResult(result)) return result
        await options?.onWait?.(delayMs)
        await sleep(delayMs)
        result = await transcriptionService.getTranscriptById(videoId)
    }

    return result
}
