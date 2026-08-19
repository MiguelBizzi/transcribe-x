import { apiFetch } from '@/lib/api'
import { PlaylistDetail, PlaylistJob } from './types'

export interface PlaylistTranscriptionsResponse {
  playlists: PlaylistJob[]
  total?: number
}

export async function getPlaylistTranscriptions(): Promise<PlaylistTranscriptionsResponse> {
  return apiFetch<PlaylistTranscriptionsResponse>('/transcriptions/playlists')
}

export async function getPlaylistTranscriptionById(
  id: string,
): Promise<PlaylistDetail> {
  const response = await apiFetch<{ playlist: PlaylistDetail }>(
    `/transcriptions/playlists/${id}`,
  )
  return response.playlist
}
