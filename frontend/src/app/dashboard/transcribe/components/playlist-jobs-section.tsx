import { ProcessingRefresher } from '@/app/dashboard/components/processing-refresher'
import { getPlaylistTranscriptions } from '../data/playlist-transcriptions'
import { PlaylistTranscriptionJobs } from './playlist-transcription-jobs'

export async function PlaylistJobsSection() {
  const data = await getPlaylistTranscriptions()
  const processing = data.playlists.some(
    (playlist) => playlist.status.toUpperCase() === 'PROCESSING',
  )

  return (
    <>
      <ProcessingRefresher active={processing} />
      <PlaylistTranscriptionJobs />
    </>
  )
}
