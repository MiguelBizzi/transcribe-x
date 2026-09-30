import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import type { Prisma } from '@/generated/prisma/client'
import {
    executePythonScript,
    resolveScriptPath,
} from '@/lib/python-runner'
import type { LlmCurationData } from './llm-curation-service'
import { llmCurationService } from './llm-curation-service'
import {
    textQualityService,
    type QualityMetrics,
} from './text-quality-service'

export type RewriteMode = 'pretraining' | 'sft'

export interface RewritePair {
    instruction: string
    output: string
}

export interface RewriteData {
    mode: RewriteMode
    provider: string
    model: string
    chunkCount?: number
    pairCount?: number
    pairs?: RewritePair[]
}

interface PythonRewriteResponse {
    success: boolean
    rewrittenContent?: string
    rewriteMode?: RewriteMode
    rewriteData?: RewriteData
    error?: string
}

export interface RewriteResult {
    transcriptionId: string
    rewrittenContent: string
    rewriteMode: RewriteMode
    rewriteData: RewriteData
    rewrittenQualityMetrics: QualityMetrics | null
    rewrittenLlmCurationScore: number | null
    rewrittenLlmCurationData: LlmCurationData | null
}

export class LlmRewriteService {
    private scriptPath: string
    private timeout: number

    constructor() {
        this.scriptPath = resolveScriptPath('llm_rewriter.py')
        this.timeout = 180000
    }

    async rewriteTranscription(
        transcriptionId: string,
        userId: string,
        mode: RewriteMode,
    ): Promise<RewriteResult> {
        const transcription = await prisma.transcription.findFirst({
            where: { id: transcriptionId, userId },
            select: {
                id: true,
                title: true,
                language: true,
                content: true,
                processedContent: true,
                llmCurationData: true,
                rewrittenContent: true,
                deduplicationStatus: true,
            },
        })

        if (!transcription) {
            throw new Error('Transcription not found')
        }

        if (transcription.deduplicationStatus === 'duplicate') {
            throw new Error(
                'Vídeos marcados como duplicata não podem ser reescritos.',
            )
        }

        const curation = transcription.llmCurationData as LlmCurationData | null
        if (!curation) {
            throw new Error(
                'Execute a curadoria LLM antes da reescrita WRAP.',
            )
        }
        if (curation.recommendation === 'discard') {
            throw new Error(
                'This transcription was marked as discard and cannot be rewritten.',
            )
        }

        const text =
            transcription.processedContent?.trim() ||
            transcription.content?.trim() ||
            ''

        if (!text) {
            throw new Error('Transcription has no content to rewrite')
        }

        const response = await executePythonScript<
            {
                text: string
                title: string
                language_code: string | null
                mode: RewriteMode
                provider: string
                openai_api_key?: string
                openai_model: string
                ollama_base_url: string
                ollama_model: string
            },
            PythonRewriteResponse
        >(
            this.scriptPath,
            {
                text,
                title: transcription.title,
                language_code: transcription.language,
                mode,
                provider: env.CURATION_LLM_PROVIDER,
                openai_api_key: env.OPENAI_API_KEY,
                openai_model: env.OPENAI_MODEL,
                ollama_base_url: env.OLLAMA_BASE_URL,
                ollama_model: env.OLLAMA_MODEL,
            },
            { timeout: this.timeout },
        )

        if (
            !response.success ||
            !response.rewrittenContent ||
            !response.rewriteMode ||
            !response.rewriteData
        ) {
            throw new Error(
                response.error
                    ? `Provedor de LLM indisponível: ${response.error}`
                    : 'Provedor de LLM indisponível. Verifique a chave da API ou o Ollama local.',
            )
        }

        const rewrittenContent = response.rewrittenContent

        await prisma.transcription.update({
            where: { id: transcription.id },
            data: {
                rewrittenContent,
                rewriteMode: response.rewriteMode,
                rewriteData:
                    response.rewriteData as unknown as Prisma.InputJsonValue,
            },
        })

        const analysis = await textQualityService.analyzeText(
            rewrittenContent,
            transcription.language,
            text,
        )
        const rewrittenCuration = await llmCurationService.curateText(
            rewrittenContent,
            transcription.title,
            transcription.language,
        )
        const rewrittenLlmCurationScore = Number(
            (rewrittenCuration.overall / 10).toFixed(4),
        )

        await prisma.transcription.update({
            where: { id: transcription.id },
            data: {
                rewrittenQualityMetrics: analysis
                    ? (analysis.qualityMetrics as unknown as Prisma.InputJsonValue)
                    : undefined,
                rewrittenLlmCurationScore,
                rewrittenLlmCurationData:
                    rewrittenCuration as unknown as Prisma.InputJsonValue,
            },
        })

        return {
            transcriptionId: transcription.id,
            rewrittenContent,
            rewriteMode: response.rewriteMode,
            rewriteData: response.rewriteData,
            rewrittenQualityMetrics: analysis?.qualityMetrics ?? null,
            rewrittenLlmCurationScore,
            rewrittenLlmCurationData: rewrittenCuration,
        }
    }

    async rewritePlaylist(
        playlistId: string,
        userId: string,
        mode: RewriteMode,
    ): Promise<{ rewritten: number; skipped: number; failed: number }> {
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
                rewrittenContent: true,
            },
            orderBy: { videoIndex: 'asc' },
        })

        let rewritten = 0
        let skipped = 0
        let failed = 0

        for (const transcription of transcriptions) {
            const curation = transcription.llmCurationData as LlmCurationData | null
            if (
                transcription.deduplicationStatus === 'duplicate' ||
                !curation ||
                curation.recommendation === 'discard' ||
                transcription.rewrittenContent?.trim()
            ) {
                skipped += 1
                continue
            }

            try {
                await this.rewriteTranscription(transcription.id, userId, mode)
                rewritten += 1
            } catch {
                failed += 1
            }
        }

        return { rewritten, skipped, failed }
    }
}

export const llmRewriteService = new LlmRewriteService()
