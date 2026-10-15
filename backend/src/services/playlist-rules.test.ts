import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    RATE_LIMIT_CANCELLED_MESSAGE,
    RATE_LIMIT_MESSAGE,
} from './transcript-errors'
import {
    interruptedResumePlan,
    retryBatchDecision,
    rowsCancelledAfterRateLimit,
    singleRetryDecision,
    summarizePlaylist,
} from './playlist-rules'

describe('singleRetryDecision', () => {
    it('only retries a transcription that is in error', () => {
        const decision = singleRetryDecision({
            status: 'COMPLETED',
            errorMessage: null,
            playlistStillProcessing: false,
        })
        assert.equal(decision.outcome, 'rejected')
        if (decision.outcome === 'rejected') {
            assert.match(decision.message, /transcrição com erro/)
        }
    })

    it('refuses a video that was blocked by the YouTube limit', () => {
        const decision = singleRetryDecision({
            status: 'ERROR',
            errorMessage: RATE_LIMIT_MESSAGE,
            playlistStillProcessing: false,
        })
        assert.equal(decision.outcome, 'rejected')
        if (decision.outcome === 'rejected') {
            assert.match(decision.message, /não podem ser tentados de novo/)
        }
    })

    it('refuses a retry while the playlist is still processing', () => {
        const decision = singleRetryDecision({
            status: 'ERROR',
            errorMessage: 'Este vídeo não possui legendas disponíveis.',
            playlistStillProcessing: true,
        })
        assert.equal(decision.outcome, 'rejected')
        if (decision.outcome === 'rejected') {
            assert.match(decision.message, /ainda está em processamento/)
        }
    })

    it('starts a retry for an ordinary error', () => {
        assert.deepEqual(
            singleRetryDecision({
                status: 'ERROR',
                errorMessage: 'Este vídeo não possui legendas disponíveis.',
                playlistStillProcessing: false,
            }),
            { outcome: 'started' },
        )
    })
})

describe('retryBatchDecision', () => {
    it('rejects a batch whose remaining rows are all rate limited', () => {
        const decision = retryBatchDecision([
            { id: 'a', errorMessage: RATE_LIMIT_MESSAGE },
        ])
        assert.equal(decision.outcome, 'rejected')
        if (decision.outcome === 'rejected') {
            assert.match(decision.message, /não podem ser tentados de novo/)
        }
    })

    it('rejects an empty batch as nothing to retry', () => {
        const decision = retryBatchDecision([])
        assert.equal(decision.outcome, 'rejected')
        if (decision.outcome === 'rejected') {
            assert.match(decision.message, /Nenhum vídeo pendente/)
        }
    })

    it('counts every queried row, including ones that are not retried', () => {
        const decision = retryBatchDecision([
            { id: 'blocked', errorMessage: RATE_LIMIT_CANCELLED_MESSAGE },
            { id: 'retry', errorMessage: 'Este vídeo não está disponível.' },
            { id: 'processing', errorMessage: null },
        ])
        assert.equal(decision.outcome, 'started')
        if (decision.outcome === 'started') {
            assert.equal(decision.retried, 3)
            assert.deepEqual(
                decision.retryable.map((row) => row.id),
                ['retry', 'processing'],
            )
        }
    })
})

describe('rate-limit cancellation and resume', () => {
    it('cancels every row after the limited one with the cancellation message', () => {
        const cancelled = rowsCancelledAfterRateLimit(
            [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
            0,
        )
        assert.deepEqual(cancelled.ids, ['b', 'c'])
        assert.equal(cancelled.errorMessage, RATE_LIMIT_CANCELLED_MESSAGE)
    })

    it('cancels a resume when any in-progress row already hit the limit', () => {
        const plan = interruptedResumePlan([
            { id: 'blocked', errorMessage: RATE_LIMIT_MESSAGE },
            { id: 'later', errorMessage: null },
        ])
        assert.equal(plan.action, 'cancel')
        if (plan.action === 'cancel') {
            assert.deepEqual(plan.blockedIds, ['blocked'])
            assert.deepEqual(plan.pendingIds, ['later'])
            assert.equal(plan.blockedMessage, RATE_LIMIT_MESSAGE)
            assert.equal(plan.pendingMessage, RATE_LIMIT_CANCELLED_MESSAGE)
            assert.equal(plan.cancelledForRateLimit, true)
        }
    })

    it('resumes when no in-progress row is rate limited', () => {
        assert.deepEqual(
            interruptedResumePlan([
                { id: 'a', errorMessage: null },
            ]),
            { action: 'resume' },
        )
    })
})

describe('summarizePlaylist', () => {
    it('stays processing while any item is still processing and counts only completed words', () => {
        const summary = summarizePlaylist([
            { status: 'PROCESSING', wordCount: 99 },
            { status: 'COMPLETED', wordCount: 10 },
            { status: 'ERROR', wordCount: 4 },
            { status: 'COMPLETED', wordCount: null },
        ])
        assert.equal(summary.status, 'PROCESSING')
        assert.equal(summary.errorMessage, null)
        assert.equal(summary.completedAt, null)
        assert.equal(summary.totalWordCount, 10)
    })

    it('is an error when nothing completed', () => {
        const summary = summarizePlaylist([
            { status: 'ERROR', wordCount: 0 },
            { status: 'ERROR', wordCount: 0 },
        ])
        assert.equal(summary.status, 'ERROR')
        assert.equal(
            summary.errorMessage,
            '2 vídeos não puderam ser transcritos',
        )
        assert.equal(summary.completedAt, 'now')
    })

    it('completes when at least one video succeeded, and still reports the failures', () => {
        const summary = summarizePlaylist([
            { status: 'COMPLETED', wordCount: 5 },
            { status: 'ERROR', wordCount: 0 },
        ])
        assert.equal(summary.status, 'COMPLETED')
        assert.equal(
            summary.errorMessage,
            '1 vídeos não puderam ser transcritos',
        )
        assert.equal(summary.totalWordCount, 5)
    })

    it('clears the error message when every video completed', () => {
        const summary = summarizePlaylist([
            { status: 'COMPLETED', wordCount: 3 },
            { status: 'COMPLETED', wordCount: 4 },
        ])
        assert.equal(summary.status, 'COMPLETED')
        assert.equal(summary.errorMessage, null)
        assert.equal(summary.totalWordCount, 7)
    })

    it('uses the rate-limit message when the batch was cancelled for that reason', () => {
        const summary = summarizePlaylist(
            [
                { status: 'COMPLETED', wordCount: 3 },
                { status: 'ERROR', wordCount: 0 },
            ],
            true,
        )
        assert.equal(summary.errorMessage, RATE_LIMIT_MESSAGE)
    })
})
