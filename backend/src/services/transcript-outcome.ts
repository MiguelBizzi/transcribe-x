import {
    RATE_LIMIT_MESSAGE,
    isRateLimitedResult,
    transcriptErrorMessage,
} from './transcript-errors'

export interface CaptionResult {
    success: boolean
    raw_text?: string
    word_count?: number
    language_code?: string
    is_generated?: boolean
    timestamps?: Array<{
        text: string
        start: number
        duration: number
    }> | null
    error?: string
    error_type?: string
}

export interface SingleVideoTranscriptOutcome {
    status: 'COMPLETED' | 'ERROR'
    content: string | null
    errorMessage: string | null
    storedWordCount: number | null
    language: string
    timestamps: CaptionResult['timestamps']
    isGenerated: boolean
}

export function singleVideoTranscriptOutcome(
    result: CaptionResult,
): SingleVideoTranscriptOutcome {
    if (result.success && result.raw_text && result.raw_text.trim() !== '') {
        const wordCount = result.word_count || 0
        return {
            status: 'COMPLETED',
            content: result.raw_text,
            errorMessage: null,
            storedWordCount: wordCount > 0 ? wordCount : null,
            language: result.language_code || 'en',
            timestamps: result.timestamps ?? null,
            isGenerated: Boolean(result.is_generated),
        }
    }

    return {
        status: 'ERROR',
        content: null,
        errorMessage: transcriptErrorMessage(result),
        storedWordCount: null,
        language: 'en',
        timestamps: null,
        isGenerated: false,
    }
}

export type PlaylistTranscriptPersistence =
    | {
          kind: 'completed'
          content: string
          wordCount: number
          language: string | undefined
          timestamps: CaptionResult['timestamps']
          isGenerated: boolean
      }
    | {
          kind: 'failed'
          errorMessage: string
          rateLimited: boolean
      }

export function playlistTranscriptPersistence(
    result: CaptionResult,
): PlaylistTranscriptPersistence {
    if (result.success && result.raw_text) {
        return {
            kind: 'completed',
            content: result.raw_text,
            wordCount: result.word_count || 0,
            language: result.language_code,
            timestamps: result.timestamps,
            isGenerated: Boolean(result.is_generated),
        }
    }

    const rateLimited = isRateLimitedResult(result)
    return {
        kind: 'failed',
        rateLimited,
        errorMessage: rateLimited
            ? RATE_LIMIT_MESSAGE
            : transcriptErrorMessage(result),
    }
}

export function playlistTranscriptException(): {
    errorMessage: string
    rateLimited: false
} {
    return {
        errorMessage: 'Falha ao obter a legenda deste vídeo.',
        rateLimited: false,
    }
}
