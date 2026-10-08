import { Prisma } from '@/generated/prisma/client'

export const downstreamResetData: Prisma.TranscriptionUpdateInput = {
    deduplicationStatus: 'pending',
    dedupGroupId: null,
    llmCurationScore: null,
    llmCurationData: Prisma.DbNull,
}
