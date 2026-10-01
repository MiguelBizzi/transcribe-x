import type { PlaylistDetail, Timestamp } from './types'

export function resolveTranscriptText(
  content?: string | null,
  timestamps?: Timestamp[] | null,
): string {
  if (content?.trim()) {
    return content.trim()
  }

  if (timestamps?.length) {
    return timestamps
      .map((segment) => segment.text.trim())
      .filter(Boolean)
      .join(' ')
  }

  return ''
}

export function playlistCopyText(playlist: PlaylistDetail): string {
  return playlist.transcriptions
    .map((video, index) => {
      const heading = `${index + 1}. ${video.title}`
      const body = resolveTranscriptText(video.content, video.timestamps)
      return body ? `${heading}\n${body}` : heading
    })
    .join('\n\n')
}
