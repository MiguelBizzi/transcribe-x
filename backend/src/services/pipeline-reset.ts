import { Prisma } from '@/generated/prisma/client'

export const downstreamResetData: Prisma.TranscriptionUpdateInput = {
    deduplicationStatus: 'pending',
    dedupGroupId: null,
    llmCurationScore: null,
    llmCurationData: Prisma.DbNull,
    rewrittenContent: null,
    rewriteMode: null,
    rewriteData: Prisma.DbNull,
    rewrittenQualityMetrics: Prisma.DbNull,
    rewrittenLlmCurationScore: null,
    rewrittenLlmCurationData: Prisma.DbNull,
}
