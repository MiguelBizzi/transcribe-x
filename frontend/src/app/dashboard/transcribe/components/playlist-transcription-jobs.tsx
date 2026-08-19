import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import {
  CheckCircle,
  RefreshCw,
  Clock,
  XCircle,
  PlaySquare,
  Users,
} from 'lucide-react'
import { getPlaylistTranscriptions } from '../data/playlist-transcriptions'
import { PlaylistJobActions } from './playlist-job-actions'
import Link from 'next/link'

const getStatusIconSafe = (status: string) => {
  switch (status.toUpperCase()) {
    case 'PENDING':
      return <Clock className="text-muted-foreground h-4 w-4" />
    case 'PROCESSING':
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
  switch (status.toUpperCase()) {
    case 'PENDING':
      return 'bg-muted/50 text-muted-foreground'
    case 'PROCESSING':
      return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300'
    case 'COMPLETED':
      return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    case 'ERROR':
      return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
    default:
      return 'bg-muted/50 text-muted-foreground'
  }
}

const isCompleted = (status: string) => status.toUpperCase() === 'COMPLETED'
const isError = (status: string) => status.toUpperCase() === 'ERROR'
const isProcessing = (status: string) =>
  status.toUpperCase() === 'PROCESSING' || status.toUpperCase() === 'PENDING'

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '—'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export async function PlaylistTranscriptionJobs() {
  try {
    const data = await getPlaylistTranscriptions()
    const playlists = data.playlists

    if (playlists.length === 0) {
      return (
        <Card className="hover:shadow-elegant transition-all duration-300">
          <CardContent className="pt-6">
            <div className="py-8 text-center">
              <h3 className="text-muted-foreground text-lg font-medium">
                No playlist transcriptions yet
              </h3>
              <p className="text-muted-foreground mt-2 text-sm">
                Start by transcribing your first playlist!
              </p>
            </div>
          </CardContent>
        </Card>
      )
    }

    const completedCount = playlists.filter((p) => isCompleted(p.status)).length

    return (
      <Card className="hover:shadow-elegant transition-all duration-300">
        <CardContent className="pt-6">
          <div className="mb-6 flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <PlaySquare className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold">Playlist Transcriptions</h2>
            </div>
            <Badge variant="outline" className="text-sm">
              {completedCount} / {playlists.length} completed
            </Badge>
          </div>

          <div className="grid w-full gap-4">
            {playlists.map((playlist) => (
              <div
                key={playlist.id}
                className="bg-muted/30 hover:bg-muted/50 w-full rounded-lg p-6 transition-colors"
              >
                <div className="flex w-full items-start gap-4">
                  <Link
                    href={`/dashboard/playlists/${playlist.id}`}
                    className="flex min-w-0 flex-1 items-start gap-4"
                  >
                    <div className="relative flex-shrink-0">
                      <div className="flex h-16 w-24 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900">
                        <PlaySquare className="h-8 w-8 text-blue-500" />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/20">
                        {getStatusIconSafe(playlist.status)}
                      </div>
                    </div>

                    <div className="w-full flex-1 space-y-3">
                      <div className="flex w-full items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{playlist.title}</h3>
                          <div className="text-muted-foreground flex items-center gap-4 text-sm">
                            <span className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {playlist.videoCount} videos
                            </span>
                            <span>
                              Duration: {formatDuration(playlist.totalDuration)}
                            </span>
                          </div>
                        </div>
                        <Badge className={getStatusColorSafe(playlist.status)}>
                          {playlist.status}
                        </Badge>
                      </div>

                      {isProcessing(playlist.status) && (
                        <div className="w-full space-y-2">
                          <div className="flex justify-between text-sm">
                            <span>Processing playlist...</span>
                            <span>{playlist.progress ?? 0}%</span>
                          </div>
                          <Progress
                            value={playlist.progress ?? 0}
                            className="h-2"
                          />
                          <p className="text-muted-foreground text-xs">
                            Processing {playlist.videoCount} videos...
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                </div>

                <div className="flex w-full items-center gap-2 pt-4">
                  {isCompleted(playlist.status) && (
                    <PlaylistJobActions playlist={playlist} />
                  )}

                  {isError(playlist.status) && (
                    <Button variant="outline" size="sm" className="text-xs">
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
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
              Error loading playlist transcriptions
            </h3>
            <p className="text-muted-foreground mt-2 text-sm">
              {error instanceof Error
                ? error.message
                : 'Please try again later'}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
}
