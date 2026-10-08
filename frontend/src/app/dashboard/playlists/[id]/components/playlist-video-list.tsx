'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Download, Loader2, RefreshCw, Video, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type {
  DatasetFormat,
  PlaylistVideoTranscription,
} from '@/app/dashboard/transcribe/data/types'
import { furthestDatasetStage, getExportFormats } from '@/app/dashboard/transcribe/data/utils'
import { downloadFineTuningDataset } from '@/app/dashboard/transcribe/data/download-dataset'
import { RetryFailedPlaylistButton } from '@/app/dashboard/transcribe/components/retry-failed-playlist-button'
import { RetryTranscriptionButton } from '@/app/dashboard/transcribe/components/retry-transcription-button'
import { formatQualityScore, getQualityTone } from '@/utils/format-duration'
import { formatStatus } from '@/utils/format-status'
import { cn } from '@/lib/utils'

interface PlaylistVideoListProps {
  playlistId: string
  videos: PlaylistVideoTranscription[]
  processing?: boolean
}

function statusIcon(status: string) {
  if (status.toUpperCase() === 'COMPLETED') {
    return <CheckCircle className="h-4 w-4 text-green-500" />
  }
  if (status.toUpperCase() === 'ERROR') {
    return <XCircle className="h-4 w-4 text-red-500" />
  }
  return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
}

function scoreClass(score: number) {
  const tone = getQualityTone(score)
  if (tone === 'good') return 'text-green-600 dark:text-green-400'
  if (tone === 'fair') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export function PlaylistVideoList({
  playlistId,
  videos,
  processing = false,
}: PlaylistVideoListProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const failedCount = videos.filter(
    (video) => video.status.toUpperCase() === 'ERROR',
  ).length
  const currentProcessingId = videos.find(
    (video) => video.status.toUpperCase() === 'PROCESSING',
  )?.id

  const handleDownload = async (
    video: PlaylistVideoTranscription,
    format: DatasetFormat,
  ) => {
    const actionKey = `${video.id}:${format}`
    setPendingAction(actionKey)
    try {
      await downloadFineTuningDataset({
        scope: 'transcription',
        transcriptionId: video.id,
        dataset: furthestDatasetStage({
          processedContent: video.processedContent,
          isProcessed: video.isProcessed,
          llmCurationScore: video.llmCurationScore,
          recommendation: video.llmCurationData?.recommendation,
        }),
        format,
        includeDuplicates: true,
      })
      toast.success(`${format.toUpperCase()} baixado`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao baixar a transcrição',
      )
    } finally {
      setPendingAction(null)
    }
  }

  if (videos.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground text-sm">
            {processing
              ? 'Os vídeos desta playlist estão sendo preparados.'
              : 'Nenhum vídeo foi transcrito nesta playlist.'}
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Vídeos</CardTitle>
        {(failedCount > 0 || processing) && (
          <RetryFailedPlaylistButton playlistId={playlistId} />
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {videos.map((video, index) => (
          <div
            key={video.id}
            className={cn(
              'bg-muted/30 flex flex-wrap items-center gap-4 rounded-lg p-3',
              video.id === currentProcessingId && 'ring-2 ring-blue-500/40',
            )}
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
                    Pontuação{' '}
                    {formatQualityScore(video.qualityMetrics.qualityScore)}
                  </span>
                )}
                {video.deduplicationStatus === 'duplicate' && (
                  <Badge variant="outline">Duplicata</Badge>
                )}
                {video.errorMessage && (
                  <span
                    className={
                      video.status.toUpperCase() === 'ERROR'
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-amber-700 dark:text-amber-300'
                    }
                  >
                    {video.errorMessage}
                  </span>
                )}
                {typeof video.llmCurationScore === 'number' && (
                  <span>LLM {formatQualityScore(video.llmCurationScore)}</span>
                )}
              </div>
            </div>
            <Badge variant="secondary" className="hidden sm:flex">
              {statusIcon(video.status)}
              {formatStatus(video.status)}
            </Badge>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button asChild size="sm" variant="outline">
                <Link href={`/dashboard/transcriptions/${video.id}`}>Ver</Link>
              </Button>
              {video.status.toUpperCase() === 'ERROR' && !processing && (
                <RetryTranscriptionButton id={video.id} />
              )}
              {video.status.toUpperCase() === 'COMPLETED' &&
                getExportFormats().map((format) => {
                  const actionKey = `${video.id}:${format.value}`
                  return (
                    <Button
                      key={format.value}
                      size="sm"
                      variant="outline"
                      className="text-xs"
                      onClick={() => handleDownload(video, format.value)}
                      disabled={pendingAction !== null}
                    >
                      {pendingAction === actionKey ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="mr-1 h-3 w-3" />
                      )}
                      {format.label}
                    </Button>
                  )
                })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
