import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { CheckCircle, RefreshCw, Clock, XCircle } from 'lucide-react'
import Link from 'next/link'
import { getTranscriptions } from '../data/transcriptions'
import { TranscriptionJobActions } from './transcription-job-actions'
import { PlaylistJobsAccordion } from './playlist-jobs-accordion'
import { formatStatus } from '@/utils/format-status'
import { cn } from '@/lib/utils'
import type { Transcription } from '../data/types'

const getStatusIconSafe = (status: string) => {
  switch (status) {
    case 'pending':
      return <Clock className="text-muted-foreground h-4 w-4" />
    case 'processing':
      return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
    case 'COMPLETED':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'ERROR':
      return <XCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="text-muted-foreground h-4 w-4" />
  }
}

const getStatusColorSafe = (status: string): string => {
  switch (status) {
    case 'pending':
      return 'bg-muted/50 text-muted-foreground'
    case 'processing':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    case 'COMPLETED':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    case 'ERROR':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    default:
      return 'bg-muted/50 text-muted-foreground'
  }
}

type JobGroup =
  | { kind: 'video'; transcription: Transcription }
  | {
      kind: 'playlist'
      playlistId: string
      title: string
      thumbnail: string | null
      videos: Transcription[]
    }

function groupTranscriptionJobs(
  transcriptions: Transcription[],
): JobGroup[] {
  const videosByPlaylist = new Map<string, Transcription[]>()

  for (const transcription of transcriptions) {
    if (!transcription.playlistId || !transcription.playlist) continue
    const group = videosByPlaylist.get(transcription.playlistId) ?? []
    group.push(transcription)
    videosByPlaylist.set(transcription.playlistId, group)
  }

  for (const videos of videosByPlaylist.values()) {
    videos.sort((a, b) => (a.videoIndex ?? 0) - (b.videoIndex ?? 0))
  }

  const seenPlaylists = new Set<string>()
  const groups: JobGroup[] = []

  for (const transcription of transcriptions) {
    const playlistId = transcription.playlistId
    const playlist = transcription.playlist

    if (!playlistId || !playlist) {
      groups.push({ kind: 'video', transcription })
      continue
    }

    if (seenPlaylists.has(playlistId)) continue

    seenPlaylists.add(playlistId)
    const videos = videosByPlaylist.get(playlistId) ?? [transcription]
    groups.push({
      kind: 'playlist',
      playlistId,
      title: playlist.title,
      thumbnail: playlist.thumbnail ?? videos[0]?.thumbnail ?? null,
      videos,
    })
  }

  return groups
}

function TranscriptionJobCard({
  transcription,
  nested = false,
}: {
  transcription: Transcription
  nested?: boolean
}) {
  return (
    <div
      className={cn(
        'w-full rounded-lg p-6 transition-colors',
        nested
          ? 'bg-background hover:bg-muted/60'
          : 'bg-muted/30 hover:bg-muted/50',
      )}
    >
      <div className="flex w-full items-start gap-4">
        <Link
          href={`/dashboard/transcriptions/${transcription.id}`}
          className="flex min-w-0 flex-1 items-start gap-4"
        >
          <div className="relative flex-shrink-0">
            <img
              src={
                transcription.thumbnail ||
                'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg'
              }
              alt={transcription.title}
              className="h-16 w-24 rounded-md object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/20">
              {getStatusIconSafe(transcription.status)}
            </div>
          </div>

          <div className="w-full flex-1 space-y-3">
            <div className="flex w-full items-start justify-between">
              <div>
                <h3 className="font-semibold">{transcription.title}</h3>
                <p className="text-muted-foreground truncate text-sm">
                  {transcription.youtubeId}
                </p>
              </div>
              <Badge className={getStatusColorSafe(transcription.status)}>
                {formatStatus(transcription.status)}
              </Badge>
            </div>

            {transcription.status === 'processing' && (
              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processando...</span>
                  <span>50%</span>
                </div>
                <Progress value={50} className="h-2" />
                <p className="text-muted-foreground text-xs">
                  Tempo estimado: processando...
                </p>
              </div>
            )}
          </div>
        </Link>
      </div>

      <div className="flex w-full items-center gap-2 pt-4">
        {transcription.status === 'COMPLETED' && (
          <TranscriptionJobActions transcription={transcription} />
        )}

        {transcription.status === 'ERROR' && (
          <Button variant="outline" size="sm" className="text-xs">
            <RefreshCw className="mr-1 h-3 w-3" />
            Tentar novamente
          </Button>
        )}
      </div>
    </div>
  )
}

export async function TranscriptionJobs() {
  try {
    const data = await getTranscriptions()
    const transcriptions = data.transcriptions

    if (transcriptions.length === 0) {
      return (
        <Card className="hover:shadow-elegant transition-all duration-300">
          <CardContent className="pt-6">
            <div className="py-8 text-center">
              <h3 className="text-muted-foreground text-lg font-medium">
                Nenhuma transcrição ainda
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Comece transcrevendo o seu primeiro vídeo!
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    const completedCount = transcriptions.filter(
      (t) => t.status === 'COMPLETED',
    ).length
    const jobGroups = groupTranscriptionJobs(transcriptions)

    return (
      <Card className="hover:shadow-elegant transition-all duration-300">
        <CardContent className="pt-6">
          <div className="mb-6 flex w-full items-center justify-between">
            <h2 className="text-2xl font-bold">Trabalhos de transcrição</h2>
            <Badge variant="outline" className="text-sm">
              {completedCount} / {transcriptions.length} concluídos
            </Badge>
          </div>

          <div className="grid w-full gap-4">
            {jobGroups.map((group) => {
              if (group.kind === 'video') {
                return (
                  <TranscriptionJobCard
                    key={group.transcription.id}
                    transcription={group.transcription}
                  />
                )
              }

              const playlistCompleted = group.videos.filter(
                (video) => video.status === 'COMPLETED',
              ).length

              return (
                <PlaylistJobsAccordion
                  key={group.playlistId}
                  title={group.title}
                  thumbnail={group.thumbnail}
                  playlistHref={`/dashboard/playlists/${group.playlistId}`}
                  videoCount={group.videos.length}
                  completedCount={playlistCompleted}
                >
                  {group.videos.map((video) => (
                    <TranscriptionJobCard
                      key={video.id}
                      transcription={video}
                      nested
                    />
                  ))}
                </PlaylistJobsAccordion>
              )
            })}
          </div>
        </CardContent>
      </Card>
    )
  } catch (error) {
    return (
      <Card className="hover:shadow-elegant transition-all duration-300">
        <CardContent className="pt-6">
          <div className="py-8 text-center">
            <h3 className="text-lg font-medium text-red-600">
              Erro ao carregar transcrições
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error
                ? error.message
                : 'Tente novamente mais tarde'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
}
