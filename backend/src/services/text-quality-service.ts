import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { env } from '@/lib/env'
import type { Prisma } from '@/generated/prisma/client'
import { downstreamResetData } from './pipeline-reset'

export interface QualityMetrics {
    originalWordCount: number
    processedWordCount: number
    noiseReductionRate: number
    lexicalDiversity: number
    mtldScore: number | null
    mattrScore: number
    avgSentenceLength: number
    hesitationCount: number
    repetitionCount: number
    timestampMarkersRemoved: number
    detectedLanguage: string
    processingDurationMs: number
    artifactRate: number
    residualCommaCount: number
    punctuationRestored: boolean
    qualityScore: number
}

export interface QualityProcessResult {
    processedText: string
    qualityMetrics: QualityMetrics
}

interface PythonProcessResponse {
    success: boolean
    processedText?: string
    qualityMetrics?: QualityMetrics
    error?: string
}

export interface TextQualityServiceOptions {
    pythonPath?: string
    scriptPath?: string
    timeout?: number
}

// Spellchecking auto-generated captions scales with vocabulary, not just
// length: a 2k-word Portuguese transcript took 16s before the correction
// cache. Punctuation restoration adds LLM round trips (parallel, 250 words
// each). Leave room for slow machines; the timeout only guards a hung script.
const DEFAULT_TIMEOUT_MS = 180000

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
}

export class TextQualityService {
    private pythonPath: string
    private scriptPath: string
    private timeout: number

    constructor(options: TextQualityServiceOptions = {}) {
        const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3')
        this.pythonPath =
            options.pythonPath ||
            (existsSync(venvPython) ? venvPython : 'python3')
        this.scriptPath =
            options.scriptPath ||
            path.join(process.cwd(), 'scripts', 'text_processor.py')
        this.timeout = options.timeout || DEFAULT_TIMEOUT_MS
    }

    async processText(
        rawText: string,
        languageCode?: string | null,
        isGenerated = false,
    ): Promise<QualityProcessResult | null> {
        if (!rawText.trim()) {
            return null
        }

        const result = await this.runProcess(rawText, languageCode, isGenerated)
        if (result || !isGenerated) {
            return result
        }

        // Spellchecking is an optional refinement of auto-generated captions.
        // Cleaning and metrics are worth keeping when it is what failed.
        console.warn(
            'Text processing with spellcheck failed, retrying without it',
        )
        return this.runProcess(rawText, languageCode, false)
    }

    private async runProcess(
        rawText: string,
        languageCode: string | null | undefined,
        isGenerated: boolean,
    ): Promise<QualityProcessResult | null> {
        try {
            const result = await this.executePythonScript({
                text: rawText,
                language_code: languageCode || null,
                is_generated: isGenerated,
                ...this.punctuationPayload(),
            })

            if (
                !result.success ||
                !result.processedText ||
                !result.qualityMetrics
            ) {
                console.error(
                    `Text processing failed: ${result.error ?? 'empty result'}`,
                )
                return null
            }

            return {
                processedText: result.processedText,
                qualityMetrics: result.qualityMetrics,
            }
        } catch (error) {
            console.error(`Text processing failed: ${errorMessage(error)}`)
            return null
        }
    }

    async analyzeText(
        text: string,
        languageCode?: string | null,
        referenceText?: string | null,
    ): Promise<QualityProcessResult | null> {
        if (!text.trim()) {
            return null
        }

        try {
            const result = await this.executePythonScript({
                text,
                language_code: languageCode || null,
                is_generated: false,
                analyze_only: true,
                reference_text: referenceText || null,
            })

            if (
                !result.success ||
                !result.processedText ||
                !result.qualityMetrics
            ) {
                return null
            }

            return {
                processedText: result.processedText,
                qualityMetrics: result.qualityMetrics,
            }
        } catch (error) {
            console.error(`Text analysis failed: ${errorMessage(error)}`)
            return null
        }
    }

    async processAndPersist(
        transcriptionId: string,
        rawText: string | null | undefined,
        languageCode?: string | null,
        isGenerated = false,
        options: { resetDownstream?: boolean } = {},
    ): Promise<QualityProcessResult | null> {
        if (!rawText?.trim()) {
            return null
        }

        const result = await this.processText(
            rawText,
            languageCode,
            isGenerated,
        )

        if (!result) {
            console.error(
                `Transcription ${transcriptionId} was left unprocessed`,
            )
            return null
        }

        const rawAnalysis = await this.analyzeText(rawText, languageCode)

        await prisma.transcription.update({
            where: { id: transcriptionId },
            data: {
                processedContent: result.processedText,
                qualityMetrics:
                    result.qualityMetrics as unknown as Prisma.InputJsonValue,
                rawQualityMetrics: rawAnalysis
                    ? (rawAnalysis.qualityMetrics as unknown as Prisma.InputJsonValue)
                    : undefined,
                isProcessed: true,
                mtldScore: result.qualityMetrics.mtldScore,
                mattrScore: result.qualityMetrics.mattrScore,
                ...(options.resetDownstream ? downstreamResetData : {}),
            },
        })

        return result
    }

    private punctuationPayload() {
        if (!env.PUNCTUATION_RESTORATION) {
            return { restore_punctuation: false }
        }
        return {
            restore_punctuation: true,
            provider: env.CURATION_LLM_PROVIDER,
            openai_api_key: env.OPENAI_API_KEY,
            openai_model: env.OPENAI_MODEL,
            ollama_base_url: env.OLLAMA_BASE_URL,
            ollama_model: env.OLLAMA_MODEL,
        }
    }

    private executePythonScript(payload: {
        text: string
        language_code: string | null
        is_generated: boolean
        analyze_only?: boolean
        reference_text?: string | null
        restore_punctuation?: boolean
        provider?: string
        openai_api_key?: string
        openai_model?: string
        ollama_base_url?: string
        ollama_model?: string
    }): Promise<PythonProcessResponse> {
        return new Promise((resolve, reject) => {
            const pythonProcess = spawn(this.pythonPath, [this.scriptPath], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: process.cwd(),
            })

            const timeoutId = setTimeout(() => {
                pythonProcess.kill('SIGTERM')
                reject(new Error('Text processor execution timeout'))
            }, this.timeout)

            let stdout = ''
            let stderr = ''

            pythonProcess.stdout.on('data', (data) => {
                stdout += data.toString()
            })

            pythonProcess.stderr.on('data', (data) => {
                stderr += data.toString()
            })

            pythonProcess.on('close', (code) => {
                clearTimeout(timeoutId)

                try {
                    const result = JSON.parse(stdout) as PythonProcessResponse
                    resolve(result)
                } catch {
                    reject(
                        new Error(
                            `Failed to parse text processor output (code ${code}): ${stdout}\nStderr: ${stderr}`,
                        ),
                    )
                }
            })

            pythonProcess.on('error', (error) => {
                clearTimeout(timeoutId)
                reject(
                    new Error(
                        `Failed to execute text processor: ${error.message}`,
                    ),
                )
            })

            pythonProcess.stdin.write(JSON.stringify(payload))
            pythonProcess.stdin.end()
        })
    }
}

export const textQualityService = new TextQualityService()
