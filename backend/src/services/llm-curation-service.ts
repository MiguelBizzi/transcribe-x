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
    private timeout: number

    constructor() {
        this.scriptPath = resolveScriptPath('llm_curator.py')
        this.timeout = 120000
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
            { timeout: this.timeout },
        )

        if (!response.success || !response.curation) {
            throw new Error(response.error || 'LLM curation failed')
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
            },
        })

        if (!transcription) {
            throw new Error('Transcription not found')
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
}

export const llmCurationService = new LlmCurationService()
