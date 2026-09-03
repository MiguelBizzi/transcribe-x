import { prisma } from '@/lib/prisma'
import type { LlmCurationData } from './llm-curation-service'
import type { QualityMetrics } from './text-quality-service'
import type { RewriteData, RewriteMode } from './llm-rewrite-service'

export type FineTuningDataset = 'raw' | 'processed' | 'curated' | 'rewritten'
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
    instruction?: string | null
    output?: string | null
    dataset: FineTuningDataset
    rewriteMode?: RewriteMode | null
    qualityScore: number | null
    mtldScore: number | null
    mattrScore: number | null
    llmCurationScore: number | null
    recommendation: LlmCurationData['recommendation'] | null
    deduplicationStatus: string
}

function csvEscape(value: string | number | null | undefined): string {
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
        rewrittenContent: string | null
    },
): string {
    if (dataset === 'raw') {
        return transcription.content?.trim() || ''
    }
    if (dataset === 'rewritten') {
        return transcription.rewrittenContent?.trim() || ''
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
                rewrittenContent: true,
                rewriteMode: true,
                rewriteData: true,
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
            if (query.dataset === 'curated' || query.dataset === 'rewritten') {
                if (query.dataset === 'curated' && !curation) {
                    continue
                }
                if (curation?.recommendation === 'discard') {
                    skippedDiscarded += 1
                    continue
                }
            }

            if (query.dataset === 'rewritten') {
                const rewriteData = transcription.rewriteData as RewriteData | null
                const rewriteMode = (transcription.rewriteMode ||
                    rewriteData?.mode ||
                    null) as RewriteMode | null

                if (rewriteMode === 'sft' && rewriteData?.pairs?.length) {
                    for (const pair of rewriteData.pairs) {
                        records.push({
                            id: transcription.id,
                            title: transcription.title,
                            youtubeId: transcription.youtubeId,
                            language: transcription.language,
                            text: pair.output,
                            instruction: pair.instruction,
                            output: pair.output,
                            dataset: query.dataset,
                            rewriteMode,
                            qualityScore: (
                                transcription.qualityMetrics as QualityMetrics | null
                            )?.qualityScore ?? null,
                            mtldScore: transcription.mtldScore,
                            mattrScore: transcription.mattrScore,
                            llmCurationScore: transcription.llmCurationScore,
                            recommendation: curation?.recommendation ?? null,
                            deduplicationStatus:
                                transcription.deduplicationStatus,
                        })
                    }
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
                rewriteMode: (transcription.rewriteMode as RewriteMode | null) ?? null,
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
                'rewriteMode',
                'qualityScore',
                'mtldScore',
                'mattrScore',
                'llmCurationScore',
                'recommendation',
                'deduplicationStatus',
                'instruction',
                'output',
                'text',
            ]
            const rows = records.map((record) =>
                [
                    record.id,
                    record.title,
                    record.youtubeId,
                    record.language,
                    record.dataset,
                    record.rewriteMode,
                    record.qualityScore,
                    record.mtldScore,
                    record.mattrScore,
                    record.llmCurationScore,
                    record.recommendation,
                    record.deduplicationStatus,
                    record.instruction,
                    record.output,
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
            const lines = records.map((record) => {
                if (query.dataset === 'rewritten' && record.instruction && record.output) {
                    return JSON.stringify({
                        instruction: record.instruction,
                        output: record.output,
                        id: record.id,
                        title: record.title,
                        youtubeId: record.youtubeId,
                        language: record.language,
                        rewriteMode: record.rewriteMode,
                    })
                }
                return JSON.stringify(record)
            })

            return {
                filename,
                mimeType: 'application/jsonl;charset=utf-8',
                recordCount: records.length,
                skippedDuplicates,
                skippedDiscarded,
                content: lines.join('\n'),
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
