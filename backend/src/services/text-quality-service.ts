import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/generated/prisma/client'

export interface QualityMetrics {
    originalWordCount: number
    processedWordCount: number
    noiseReductionRate: number
    lexicalDiversity: number
    avgSentenceLength: number
    hesitationCount: number
    repetitionCount: number
    timestampMarkersRemoved: number
    detectedLanguage: string
    processingDurationMs: number
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
        this.timeout = options.timeout || 15000
    }

    async processText(
        rawText: string,
        languageCode?: string | null,
        isGenerated = false,
    ): Promise<QualityProcessResult | null> {
        if (!rawText.trim()) {
            return null
        }

        try {
            const result = await this.executePythonScript({
                text: rawText,
                language_code: languageCode || null,
                is_generated: isGenerated,
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
        } catch {
            return null
        }
    }

    async processAndPersist(
        transcriptionId: string,
        rawText: string | null | undefined,
        languageCode?: string | null,
        isGenerated = false,
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
            return null
        }

        await prisma.transcription.update({
            where: { id: transcriptionId },
            data: {
                processedContent: result.processedText,
                qualityMetrics:
                    result.qualityMetrics as unknown as Prisma.InputJsonValue,
                isProcessed: true,
            },
        })

        return result
    }

    private executePythonScript(payload: {
        text: string
        language_code: string | null
        is_generated: boolean
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
