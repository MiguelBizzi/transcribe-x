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
} from './types'
import { getTranscriptionById } from './transcriptions'
import { getPlaylistTranscriptionById } from './playlist-transcriptions'

const createTranscriptionSchema = z.object({
  videoUrl: z.url('Invalid video URL'),
})

const createPlaylistTranscriptionSchema = z.object({
  playlistUrl: z.url('Invalid playlist URL'),
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
      let message = 'Failed to create transcription'

      if (error instanceof Error) {
        if (error.message.includes('Video not found')) {
          message = 'Video not found or not accessible'
        } else if (error.message.includes('Invalid YouTube URL')) {
          message = 'Invalid YouTube URL provided'
        } else if (error.message.includes('already exists')) {
          message = 'Transcription for this video already exists'
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
      let message = 'Failed to create playlist transcription'

      if (error instanceof Error) {
        if (error.message.includes('Invalid YouTube playlist URL')) {
          message = 'Invalid YouTube playlist URL provided'
        } else if (error.message.includes('No videos found')) {
          message = 'No videos found in playlist'
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
