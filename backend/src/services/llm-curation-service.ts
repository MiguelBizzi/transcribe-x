import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import type { Prisma } from '@/generated/prisma/client'
import {
    executePythonScript,
    resolveScriptPath,
} from '@/lib/python-runner'
import {
    assertCurationText,
    assertSingleCurationReady,
    curationScoreFromOverall,
    curationSourceText,
    curationTimeoutMs,
    shouldSkipPlaylistCuration,
    unavailableCurationMessage,
} from './curation-rules'

export interface LlmCurationData {
    coherence: number
    richness: number
    factuality: number
    overall: number
    rationale: string
    provider: string
    model: string
    chunkCount?: number
}

interface PythonCurationResponse {
    success: boolean
    curation?: LlmCurationData
    error?: string
}

export interface CurationResult {
    transcriptionId: string
    llmCurationScore: number
    llmCurationData: LlmCurationData
}

export class LlmCurationService {
    private scriptPath: string

    constructor() {
        this.scriptPath = resolveScriptPath('llm_curator.py')
    }

    async curateText(
        text: string,
        title: string,
        languageCode?: string | null,
    ): Promise<LlmCurationData> {
        assertCurationText(text)

        const response = await executePythonScript<
            {
                text: string
                title: string
                language_code: string | null
                provider: string
                openai_api_key?: string
                openai_model: string
                ollama_base_url: string
                ollama_model: string
            },
            PythonCurationResponse
        >(
            this.scriptPath,
            {
                text,
                title,
                language_code: languageCode || null,
                provider: env.CURATION_LLM_PROVIDER,
                openai_api_key: env.OPENAI_API_KEY,
                openai_model: env.OPENAI_MODEL,
                ollama_base_url: env.OLLAMA_BASE_URL,
                ollama_model: env.OLLAMA_MODEL,
            },
            { timeout: curationTimeoutMs(text) },
        )

        if (!response.success || !response.curation) {
            throw new Error(unavailableCurationMessage(response.error))
        }

        return response.curation
    }

    async curateTranscription(
        transcriptionId: string,
        userId: string,
    ): Promise<CurationResult> {
        const transcription = await prisma.transcription.findFirst({
            where: { id: transcriptionId, userId },
            select: {
                id: true,
                title: true,
                language: true,
                content: true,
                processedContent: true,
                deduplicationStatus: true,
            },
        })

        if (!transcription) {
            throw new Error('Transcription not found')
        }

        const text = curationSourceText(
            transcription.processedContent,
            transcription.content,
        )
        assertSingleCurationReady(transcription.deduplicationStatus, text)

        const curation = await this.curateText(
            text,
            transcription.title,
            transcription.language,
        )

        const llmCurationScore = curationScoreFromOverall(curation.overall)

        await prisma.transcription.update({
            where: { id: transcription.id },
            data: {
                llmCurationScore,
                llmCurationData: curation as unknown as Prisma.InputJsonValue,
            },
        })

        return {
            transcriptionId: transcription.id,
            llmCurationScore,
            llmCurationData: curation,
        }
    }

    async curatePlaylist(
        playlistId: string,
        userId: string,
    ): Promise<{ curated: number; skipped: number; failed: number }> {
        const playlist = await prisma.playlist.findFirst({
            where: { id: playlistId, userId },
            select: { id: true },
        })
        if (!playlist) {
            throw new Error('Playlist not found')
        }

        const transcriptions = await prisma.transcription.findMany({
            where: {
                playlistId,
                userId,
                status: 'COMPLETED',
            },
            select: {
                id: true,
                deduplicationStatus: true,
                llmCurationData: true,
            },
            orderBy: { videoIndex: 'asc' },
        })

        let curated = 0
        let skipped = 0
        let failed = 0

        for (const transcription of transcriptions) {
            if (
                shouldSkipPlaylistCuration(
                    transcription.deduplicationStatus,
                    transcription.llmCurationData,
                )
            ) {
                skipped += 1
                continue
            }

            try {
                await this.curateTranscription(transcription.id, userId)
                curated += 1
            } catch (error) {
                failed += 1
                console.error(
                    `Curation failed for transcription ${transcription.id}:`,
                    error instanceof Error ? error.message : error,
                )
            }
        }

        return { curated, skipped, failed }
    }
}

export const llmCurationService = new LlmCurationService()
