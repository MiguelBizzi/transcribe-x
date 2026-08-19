'use server'

import { actionClient } from '@/lib/safe-action'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { apiFetch } from '@/lib/api'
import type {
  CreateTranscriptionRequest,
  CreateTranscriptionResponse,
  PlaylistTranscriptionRequest,
  PlaylistTranscriptionResponse,
  QualityMetrics,
} from './types'
import { getTranscriptionById } from './transcriptions'
import { getPlaylistTranscriptionById } from './playlist-transcriptions'

const createTranscriptionSchema = z.object({
  videoUrl: z.url('URL do vídeo inválida'),
})

const createPlaylistTranscriptionSchema = z.object({
  playlistUrl: z.url('URL da playlist inválida'),
})

export const createTranscriptionAction = actionClient
  .inputSchema(createTranscriptionSchema)
  .action(async ({ parsedInput: { videoUrl } }) => {
    try {
      const response = await apiFetch<CreateTranscriptionResponse>(
        '/transcriptions/video',
        {
          method: 'POST',
          body: JSON.stringify({ videoUrl } as CreateTranscriptionRequest),
        },
      )

      revalidatePath('/dashboard/transcribe')

      return {
        success: true,
        message: response.message,
        transcription: response.transcription,
      }
    } catch (error) {
      let message = 'Falha ao criar a transcrição'

      if (error instanceof Error) {
        if (error.message.includes('Video not found')) {
          message = 'Vídeo não encontrado ou inacessível'
        } else if (error.message.includes('Invalid YouTube URL')) {
          message = 'URL do YouTube inválida'
        } else if (error.message.includes('already exists')) {
          message = 'Já existe uma transcrição para este vídeo'
        } else {
          message = error.message
        }
      }

      return {
        success: false,
        message,
      }
    }
  })

export const createPlaylistTranscriptionAction = actionClient
  .inputSchema(createPlaylistTranscriptionSchema)
  .action(async ({ parsedInput: { playlistUrl } }) => {
    try {
      const response = await apiFetch<PlaylistTranscriptionResponse>(
        '/transcriptions/playlist',
        {
          method: 'POST',
          body: JSON.stringify({ playlistUrl } as PlaylistTranscriptionRequest),
        },
      )

      revalidatePath('/dashboard/transcribe')

      return {
        success: true,
        message: response.message,
        playlist: response.playlist,
        result: response.result,
      }
    } catch (error) {
      let message = 'Falha ao criar a transcrição da playlist'

      if (error instanceof Error) {
        if (error.message.includes('Invalid YouTube playlist URL')) {
          message = 'URL da playlist do YouTube inválida'
        } else if (error.message.includes('No videos found')) {
          message = 'Nenhum vídeo encontrado na playlist'
        } else {
          message = error.message
        }
      }

      return {
        success: false,
        message,
      }
    }
  })

export async function fetchTranscriptionForExport(id: string) {
  return getTranscriptionById(id)
}

export async function fetchPlaylistForExport(id: string) {
  return getPlaylistTranscriptionById(id)
}

const reprocessTranscriptionSchema = z.object({
  id: z.string().uuid('ID da transcrição inválido'),
})

export const reprocessTranscriptionAction = actionClient
  .inputSchema(reprocessTranscriptionSchema)
  .action(async ({ parsedInput: { id } }) => {
    try {
      const response = await apiFetch<{
        message: string
        transcription: {
          id: string
          processedContent: string | null
          qualityMetrics: QualityMetrics | null
          isProcessed: boolean
        }
      }>(`/transcriptions/${id}/process`, {
        method: 'POST',
      })

      revalidatePath(`/dashboard/transcriptions/${id}`)
      revalidatePath('/dashboard/transcribe')
      revalidatePath('/dashboard')

      return {
        success: true,
        message: response.message,
        transcription: response.transcription,
      }
    } catch (error) {
      return {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : 'Falha ao processar a transcrição',
      }
    }
  })
