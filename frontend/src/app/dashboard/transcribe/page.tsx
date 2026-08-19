import { Suspense } from 'react'
import { TranscribeHeader } from './components/transcribe-header'
import { VideoInputSection } from './components/video-input-section'
import { TranscriptionJobs } from './components/transcription-jobs'
import { PlaylistTranscriptionJobs } from './components/playlist-transcription-jobs'
import { TranscriptionJobsSkeleton } from './components/transcription-jobs-skeleton'
import { getCurrentUser } from '@/server/validate-auth'
import { redirect } from 'next/navigation'

export default async function Transcribe() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth')
  }

  return (
    <div className="flex flex-1 flex-col space-y-8 px-6 py-6">
      <TranscribeHeader />

      <VideoInputSection />

      <div className="space-y-8">
        <Suspense fallback={<TranscriptionJobsSkeleton />}>
          <TranscriptionJobs />
        </Suspense>

        <Suspense fallback={<TranscriptionJobsSkeleton />}>
          <PlaylistTranscriptionJobs />
        </Suspense>
      </div>
    </div>
  )
}
