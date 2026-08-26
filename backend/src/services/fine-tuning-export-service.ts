import { prisma } from '@/lib/prisma'
import type { LlmCurationData } from './llm-curation-service'
import type { QualityMetrics } from './text-quality-service'

export type FineTuningDataset = 'raw' | 'processed' | 'curated'
export type FineTuningFormat = 'jsonl' | 'csv' | 'json'
export type FineTuningScope = 'playlist' | 'user'

export interface FineTuningExportQuery {
    userId: string
    scope: FineTuningScope
    playlistId?: string
    dataset: FineTuningDataset
    format: FineTuningFormat
    includeDuplicates?: boolean
}

export interface FineTuningRecord {
    id: string
    title: string
    youtubeId: string
    language: string | null
    text: string
    dataset: FineTuningDataset
    qualityScore: number | null
    mtldScore: number | null
    mattrScore: number | null
    llmCurationScore: number | null
    recommendation: LlmCurationData['recommendation'] | null
    deduplicationStatus: string
}

function csvEscape(value: string | number | null): string {
    const text = value == null ? '' : String(value)
    if (/[",\n]/.test(text)) {
        return `"${text.replace(/"/g, '""')}"`
    }
    return text
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
        content: string
    }> {
        const includeDuplicates = Boolean(query.includeDuplicates)

        if (query.scope === 'playlist' && !query.playlistId) {
            throw new Error('playlistId is required when scope is playlist')
        }

        const transcriptions = await prisma.transcription.findMany({
            where: {
                userId: query.userId,
                ...(query.scope === 'playlist'
                    ? { playlistId: query.playlistId }
                    : {}),
            },
            orderBy: [{ playlistId: 'asc' }, { videoIndex: 'asc' }],
            select: {
                id: true,
                title: true,
                youtubeId: true,
                language: true,
                content: true,
                processedContent: true,
                qualityMetrics: true,
                mtldScore: true,
                mattrScore: true,
                llmCurationScore: true,
                llmCurationData: true,
                deduplicationStatus: true,
            },
        })

        let skippedDuplicates = 0
        let skippedDiscarded = 0
        const records: FineTuningRecord[] = []

        for (const transcription of transcriptions) {
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
                continue
            }

            const metrics = transcription.qualityMetrics as QualityMetrics | null

            records.push({
                id: transcription.id,
                title: transcription.title,
                youtubeId: transcription.youtubeId,
                language: transcription.language,
                text,
                dataset: query.dataset,
                qualityScore: metrics?.qualityScore ?? null,
                mtldScore: transcription.mtldScore,
                mattrScore: transcription.mattrScore,
                llmCurationScore: transcription.llmCurationScore,
                recommendation: curation?.recommendation ?? null,
                deduplicationStatus: transcription.deduplicationStatus,
            })
        }

        const slug =
            query.scope === 'playlist'
                ? `playlist-${query.playlistId}`
                : `user-${query.userId}`
        const filename = `${slug}-${query.dataset}.${query.format}`

        if (query.format === 'csv') {
            const header = [
                'id',
                'title',
                'youtubeId',
                'language',
                'dataset',
                'qualityScore',
                'mtldScore',
                'mattrScore',
                'llmCurationScore',
                'recommendation',
                'deduplicationStatus',
                'text',
            ]
            const rows = records.map((record) =>
                [
                    record.id,
                    record.title,
                    record.youtubeId,
                    record.language,
                    record.dataset,
                    record.qualityScore,
                    record.mtldScore,
                    record.mattrScore,
                    record.llmCurationScore,
                    record.recommendation,
                    record.deduplicationStatus,
                    record.text,
                ]
                    .map(csvEscape)
                    .join(','),
            )

            return {
                filename,
                mimeType: 'text/csv;charset=utf-8',
                recordCount: records.length,
                skippedDuplicates,
                skippedDiscarded,
                content: [header.join(','), ...rows].join('\n'),
            }
        }

        if (query.format === 'jsonl') {
            return {
                filename,
                mimeType: 'application/jsonl;charset=utf-8',
                recordCount: records.length,
                skippedDuplicates,
                skippedDiscarded,
                content: records
                    .map((record) => JSON.stringify(record))
                    .join('\n'),
            }
        }

        return {
            filename,
            mimeType: 'application/json;charset=utf-8',
            recordCount: records.length,
            skippedDuplicates,
            skippedDiscarded,
            content: JSON.stringify(records, null, 2),
        }
    }
}

export const fineTuningExportService = new FineTuningExportService()
