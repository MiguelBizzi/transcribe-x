import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { getTranscriptionById } from '@/app/dashboard/transcribe/data/transcriptions'
import { TranscriptionHero } from './components/transcription-hero'
import { TranscriptContent } from './components/transcript-content'
import { QualityMetricsPanel } from './components/quality-metrics-panel'
import { TranscriptionExportPanel } from './components/transcription-export-panel'

interface TranscriptionDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TranscriptionDetailPage({
  params,
}: TranscriptionDetailPageProps) {
  const { id } = await params

  let transcription
  try {
    transcription = await getTranscriptionById(id)
  } catch {
    notFound()
  }

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-8">
      <div>
        <Link
          href="/dashboard/transcribe"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          My Transcriptions
        </Link>
      </div>

      <TranscriptionHero transcription={transcription} />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <TranscriptContent transcription={transcription} />
        <QualityMetricsPanel transcription={transcription} />
      </div>

      <TranscriptionExportPanel transcription={transcription} />
    </div>
  )
}
