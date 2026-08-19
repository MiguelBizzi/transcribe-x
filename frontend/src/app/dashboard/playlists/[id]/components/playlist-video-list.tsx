'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Download, Loader2, Video, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { PlaylistVideoTranscription } from '@/app/dashboard/transcribe/data/types'
import { fetchTranscriptionForExport } from '@/app/dashboard/transcribe/data/actions'
import {
  downloadTranscript,
  transcriptionToPayload,
} from '@/app/dashboard/transcribe/data/export-transcript'
import { formatQualityScore, getQualityTone } from '@/utils/format-duration'
import { formatStatus } from '@/utils/format-status'
import { cn } from '@/lib/utils'

interface PlaylistVideoListProps {
  videos: PlaylistVideoTranscription[]
}

function statusIcon(status: string) {
  if (status.toUpperCase() === 'COMPLETED') {
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }
  if (status.toUpperCase() === 'ERROR') {
    return <XCircle className="h-4 w-4 text-red-500" />
  }
  return null
}

function scoreClass(score: number) {
  const tone = getQualityTone(score)
  if (tone === 'good') return 'text-green-600 dark:text-green-400'
  if (tone === 'fair') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function PlaylistVideoList({ videos }: PlaylistVideoListProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)

  const handleDownload = async (video: PlaylistVideoTranscription) => {
    setPendingId(video.id)
    try {
      const detail = await fetchTranscriptionForExport(video.id)
      downloadTranscript(
        transcriptionToPayload(detail, { useProcessed: detail.isProcessed }),
        'TXT',
      )
      toast.success('TXT baixado')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao baixar a transcrição',
      )
    } finally {
      setPendingId(null)
    }
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground text-sm">
            Nenhum vídeo foi transcrito nesta playlist.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vídeos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {videos.map((video, index) => (
          <div
            key={video.id}
            className="bg-muted/30 flex items-center gap-4 rounded-lg p-3"
          >
            <span className="text-muted-foreground w-6 text-center text-sm font-medium">
              {video.videoIndex ?? index + 1}
            </span>
            <div className="bg-muted relative h-12 w-20 flex-shrink-0 overflow-hidden rounded-md">
              {video.thumbnail ? (
                <img
                  src={video.thumbnail}
                  alt={video.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <Video className="text-muted-foreground h-5 w-5" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{video.title}</p>
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-xs">
                <span>
                  {video.wordCount
                    ? `${video.wordCount.toLocaleString('pt-BR')} palavras`
                    : '—'}
                </span>
                {video.qualityMetrics && (
                  <span
                    className={cn(
                      'font-medium',
                      scoreClass(video.qualityMetrics.qualityScore),
                    )}
                  >
                    Pontuação {formatQualityScore(video.qualityMetrics.qualityScore)}
                  </span>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              {statusIcon(video.status)}
              {formatStatus(video.status)}
            </Badge>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/transcriptions/${video.id}`}>Ver</Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(video)}
                disabled={pendingId !== null || video.status !== 'COMPLETED'}
              >
                {pendingId === video.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
