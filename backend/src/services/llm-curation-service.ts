import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import type { Prisma } from '@/generated/prisma/client'
import {
    executePythonScript,
    resolveScriptPath,
} from '@/lib/python-runner'

export type CurationRecommendation = 'sft_example' | 'pretraining' | 'discard'

export interface LlmCurationData {
    coherence: number
    richness: number
    factuality: number
    overall: number
    recommendation: CurationRecommendation
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

    private timeoutForText(text: string): number {
        const estimatedChunks = Math.min(
            10,
            Math.max(1, Math.ceil(text.length / 6000)),
        )
        return Math.min(120000 + estimatedChunks * 90000, 900000)
    }

    async curateText(
        text: string,
        title: string,
        languageCode?: string | null,
    ): Promise<LlmCurationData> {
        if (!text.trim()) {
            throw new Error('Text is required for curation')
        }

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
            { timeout: this.timeoutForText(text) },
        )

        if (!response.success || !response.curation) {
            throw new Error(
                response.error
                    ? `Provedor de LLM indisponível: ${response.error}`
                    : 'Provedor de LLM indisponível. Verifique a chave da API ou o Ollama local.',
            )
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

        if (transcription.deduplicationStatus === 'pending') {
            throw new Error(
                'Remova ou marque duplicatas antes da curadoria LLM.',
            )
        }

        const text =
            transcription.processedContent?.trim() ||
            transcription.content?.trim() ||
            ''

        if (!text) {
            throw new Error('Transcription has no content to curate')
        }

        const curation = await this.curateText(
            text,
            transcription.title,
            transcription.language,
        )

        const llmCurationScore = Number((curation.overall / 10).toFixed(4))

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
                transcription.deduplicationStatus === 'pending' ||
                transcription.deduplicationStatus === 'duplicate' ||
                transcription.llmCurationData
            ) {
                skipped += 1
                continue
            }

            try {
                await this.curateTranscription(transcription.id, userId)
                curated += 1
            } catch {
                failed += 1
            }
        }

        return { curated, skipped, failed }
    }
}

export const llmCurationService = new LlmCurationService()
