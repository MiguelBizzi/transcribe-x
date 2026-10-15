import { prisma } from '@/lib/prisma'
import {
    serializeDataset,
    type DatasetFormat,
    type DatasetRecord,
    type DatasetStage,
} from './dataset-serializer'
import {
    assembleExportRecords,
    assertExportScope,
    exportFilename,
} from './export-records'

export type FineTuningDataset = DatasetStage
export type FineTuningFormat = DatasetFormat
export type FineTuningScope = 'playlist' | 'user' | 'transcription'
export type FineTuningRecord = DatasetRecord

export interface FineTuningExportQuery {
    userId: string
    scope: FineTuningScope
    playlistId?: string
    transcriptionId?: string
    dataset: FineTuningDataset
    format: FineTuningFormat
    includeDuplicates?: boolean
}

export class FineTuningExportService {
    async export(query: FineTuningExportQuery): Promise<{
        filename: string
        mimeType: string
        recordCount: number
        skippedDuplicates: number
        skippedDiscarded: number
        skippedFailed: number
        content: string
    }> {
        assertExportScope(query)

        const transcriptions = await prisma.transcription.findMany({
            where: {
                userId: query.userId,
                ...(query.scope === 'playlist'
                    ? { playlistId: query.playlistId }
                    : {}),
                ...(query.scope === 'transcription'
                    ? { id: query.transcriptionId }
                    : {}),
            },
            orderBy: [{ playlistId: 'asc' }, { videoIndex: 'asc' }],
            select: {
                id: true,
                title: true,
                youtubeId: true,
                playlistId: true,
                language: true,
                content: true,
                processedContent: true,
                qualityMetrics: true,
                mtldScore: true,
                mattrScore: true,
                llmCurationScore: true,
                llmCurationData: true,
                deduplicationStatus: true,
                dedupGroupId: true,
                status: true,
            },
        })

        const assembled = assembleExportRecords(transcriptions, query)
        const serialized = serializeDataset(
            assembled.records,
            query.format,
            query.dataset,
        )

        return {
            filename: exportFilename(query),
            mimeType: serialized.mimeType,
            recordCount: assembled.records.length,
            skippedDuplicates: assembled.skippedDuplicates,
            skippedDiscarded: assembled.skippedDiscarded,
            skippedFailed: assembled.skippedFailed,
            content: serialized.content,
        }
    }
}

export const fineTuningExportService = new FineTuningExportService()
