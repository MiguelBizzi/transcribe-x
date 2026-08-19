import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  Languages,
  Play,
  Video,
} from 'lucide-react'
import type { TranscriptionDetail } from '@/app/dashboard/transcribe/data/types'
import { formatDateShort } from '@/utils/format-date'
import { formatDuration } from '@/utils/format-duration'

interface TranscriptionHeroProps {
  transcription: TranscriptionDetail
}

function statusColor(status: string) {
  switch (status.toUpperCase()) {
    case 'COMPLETED':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    case 'ERROR':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

export function TranscriptionHero({ transcription }: TranscriptionHeroProps) {
  const youtubeUrl = `https://www.youtube.com/watch?v=${transcription.youtubeId}`

  return (
    <div className="flex flex-col gap-6 md:flex-row">
      {transcription.thumbnail ? (
        <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-xl md:w-80">
          <img
            src={transcription.thumbnail}
            alt={transcription.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-10 w-10 text-white" />
          </div>
        </div>
      ) : (
        <div className="bg-muted flex aspect-video w-full items-center justify-center rounded-xl md:w-80">
          <Video className="text-muted-foreground h-10 w-10" />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={statusColor(transcription.status)}>
              {transcription.status}
            </Badge>
            <Badge variant="outline">{transcription.type}</Badge>
            {transcription.isProcessed && (
              <Badge variant="secondary">Processed</Badge>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            {transcription.title}
          </h1>
          <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateShort(transcription.createdAt)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(transcription.duration)}
            </span>
            {transcription.language && (
              <span className="flex items-center gap-1 uppercase">
                <Languages className="h-3.5 w-3.5" />
                {transcription.language}
              </span>
            )}
            {transcription.wordCount ? (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {transcription.wordCount.toLocaleString()} words
              </span>
            ) : null}
          </div>
        </div>

        <div>
          <Button asChild variant="outline" size="sm">
            <Link href={youtubeUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Open on YouTube
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
