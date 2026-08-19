import { z } from 'zod'

export const qualityMetricsSchema = z.object({
    originalWordCount: z.number(),
    processedWordCount: z.number(),
    noiseReductionRate: z.number(),
    lexicalDiversity: z.number(),
    avgSentenceLength: z.number(),
    hesitationCount: z.number(),
    repetitionCount: z.number(),
    timestampMarkersRemoved: z.number(),
    detectedLanguage: z.string(),
    processingDurationMs: z.number(),
    qualityScore: z.number(),
})
