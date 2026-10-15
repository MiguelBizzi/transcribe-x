import type { DatasetRecord, DatasetStage } from './dataset-serializer'

export interface ExportCuration {
    coherence: number
    richness: number
    factuality: number
    overall: number
    recommendation: string
    rationale: string
    provider: string
    model: string
    chunkCount?: number
}

export interface ExportQualityMetrics {
    qualityScore?: number | null
}

export interface ExportTranscription {
    id: string
    title: string
    youtubeId: string
    playlistId: string | null
    language: string | null
    content: string | null
    processedContent: string | null
    qualityMetrics: unknown
    mtldScore: number | null
    mattrScore: number | null
    llmCurationScore: number | null
    llmCurationData: unknown
    deduplicationStatus: string
    dedupGroupId: string | null
    status: string
}

export interface ExportAssemblyQuery {
    userId: string
    scope: 'playlist' | 'user' | 'transcription'
    playlistId?: string
    transcriptionId?: string
    dataset: DatasetStage
    format: string
    includeDuplicates?: boolean
}

export function assertExportScope(query: {
    scope: string
    playlistId?: string
    transcriptionId?: string
}): void {
    if (query.scope === 'playlist' && !query.playlistId) {
        throw new Error('playlistId is required when scope is playlist')
    }
    if (query.scope === 'transcription' && !query.transcriptionId) {
        throw new Error('transcriptionId is required when scope is transcription')
    }
}

export function exportFilename(query: ExportAssemblyQuery): string {
    const slug =
        query.scope === 'playlist'
            ? `playlist-${query.playlistId}`
            : query.scope === 'transcription'
              ? `transcription-${query.transcriptionId}`
              : `user-${query.userId}`
    return `${slug}-${query.dataset}.${query.format}`
}

function resolveText(
    dataset: DatasetStage,
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

export function assembleExportRecords(
    transcriptions: ExportTranscription[],
    query: ExportAssemblyQuery,
): {
    records: DatasetRecord[]
    skippedDuplicates: number
    skippedDiscarded: number
    skippedFailed: number
} {
    const includeDuplicates = Boolean(query.includeDuplicates)
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

        const curation = transcription.llmCurationData as ExportCuration | null
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

        const metrics = transcription.qualityMetrics as ExportQualityMetrics | null
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

    return { records, skippedDuplicates, skippedDiscarded, skippedFailed }
}
