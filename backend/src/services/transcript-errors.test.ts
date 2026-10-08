import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    isRateLimitedResult,
    transcriptErrorMessage,
} from './transcript-errors'

describe('transcript error messages', () => {
    it('treats an IP block as a temporary limit', () => {
        const result = {
            error_type: 'rate_limited',
            error: 'YouTube is temporarily limiting caption requests',
        }

        assert.equal(isRateLimitedResult(result), true)
        assert.equal(
            transcriptErrorMessage(result),
            'O YouTube limitou temporariamente o acesso às legendas. Tente novamente em alguns minutos.',
        )
    })

    it('treats a script timeout as a temporary limit', () => {
        const result = {
            error_type: 'execution_error',
            error: 'Python script execution timeout',
        }

        assert.equal(isRateLimitedResult(result), true)
        assert.match(transcriptErrorMessage(result), /limitou temporariamente/)
    })

    it('keeps a missing caption distinct from a block', () => {
        const result = {
            error_type: 'no_transcript',
            error: 'No transcript available for this video',
        }

        assert.equal(isRateLimitedResult(result), false)
        assert.equal(
            transcriptErrorMessage(result),
            'Este vídeo não possui legendas disponíveis.',
        )
    })

    it('describes an unavailable video without the raw exception', () => {
        const result = {
            error_type: 'video_unavailable',
            error: 'The video is no longer available',
        }

        assert.equal(
            transcriptErrorMessage(result),
            'Este vídeo não está disponível.',
        )
    })
})
