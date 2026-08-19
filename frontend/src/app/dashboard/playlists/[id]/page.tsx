import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, ExternalLink, PlaySquare, Users } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { getPlaylistTranscriptionById } from '@/app/dashboard/transcribe/data/playlist-transcriptions'
import { formatDateShort } from '@/utils/format-date'
import {
  formatDuration,
  formatQualityScore,
  getQualityTone,
} from '@/utils/format-duration'
import { formatStatus } from '@/utils/format-status'
import { cn } from '@/lib/utils'
import { PlaylistExportPanel } from './components/playlist-export-panel'
import { PlaylistVideoList } from './components/playlist-video-list'

interface PlaylistDetailPageProps {
  params: Promise<{ id: string }>
}

function averageQualityScore(scores: number[]): number | null {
  if (scores.length === 0) return null
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

function scoreClass(score: number) {
  const tone = getQualityTone(score)
  if (tone === 'good') return 'text-green-600 dark:text-green-400'
  if (tone === 'fair') return 'text-amber-600 dark:text-amber-400'
  return 'text-red-600 dark:text-red-400'
}

export default async function PlaylistDetailPage({
  params,
}: PlaylistDetailPageProps) {
  const { id } = await params

  let playlist
  try {
    playlist = await getPlaylistTranscriptionById(id)
  } catch {
    notFound()
  }

  const avgScore = averageQualityScore(
    playlist.transcriptions
      .map((video) => video.qualityMetrics?.qualityScore)
      .filter((score): score is number => typeof score === 'number'),
  )
  const youtubeUrl = `https://www.youtube.com/playlist?list=${playlist.youtubeId}`

  return (
    <div className="flex flex-1 flex-col gap-8 px-6 py-8">
      <div>
        <Link
          href="/dashboard/transcribe"
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 text-sm"
        >
          <ArrowLeft className="h-4 w-4" />
          Minhas transcrições
        </Link>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        {playlist.thumbnail ? (
          <div className="bg-muted relative aspect-video w-full overflow-hidden rounded-xl md:w-80">
            <img
              src={playlist.thumbnail}
              alt={playlist.title}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="bg-muted flex aspect-video w-full items-center justify-center rounded-xl md:w-80">
            <PlaySquare className="text-muted-foreground h-10 w-10" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4">
          <div className="space-y-3">
            <Badge variant="outline">{formatStatus(playlist.status)}</Badge>
            <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
              {playlist.title}
            </h1>
            {playlist.channelTitle && (
              <p className="text-muted-foreground">{playlist.channelTitle}</p>
            )}
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {playlist.videoCount} vídeos
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(playlist.totalDuration)}
              </span>
              <span>{formatDateShort(playlist.createdAt)}</span>
            </div>
            {avgScore !== null && (
              <div className="max-w-sm space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    Pontuação média de qualidade
                  </span>
                  <span className={cn('font-semibold', scoreClass(avgScore))}>
                    {formatQualityScore(avgScore)}
                  </span>
                </div>
                <Progress value={avgScore * 100} className="h-2" />
              </div>
            )}
          </div>
          <Button asChild variant="outline" size="sm" className="w-fit">
            <Link href={youtubeUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Abrir no YouTube
            </Link>
          </Button>
        </div>
      </div>

      <PlaylistExportPanel playlist={playlist} />
      <PlaylistVideoList videos={playlist.transcriptions} />
    </div>
  )
}
