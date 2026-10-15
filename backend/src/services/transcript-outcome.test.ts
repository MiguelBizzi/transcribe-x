import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { RATE_LIMIT_MESSAGE } from './transcript-errors'
import {
    playlistTranscriptException,
    playlistTranscriptPersistence,
    singleVideoTranscriptOutcome,
} from './transcript-outcome'

describe('singleVideoTranscriptOutcome', () => {
    it('completes only when the caption has non-blank text', () => {
        const outcome = singleVideoTranscriptOutcome({
            success: true,
            raw_text: '  aula  ',
            word_count: 12,
            language_code: 'pt',
            is_generated: true,
            timestamps: [{ text: 'aula', start: 0, duration: 1 }],
        })
        assert.equal(outcome.status, 'COMPLETED')
        assert.equal(outcome.content, '  aula  ')
        assert.equal(outcome.storedWordCount, 12)
        assert.equal(outcome.language, 'pt')
        assert.equal(outcome.isGenerated, true)
        assert.equal(outcome.errorMessage, null)
    })

    it('stores a null word count when the caption reports zero words', () => {
        const outcome = singleVideoTranscriptOutcome({
            success: true,
            raw_text: 'oi',
            word_count: 0,
        })
        assert.equal(outcome.storedWordCount, null)
        assert.equal(outcome.language, 'en')
    })

    it('rejects whitespace-only captions as an error and drops timestamps', () => {
        const outcome = singleVideoTranscriptOutcome({
            success: true,
            raw_text: '   ',
            timestamps: [{ text: ' ', start: 0, duration: 1 }],
            error_type: 'no_transcript',
        })
        assert.equal(outcome.status, 'ERROR')
        assert.equal(outcome.content, null)
        assert.equal(outcome.timestamps, null)
        assert.equal(
            outcome.errorMessage,
            'Este vídeo não possui legendas disponíveis.',
        )
    })
})

describe('playlistTranscriptPersistence', () => {
    it('accepts a whitespace caption as completed text', () => {
        const outcome = playlistTranscriptPersistence({
            success: true,
            raw_text: '   ',
            word_count: 0,
            language_code: 'pt',
        })
        assert.equal(outcome.kind, 'completed')
        if (outcome.kind === 'completed') {
            assert.equal(outcome.content, '   ')
            assert.equal(outcome.wordCount, 0)
            assert.equal(outcome.language, 'pt')
        }
    })

    it('uses the rate-limit message when the fetch was limited', () => {
        const outcome = playlistTranscriptPersistence({
            success: false,
            error_type: 'rate_limited',
            error: 'IpBlocked',
        })
        assert.equal(outcome.kind, 'failed')
        if (outcome.kind === 'failed') {
            assert.equal(outcome.rateLimited, true)
            assert.equal(outcome.errorMessage, RATE_LIMIT_MESSAGE)
        }
    })

    it('does not mark a thrown fetch as a rate limit', () => {
        const failure = playlistTranscriptException()
        assert.equal(failure.rateLimited, false)
        assert.equal(failure.errorMessage, 'Falha ao obter a legenda deste vídeo.')
    })
})
