import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import {
    executePythonScript,
    resolveScriptPath,
} from '@/lib/python-runner'
import {
    documentDedupAssignments,
    documentDedupSegments,
    rebuildDeduplicatedText,
    requireDedupPayload,
    requireVideoDedupSource,
    sentenceSegments,
    splitSentences,
} from './dedup-rules'

export type DedupScope = 'playlist' | 'video' | 'channel'

export interface DedupSegment {
    id: string
    text: string
}

export interface DedupDuplicate {
    id: string
    canonicalId: string
    kind: 'exact' | 'near'
}

export interface DedupGroup {
    groupId: string
    canonicalId: string
    members: Array<{ id: string; kind: 'canonical' | 'exact' | 'near' }>
}

export interface DedupStats {
    inputCount: number
    comparedCount: number
    exactDuplicateCount: number
    nearDuplicateCount: number
    keptCount: number
    groupCount: number
}

interface PythonDedupResponse {
    success: boolean
    groups?: DedupGroup[]
    duplicates?: DedupDuplicate[]
    stats?: DedupStats
    error?: string
}

export interface DedupResult {
    scope: DedupScope
    stats: DedupStats
    groups: DedupGroup[]
    keptCount: number
    duplicateCount: number
    sentencesRemoved?: number
}

export class TextDedupService {
    private scriptPath: string
    private timeout: number

    constructor() {
        this.scriptPath = resolveScriptPath('deduplicator.py')
        this.timeout = 60000
    }

    async deduplicatePlaylist(
        playlistId: string,
        userId: string,
    ): Promise<DedupResult> {
        const playlist = await prisma.playlist.findFirst({
            where: { id: playlistId, userId },
            select: { id: true },
        })

        if (!playlist) {
            throw new Error('Playlist not found')
        }

        const transcriptions = await prisma.transcription.findMany({
            where: { playlistId, userId },
            select: {
                id: true,
                content: true,
                processedContent: true,
            },
            orderBy: { videoIndex: 'asc' },
        })

        return this.deduplicateDocuments(transcriptions, 'playlist')
    }

    async deduplicateChannel(
        channelId: string,
        userId: string,
    ): Promise<DedupResult> {
        const transcriptions = await prisma.transcription.findMany({
            where: {
                userId,
                playlist: { channelId },
            },
            select: {
                id: true,
                content: true,
                processedContent: true,
            },
            orderBy: { createdAt: 'asc' },
        })

        if (transcriptions.length === 0) {
            throw new Error('No transcriptions found for this channel')
        }

        return this.deduplicateDocuments(transcriptions, 'channel')
    }

    async deduplicateVideo(
        transcriptionId: string,
        userId: string,
    ): Promise<DedupResult> {
        const transcription = await prisma.transcription.findFirst({
            where: { id: transcriptionId, userId },
            select: {
                id: true,
                content: true,
                processedContent: true,
            },
        })

        if (!transcription) {
            throw new Error('Transcription not found')
        }

        const source = requireVideoDedupSource(transcription)
        const sentences = splitSentences(source)
        const segments = sentenceSegments(transcription.id, sentences)

        const result = await this.runDeduplicator(segments)
        const rebuilt = rebuildDeduplicatedText(sentences, result.duplicates)
        const processedContent = rebuilt.processedContent

        await prisma.transcription.update({
            where: { id: transcription.id },
            data: {
                processedContent,
                isProcessed: true,
                deduplicationStatus: 'kept',
                dedupGroupId: transcription.id,
            },
        })

        return {
            scope: 'video',
            stats: result.stats,
            groups: result.groups,
            keptCount: 1,
            duplicateCount: 0,
            sentencesRemoved: rebuilt.sentencesRemoved,
        }
    }

    private async deduplicateDocuments(
        transcriptions: Array<{
            id: string
            content: string | null
            processedContent: string | null
        }>,
        scope: Exclude<DedupScope, 'video'>,
    ): Promise<DedupResult> {
        const segments = documentDedupSegments(transcriptions)
        const result = await this.runDeduplicator(segments)
        const assignments = documentDedupAssignments(transcriptions, result)

        for (const assignment of assignments) {
            await prisma.transcription.update({
                where: { id: assignment.id },
                data: {
                    deduplicationStatus: assignment.deduplicationStatus,
                    dedupGroupId: assignment.dedupGroupId,
                },
            })
        }

        return {
            scope,
            stats: result.stats,
            groups: result.groups,
            keptCount: result.stats.keptCount,
            duplicateCount:
                result.stats.exactDuplicateCount +
                result.stats.nearDuplicateCount,
        }
    }

    private async runDeduplicator(segments: DedupSegment[]): Promise<{
        groups: DedupGroup[]
        duplicates: DedupDuplicate[]
        stats: DedupStats
    }> {
        const response = await executePythonScript<
            {
                segments: DedupSegment[]
                jaccard_threshold: number
                ngram_size: number
            },
            PythonDedupResponse
        >(
            this.scriptPath,
            {
                segments,
                jaccard_threshold: env.DEDUP_JACCARD_THRESHOLD,
                ngram_size: env.DEDUP_NGRAM_SIZE,
            },
            { timeout: this.timeout },
        )

        return requireDedupPayload(response)
    }
}

export const textDedupService = new TextDedupService()
