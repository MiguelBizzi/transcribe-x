import { spawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { youtubeService } from './youtube-service'

export interface TranscriptSnippet {
    text: string
    start: number
    duration: number
}

export interface TranscriptResult {
    success: boolean
    video_id: string
    language?: string
    language_code?: string
    is_generated?: boolean
    word_count?: number
    duration_seconds?: number
    snippets?: TranscriptSnippet[]
    raw_text?: string
    timestamps?: Array<{
        text: string
        start: number
        duration: number
    }>
    error?: string
    error_type?: string
    available_languages?: Array<{
        language: string
        language_code: string
        is_generated: boolean
        is_translatable: boolean
    }>
}

export interface TranscriptionServiceOptions {
    pythonPath?: string
    scriptPath?: string
    timeout?: number
}

export class TranscriptionService {
    private pythonPath: string
    private scriptPath: string
    private timeout: number

    constructor(options: TranscriptionServiceOptions = {}) {
        const venvPython = path.join(process.cwd(), 'venv', 'bin', 'python3')
        this.pythonPath =
            options.pythonPath ||
            (existsSync(venvPython) ? venvPython : 'python3')
        this.scriptPath =
            options.scriptPath ||
            path.join(process.cwd(), 'scripts', 'youtube_transcript.py')
        this.timeout = options.timeout || 30000
    }

    /**
     * Extract video ID from YouTube URL
     */
    private extractVideoId(url: string): string | null {
        return youtubeService.extractVideoId(url)
    }

    /**
     * Execute Python script to fetch transcript
     */
    private async executePythonScript(
        videoId: string,
    ): Promise<TranscriptResult> {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                reject(new Error('Python script execution timeout'))
            }, this.timeout)

            const pythonProcess = spawn(
                this.pythonPath,
                [this.scriptPath, videoId],
                {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    cwd: process.cwd(),
                },
            )

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

                if (code !== 0 && code !== 1) {
                    reject(
                        new Error(
                            `Python script failed with code ${code}: ${stderr}`,
                        ),
                    )
                    return
                }

                try {
                    const result = JSON.parse(stdout) as TranscriptResult
                    resolve(result)
                } catch (_parseError) {
                    reject(
                        new Error(
                            `Failed to parse Python script output: ${stdout}\nStderr: ${stderr}`,
                        ),
                    )
                }
            })

            pythonProcess.on('error', (error) => {
                clearTimeout(timeoutId)
                reject(
                    new Error(
                        `Failed to execute Python script: ${error.message}`,
                    ),
                )
            })
        })
    }

    /**
     * Get transcript for a YouTube video by URL
     */
    async getTranscriptByUrl(videoUrl: string): Promise<TranscriptResult> {
        const videoId = this.extractVideoId(videoUrl)
        if (!videoId) {
            return {
                success: false,
                video_id: '',
                error: 'Invalid YouTube URL',
                error_type: 'invalid_url',
            }
        }

        return this.getTranscriptById(videoId)
    }

    /**
     * Get transcript for a YouTube video by ID
     */
    async getTranscriptById(videoId: string): Promise<TranscriptResult> {
        try {
            if (!videoId || videoId.length < 8) {
                return {
                    success: false,
                    video_id: videoId,
                    error: 'Invalid video ID format',
                    error_type: 'invalid_video_id',
                }
            }

            const result = await this.executePythonScript(videoId)
            return result
        } catch (error) {
            return {
                success: false,
                video_id: videoId,
                error:
                    error instanceof Error
                        ? error.message
                        : 'Unknown error occurred',
                error_type: 'execution_error',
            }
        }
    }

    /**
     * Get clean transcript text with timestamps
     */
    async getCleanTranscript(videoUrl: string): Promise<{
        videoId: string
        transcript: string | null
        wordCount: number
        language?: string
        isGenerated?: boolean
        timestamps?: Array<{
            text: string
            start: number
            duration: number
        }>
    }> {
        const result = await this.getTranscriptByUrl(videoUrl)

        if (result.success && result.raw_text) {
            return {
                videoId: result.video_id,
                transcript: result.raw_text,
                wordCount: result.word_count || 0,
                language: result.language_code,
                isGenerated: result.is_generated,
                timestamps: result.timestamps,
            }
        }

        return {
            videoId: result.video_id || '',
            transcript: null,
            wordCount: 0,
        }
    }

    /**
     * Check if Python script is available and working
     */
    async checkPythonScript(): Promise<{ available: boolean; error?: string }> {
        try {
            await this.executePythonScript('test123')

            return { available: true }
        } catch (error) {
            return {
                available: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            }
        }
    }
}

export const transcriptionService = new TranscriptionService()
