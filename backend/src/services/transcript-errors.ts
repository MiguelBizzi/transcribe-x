import type { TranscriptResult } from './transcription-service'

export const RATE_LIMIT_MESSAGE =
    'O YouTube limitou o acesso às legendas. O processamento foi cancelado.'

export const RATE_LIMIT_CANCELLED_MESSAGE =
    'Processamento cancelado porque o YouTube limitou o acesso às legendas.'

export function isRateLimitErrorMessage(message?: string | null): boolean {
    if (!message) return false
    const normalized = message.toLowerCase()
    return (
        normalized.includes('limitou o acesso às legendas') ||
        normalized.includes('limitou temporariamente o acesso às legendas')
    )
}

export function isRateLimitedResult(
    result: Pick<TranscriptResult, 'error' | 'error_type'>,
): boolean {
    if (result.error_type === 'rate_limited') return true

    const error = result.error?.toLowerCase() ?? ''
    if (result.error_type === 'execution_error' && error.includes('timeout')) {
        return true
    }

    return (
        error.includes('ipblocked') ||
        error.includes('requestblocked') ||
        error.includes('blocking requests from your ip')
    )
}

export function transcriptErrorMessage(
    result: Pick<TranscriptResult, 'error' | 'error_type'>,
): string {
    if (isRateLimitedResult(result)) return RATE_LIMIT_MESSAGE

    switch (result.error_type) {
        case 'no_transcript':
            return 'Este vídeo não possui legendas disponíveis.'
        case 'video_unavailable':
            return 'Este vídeo não está disponível.'
        case 'invalid_video_id':
        case 'invalid_url':
            return 'Identificador de vídeo inválido.'
        default:
            return 'Falha ao obter a legenda deste vídeo.'
    }
}
