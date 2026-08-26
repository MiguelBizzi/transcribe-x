import { z } from 'zod'

export const qualityMetricsSchema = z.object({
    originalWordCount: z.number(),
    processedWordCount: z.number(),
    noiseReductionRate: z.number(),
    lexicalDiversity: z.number(),
    mtldScore: z.number().optional(),
    mattrScore: z.number().optional(),
    avgSentenceLength: z.number(),
    hesitationCount: z.number(),
    repetitionCount: z.number(),
    timestampMarkersRemoved: z.number(),
    detectedLanguage: z.string(),
    processingDurationMs: z.number(),
    qualityScore: z.number(),
})

export const llmCurationDataSchema = z.object({
    coherence: z.number(),
    richness: z.number(),
    factuality: z.number(),
    overall: z.number(),
    recommendation: z.enum(['sft_example', 'pretraining', 'discard']),
    rationale: z.string(),
    provider: z.string(),
    model: z.string(),
})
