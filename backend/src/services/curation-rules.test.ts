import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    assertCurationText,
    assertSingleCurationReady,
    curationScoreFromOverall,
    curationSourceText,
    curationTimeoutMs,
    shouldSkipPlaylistCuration,
    unavailableCurationMessage,
} from './curation-rules'

describe('curation source and guards', () => {
    it('prefers processed text and trims it', () => {
        assert.equal(curationSourceText('  limpo  ', 'bruto'), 'limpo')
        assert.equal(curationSourceText('   ', ' bruto '), 'bruto')
        assert.equal(curationSourceText(null, '  '), '')
    })

    it('refuses blank text before calling the provider', () => {
        assert.throws(
            () => assertCurationText('   '),
            /Text is required for curation/,
        )
    })

    it('blocks a single item that is still pending, and a single item with no text', () => {
        assert.throws(
            () => assertSingleCurationReady('pending', 'texto'),
            /Remova ou marque duplicatas antes da curadoria LLM/,
        )
        assert.throws(
            () => assertSingleCurationReady('kept', ''),
            /Transcription has no content to curate/,
        )
    })

    it('allows a single duplicate through this guard', () => {
        assert.doesNotThrow(() => assertSingleCurationReady('duplicate', 'texto'))
    })
})

describe('playlist curation skip', () => {
    it('skips pending, duplicate, and already curated items', () => {
        assert.equal(shouldSkipPlaylistCuration('pending', null), true)
        assert.equal(shouldSkipPlaylistCuration('duplicate', null), true)
        assert.equal(shouldSkipPlaylistCuration('kept', { overall: 7 }), true)
    })

    it('keeps an item that is ready and not curated yet', () => {
        assert.equal(shouldSkipPlaylistCuration('kept', null), false)
    })
})

describe('curation score and timeout', () => {
    it('stores overall divided by 10 with four decimal places', () => {
        assert.equal(curationScoreFromOverall(7.5), 0.75)
        assert.equal(curationScoreFromOverall(7.12345), 0.7123)
        assert.equal(curationScoreFromOverall(10), 1)
    })

    it('grows the timeout with text length and caps chunks and the total', () => {
        assert.equal(curationTimeoutMs(''), 210000)
        assert.equal(curationTimeoutMs('a'.repeat(6000)), 210000)
        assert.equal(curationTimeoutMs('a'.repeat(6001)), 300000)
        assert.equal(curationTimeoutMs('a'.repeat(60_000)), 900000)
        assert.equal(curationTimeoutMs('a'.repeat(120_000)), 900000)
    })
})

describe('unavailableCurationMessage', () => {
    it('prefixes the provider error when one is present', () => {
        assert.match(unavailableCurationMessage('timeout'), /timeout/)
    })

    it('asks for the key or local Ollama when the provider returns nothing', () => {
        assert.match(unavailableCurationMessage(), /Ollama/)
    })
})
