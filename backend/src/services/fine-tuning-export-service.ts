import { prisma } from '@/lib/prisma'
import type { LlmCurationData } from './llm-curation-service'
import type { QualityMetrics } from './text-quality-service'
import {
    serializeDataset,
    type DatasetFormat,
    type DatasetRecord,
    type DatasetStage,
} from './dataset-serializer'

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

function resolveText(
    dataset: FineTuningDataset,
    transcription: {
        content: string | null
        processedContent: string | null
    },
): string {
    if (dataset === 'raw') {
        return transcription.content?.trim() || ''
    }
    return (
        transcription.processedContent?.trim() ||
        transcription.content?.trim() ||
        ''
    )
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
        const includeDuplicates = Boolean(query.includeDuplicates)

        if (query.scope === 'playlist' && !query.playlistId) {
            throw new Error('playlistId is required when scope is playlist')
        }
        if (query.scope === 'transcription' && !query.transcriptionId) {
            throw new Error(
                'transcriptionId is required when scope is transcription',
            )
        }

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

        let skippedDuplicates = 0
        let skippedDiscarded = 0
        let skippedFailed = 0
        const records: DatasetRecord[] = []

        for (const transcription of transcriptions) {
            if (transcription.status === 'ERROR') {
                skippedFailed += 1
                continue
            }

            if (
                !includeDuplicates &&
                transcription.deduplicationStatus === 'duplicate'
            ) {
                skippedDuplicates += 1
                continue
            }

            const curation = transcription.llmCurationData as LlmCurationData | null
            if (query.dataset === 'curated') {
                if (!curation) {
                    continue
                }
                if (curation.recommendation === 'discard') {
                    skippedDiscarded += 1
                    continue
                }
            }

            const text = resolveText(query.dataset, transcription)
            if (!text) {
                skippedFailed += 1
                continue
            }

            const metrics = transcription.qualityMetrics as QualityMetrics | null
            records.push({
                id: transcription.id,
                title: transcription.title,
                youtubeId: transcription.youtubeId,
                playlistId: transcription.playlistId,
                language: transcription.language,
                dataset: query.dataset,
                qualityScore: metrics?.qualityScore ?? null,
                mtldScore: transcription.mtldScore,
                mattrScore: transcription.mattrScore,
                llmCurationScore: transcription.llmCurationScore,
                recommendation: curation?.recommendation ?? null,
                coherence: curation?.coherence ?? null,
                richness: curation?.richness ?? null,
                factuality: curation?.factuality ?? null,
                curationOverall: curation?.overall ?? null,
                curationRationale: curation?.rationale ?? null,
                curationProvider: curation?.provider ?? null,
                curationModel: curation?.model ?? null,
                curationChunkCount: curation?.chunkCount ?? null,
                deduplicationStatus: transcription.deduplicationStatus,
                dedupGroupId: transcription.dedupGroupId,
                text,
            })
        }

        const slug =
            query.scope === 'playlist'
                ? `playlist-${query.playlistId}`
                : query.scope === 'transcription'
                  ? `transcription-${query.transcriptionId}`
                  : `user-${query.userId}`
        const serialized = serializeDataset(records, query.format, query.dataset)

        return {
            filename: `${slug}-${query.dataset}.${query.format}`,
            mimeType: serialized.mimeType,
            recordCount: records.length,
            skippedDuplicates,
            skippedDiscarded,
            skippedFailed,
            content: serialized.content,
        }
    }
}

export const fineTuningExportService = new FineTuningExportService()
