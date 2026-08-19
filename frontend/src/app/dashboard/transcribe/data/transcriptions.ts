import { apiFetch } from '@/lib/api'
import { Transcription, TranscriptionDetail } from './types'

export interface TranscriptionsResponse {
  transcriptions: Transcription[]
  total: number
}

export async function getTranscriptions(): Promise<TranscriptionsResponse> {
  return apiFetch<TranscriptionsResponse>('/transcriptions')
}

export async function getTranscriptionById(
  id: string,
): Promise<TranscriptionDetail> {
  const response = await apiFetch<{ transcription: TranscriptionDetail }>(
    `/transcriptions/${id}`,
  )
  return response.transcription
}
