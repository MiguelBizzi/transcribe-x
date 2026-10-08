import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import {
    executePythonScript,
    resolveScriptPath,
} from '@/lib/python-runner'

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

const SENTENCE_RE = /(?<=[.!?])\s+/

function splitSentences(text: string): string[] {
    return text
        .split(SENTENCE_RE)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0)
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

        const source =
            transcription.processedContent?.trim() ||
            transcription.content?.trim() ||
            ''

        if (!source) {
            throw new Error('Transcription has no content to deduplicate')
        }

        const sentences = splitSentences(source)
        const segments = sentences.map((text, index) => ({
            id: `${transcription.id}:${index}`,
            text,
        }))

        const result = await this.runDeduplicator(segments)
        const duplicateIndexes = new Set(
            result.duplicates.map((duplicate) => {
                const [, index] = duplicate.id.split(':')
                return Number(index)
            }),
        )

        const keptSentences = sentences.filter(
            (_, index) => !duplicateIndexes.has(index),
        )
        const processedContent = keptSentences.join(' ')

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
            sentencesRemoved: duplicateIndexes.size,
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
        const segments = transcriptions
            .map((transcription) => ({
                id: transcription.id,
                text:
                    transcription.processedContent?.trim() ||
                    transcription.content?.trim() ||
                    '',
            }))
            .filter((segment) => segment.text.length > 0)

        const result = await this.runDeduplicator(segments)
        const duplicateById = new Map(
            result.duplicates.map((duplicate) => [duplicate.id, duplicate]),
        )
        const groupIdByMember = new Map<string, string>()

        for (const group of result.groups) {
            for (const member of group.members) {
                groupIdByMember.set(member.id, group.groupId)
            }
        }

        for (const transcription of transcriptions) {
            const duplicate = duplicateById.get(transcription.id)
            await prisma.transcription.update({
                where: { id: transcription.id },
                data: {
                    deduplicationStatus: duplicate ? 'duplicate' : 'kept',
                    dedupGroupId:
                        groupIdByMember.get(transcription.id) ??
                        transcription.id,
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

        if (!response.success || !response.stats) {
            throw new Error(response.error || 'Deduplication failed')
        }

        return {
            groups: response.groups ?? [],
            duplicates: response.duplicates ?? [],
            stats: response.stats,
        }
    }
}

export const textDedupService = new TextDedupService()
