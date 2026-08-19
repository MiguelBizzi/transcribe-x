import Link from 'next/link'
import { Clock, Video } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Calendar, Play, XCircle, CheckCircle } from 'lucide-react'
import type { Transcription } from '../data/recent-activity'
import { formatDateShort } from '@/utils/format-date'

interface RecentTranscriptCardProps {
  transcription: Transcription
}

export function RecentTranscriptCard({
  transcription,
}: RecentTranscriptCardProps) {
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />
      default:
        return <Clock className="text-muted-foreground h-4 w-4" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'bg-green-100 text-green-700'
      case 'error':
        return 'bg-red-100 text-red-700'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusText = (status: string) => {
    return status.toLowerCase().replace(/_/g, ' ')
  }

  return (
    <Link
      href={`/dashboard/transcriptions/${transcription.id}`}
      className="hover:bg-muted/50 flex items-center gap-4 rounded-lg border p-4 transition-colors"
    >
      {transcription.thumbnail ? (
        <div className="bg-muted relative h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg">
          <img
            src={transcription.thumbnail}
            alt={transcription.title}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-4 w-4 text-white" />
          </div>
        </div>
      ) : (
        <div className="bg-muted relative h-12 w-20 flex-shrink-0 overflow-hidden rounded-lg">
          <div className="absolute inset-0 flex items-center justify-center">
            <Video className="text-muted-foreground h-6 w-6" />
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <h3 className="mb-1 truncate font-medium">{transcription.title}</h3>
        <div className="text-muted-foreground flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {formatDateShort(transcription.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <Badge
              className={getStatusColor(transcription.status)}
              variant="secondary"
            >
              {getStatusIcon(transcription.status)}
              {getStatusText(transcription.status)}
            </Badge>
          </div>
          {transcription.wordCount && (
            <div className="flex items-center gap-1">
              <span>{transcription.wordCount} words</span>
            </div>
          )}
          {transcription.duration && (
            <div className="flex items-center gap-1">
              <span>{Math.round(transcription.duration / 60)} min</span>
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}
