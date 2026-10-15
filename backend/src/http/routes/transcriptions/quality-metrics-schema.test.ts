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
    it('drops the recommendation older curations still carry', () => {
        const parsed = llmCurationDataSchema.safeParse({
            ...curation,
            recommendation: 'discard',
        })
        assert.equal(parsed.success, true)
        assert.equal(parsed.success && 'recommendation' in parsed.data, false)
    })

    it('rejects curation that is missing the rationale', () => {
        const { rationale: _rationale, ...rest } = curation
        assert.equal(llmCurationDataSchema.safeParse(rest).success, false)
    })
})
