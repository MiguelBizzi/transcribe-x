import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
    llmCurationDataSchema,
    qualityMetricsSchema,
} from './quality-metrics-schema'

const metrics = {
    originalWordCount: 100,
    processedWordCount: 80,
    noiseReductionRate: 0.2,
    lexicalDiversity: 0.5,
    avgSentenceLength: 12,
    hesitationCount: 1,
    repetitionCount: 2,
    timestampMarkersRemoved: 3,
    detectedLanguage: 'pt',
    processingDurationMs: 40,
    qualityScore: 0.7,
}

const curation = {
    coherence: 7,
    richness: 6,
    factuality: 8,
    overall: 7,
    recommendation: 'pretraining',
    rationale: 'Texto contínuo.',
    provider: 'openai',
    model: 'gpt-4o-mini',
}

describe('qualityMetricsSchema', () => {
    it('accepts a complete metrics payload', () => {
        assert.equal(qualityMetricsSchema.safeParse(metrics).success, true)
    })

    it('rejects a payload that is missing the quality score', () => {
        const { qualityScore: _score, ...rest } = metrics
        assert.equal(qualityMetricsSchema.safeParse(rest).success, false)
    })
})

describe('llmCurationDataSchema', () => {
    it('accepts the three recommendations', () => {
        for (const recommendation of [
            'sft_example',
            'pretraining',
            'discard',
        ]) {
            assert.equal(
                llmCurationDataSchema.safeParse({ ...curation, recommendation })
                    .success,
                true,
                recommendation,
            )
        }
    })

    it('rejects a recommendation outside the enum', () => {
        assert.equal(
            llmCurationDataSchema.safeParse({
                ...curation,
                recommendation: 'rewrite',
            }).success,
            false,
        )
    })

    it('rejects curation that is missing the rationale', () => {
        const { rationale: _rationale, ...rest } = curation
        assert.equal(llmCurationDataSchema.safeParse(rest).success, false)
    })
})
