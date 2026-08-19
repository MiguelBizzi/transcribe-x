import { prisma } from '@/lib/prisma'
import { transcriptionService } from '@/services/transcription-service'
import { youtubeService } from '@/services/youtube-service'
import { textQualityService } from '@/services/text-quality-service'
import { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from '@fastify/type-provider-zod'
import { z } from 'zod'
import { BadRequestError } from '../_errors/bad-request-error'
import { getCurrentUser } from '../../middlewares/auth'
import { qualityMetricsSchema } from './quality-metrics-schema'
import { TranscriptionStatus, TranscriptionType } from '@/generated/prisma/client'

export async function createVideoTranscription(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post(
        '/video',
        {
            schema: {
                tags: ['Transcriptions'],
                summary: 'Create a new video transcription',
                security: [{ bearerAuth: [] }],
                body: z.object({
                    videoUrl: z.string().url('Invalid video URL'),
                }),
                response: {
                    201: z.object({
                        message: z.string(),
                        transcription: z.object({
                            id: z.string(),
                            youtubeId: z.string(),
                            title: z.string(),
                            type: z.string(),
                            thumbnail: z.string().nullable(),
                            status: z.string(),
                            duration: z.number().nullable(),
                            wordCount: z.number().nullable(),
                            language: z.string().nullable(),
                            timestamps: z
                                .array(
                                    z.object({
                                        text: z.string(),
                                        start: z.number(),
                                        duration: z.number(),
                                    }),
                                )
                                .nullable(),
                            processedContent: z.string().nullable(),
                            qualityMetrics: qualityMetricsSchema.nullable(),
                            isProcessed: z.boolean(),
                            createdAt: z.string(),
                            updatedAt: z.string(),
                        }),
                        videoDetails: z.object({
                            title: z.string(),
                            channelTitle: z.string(),
                            duration: z.number(),
                            thumbnail: z.string(),
                            viewCount: z.string(),
                            likeCount: z.string(),
                        }),
                    }),
                    400: z.object({
                        message: z.string(),
                    }),
                    401: z.object({
                        message: z.string(),
                    }),
                },
            },
        },
        async (request, reply) => {
            const { videoUrl } = request.body
            const currentUser = getCurrentUser(request)
            const userId = currentUser.id

            if (!youtubeService.isValidYouTubeUrl(videoUrl)) {
                throw new BadRequestError('Invalid YouTube URL provided')
            }

            try {
                const videoDetails =
                    await youtubeService.getVideoDetailsByUrl(videoUrl)

                const scriptCheck =
                    await transcriptionService.checkPythonScript()
                if (!scriptCheck.available) {
                    throw new BadRequestError(
                        `Python script not available: ${scriptCheck.error}`,
                    )
                }

                const {
                    transcript,
                    wordCount,
                    language,
                    timestamps,
                    isGenerated,
                } = await transcriptionService.getCleanTranscript(videoUrl)

                let status: TranscriptionStatus
                let content: string | null = null
                let errorMessage: string | null = null

                if (transcript && transcript.trim() !== '') {
                    status = TranscriptionStatus.COMPLETED
                    content = transcript
                } else {
                    status = TranscriptionStatus.ERROR
                    errorMessage = 'No transcript available for this video'
                }

                const transcription = await prisma.transcription.create({
                    data: {
                        userId,
                        youtubeId: videoDetails.id,
                        title: videoDetails.title,
                        type: TranscriptionType.VIDEO,
                        thumbnail: videoDetails.thumbnail,
                        status,
                        content,
                        duration: videoDetails.duration,
                        wordCount: wordCount > 0 ? wordCount : null,
                        language: language || 'en',
                        timestamps: timestamps ? (timestamps as any) : null,
                        errorMessage,
                        processingStartedAt: null,
                        completedAt:
                            status === TranscriptionStatus.COMPLETED
                                ? new Date()
                                : null,
                    },
                })

                let processedContent: string | null = null
                let qualityMetrics: z.infer<typeof qualityMetricsSchema> | null =
                    null
                let isProcessed = false

                if (status === TranscriptionStatus.COMPLETED && content) {
                    const processed =
                        await textQualityService.processAndPersist(
                            transcription.id,
                            content,
                            language || 'en',
                            Boolean(isGenerated),
                        )

                    if (processed) {
                        processedContent = processed.processedText
                        qualityMetrics = processed.qualityMetrics
                        isProcessed = true
                    }
                }

                const transcriptionResponse = {
                    id: transcription.id,
                    youtubeId: transcription.youtubeId,
                    title: transcription.title,
                    type: transcription.type,
                    thumbnail: transcription.thumbnail,
                    status: transcription.status,
                    duration: transcription.duration,
                    wordCount: transcription.wordCount,
                    language: transcription.language,
                    timestamps: transcription.timestamps as any,
                    processedContent,
                    qualityMetrics,
                    isProcessed,
                    createdAt: transcription.createdAt.toISOString(),
                    updatedAt: transcription.updatedAt.toISOString(),
                }

                reply.status(201).send({
                    message: 'Transcription created successfully',
                    transcription: transcriptionResponse,
                    videoDetails: {
                        title: videoDetails.title,
                        channelTitle: videoDetails.channelTitle,
                        duration: videoDetails.duration,
                        thumbnail: videoDetails.thumbnail,
                        viewCount: videoDetails.viewCount,
                        likeCount: videoDetails.likeCount,
                    },
                })
            } catch (error) {
                if (error instanceof BadRequestError) {
                    throw error
                }

                if (error instanceof Error) {
                    if (error.message.includes('Invalid YouTube URL')) {
                        throw new BadRequestError(
                            'Invalid YouTube URL provided',
                        )
                    }
                    if (error.message.includes('Video not found')) {
                        throw new BadRequestError(
                            'YouTube video not found or not accessible',
                        )
                    }
                    if (error.message.includes('Python script not available')) {
                        throw new BadRequestError(
                            'Transcription service is currently unavailable',
                        )
                    }
                    if (
                        error.message.includes('Failed to fetch video details')
                    ) {
                        throw new BadRequestError(
                            'Failed to fetch video details from YouTube. Please check the URL and try again.',
                        )
                    }
                }

                throw new BadRequestError(
                    'Failed to create transcription. Please try again later.',
                )
            }
        },
    )
}
