import {
    RATE_LIMIT_CANCELLED_MESSAGE,
    RATE_LIMIT_MESSAGE,
    isRateLimitErrorMessage,
} from './transcript-errors'

const NOT_ERROR_MESSAGE =
    'Só é possível tentar novamente uma transcrição com erro.'
const RATE_LIMIT_RETRY_MESSAGE =
    'Vídeos bloqueados pelo limite do YouTube não podem ser tentados de novo.'
const PLAYLIST_PROCESSING_MESSAGE = 'A playlist ainda está em processamento.'
const NOTHING_TO_RETRY_MESSAGE = 'Nenhum vídeo pendente para tentar novamente.'

export function singleRetryDecision(input: {
    status: string
    errorMessage?: string | null
    playlistStillProcessing: boolean
}): { outcome: 'started' } | { outcome: 'rejected'; message: string } {
    if (input.status !== 'ERROR') {
        return { outcome: 'rejected', message: NOT_ERROR_MESSAGE }
    }

    if (isRateLimitErrorMessage(input.errorMessage)) {
        return { outcome: 'rejected', message: RATE_LIMIT_RETRY_MESSAGE }
    }

    if (input.playlistStillProcessing) {
        return { outcome: 'rejected', message: PLAYLIST_PROCESSING_MESSAGE }
    }

    return { outcome: 'started' }
}

export function retryBatchDecision<T extends { errorMessage?: string | null }>(
    queried: T[],
):
    | { outcome: 'rejected'; message: string }
    | { outcome: 'started'; retried: number; retryable: T[] } {
    const retryable = queried.filter(
        (item) => !isRateLimitErrorMessage(item.errorMessage),
    )

    if (retryable.length === 0) {
        return {
            outcome: 'rejected',
            message:
                queried.length > 0
                    ? RATE_LIMIT_RETRY_MESSAGE
                    : NOTHING_TO_RETRY_MESSAGE,
        }
    }

    return {
        outcome: 'started',
        retried: queried.length,
        retryable,
    }
}

export function rowsCancelledAfterRateLimit<T extends { id: string }>(
    rows: T[],
    rateLimitedIndex: number,
): { ids: string[]; errorMessage: string } {
    return {
        ids: rows.slice(rateLimitedIndex + 1).map((item) => item.id),
        errorMessage: RATE_LIMIT_CANCELLED_MESSAGE,
    }
}

export function interruptedResumePlan<
    T extends { id: string; errorMessage?: string | null },
>(
    rows: T[],
):
    | { action: 'resume' }
    | {
          action: 'cancel'
          blockedIds: string[]
          pendingIds: string[]
          blockedMessage: string
          pendingMessage: string
          cancelledForRateLimit: true
      } {
    const blocked = rows.filter((row) =>
        isRateLimitErrorMessage(row.errorMessage),
    )
    if (blocked.length === 0) {
        return { action: 'resume' }
    }

    const pending = rows.filter(
        (row) => !isRateLimitErrorMessage(row.errorMessage),
    )
    return {
        action: 'cancel',
        blockedIds: blocked.map((row) => row.id),
        pendingIds: pending.map((row) => row.id),
        blockedMessage: RATE_LIMIT_MESSAGE,
        pendingMessage: RATE_LIMIT_CANCELLED_MESSAGE,
        cancelledForRateLimit: true,
    }
}

export interface PlaylistSummaryInput {
    status: string
    wordCount: number | null
}

export interface PlaylistSummary {
    status: 'PROCESSING' | 'COMPLETED' | 'ERROR'
    errorMessage: string | null
    totalWordCount: number
    completedAt: null | 'now'
}

export function summarizePlaylist(
    transcriptions: PlaylistSummaryInput[],
    cancelledForRateLimit = false,
): PlaylistSummary {
    const failed = transcriptions.filter((item) => item.status === 'ERROR').length
    const processing = transcriptions.filter(
        (item) => item.status === 'PROCESSING',
    ).length
    const completed = transcriptions.filter(
        (item) => item.status === 'COMPLETED',
    ).length
    const totalWordCount = transcriptions.reduce(
        (sum, item) =>
            item.status === 'COMPLETED' ? sum + (item.wordCount ?? 0) : sum,
        0,
    )

    if (processing > 0) {
        return {
            status: 'PROCESSING',
            errorMessage: null,
            totalWordCount,
            completedAt: null,
        }
    }

    return {
        status: failed > 0 && completed === 0 ? 'ERROR' : 'COMPLETED',
        errorMessage: cancelledForRateLimit
            ? RATE_LIMIT_MESSAGE
            : failed > 0
              ? `${failed} vídeos não puderam ser transcritos`
              : null,
        totalWordCount,
        completedAt: 'now',
    }
}
