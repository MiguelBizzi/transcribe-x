import { apiFetch } from '@/lib/api'

export interface Transcription {
  id: string
  youtubeId: string
  title: string
  type: string
  thumbnail: string | null
  status: string
  duration: number | null
  wordCount: number | null
  language: string | null
  timestamps: Array<{
    text: string
    start: number
    duration: number
  }> | null
  createdAt: string
  updatedAt: string
}

export interface LastTranscriptionsResponse {
  transcriptions: Transcription[]
  total: number
}

export async function getLastTranscriptions(): Promise<LastTranscriptionsResponse> {
  return apiFetch<LastTranscriptionsResponse>('/transcriptions/last')
}
