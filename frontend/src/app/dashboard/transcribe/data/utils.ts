import { ExportFormat, UrlType, UrlTypeInfo } from './types'
import { PlaySquare, ListVideo, Youtube, Link } from 'lucide-react'

export const detectUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/g
  return text.match(urlRegex) || []
}

export const getUrlType = (urls: string[]): UrlType => {
  if (urls.length === 0) return null

  if (urls.some((url) => url.includes('playlist'))) {
    return 'playlist'
  } else if (
    urls.some((url) => url.includes('/c/') || url.includes('/channel/'))
  ) {
    return 'channel'
  } else if (urls.length === 1) {
    return 'video'
  } else {
    return 'mixed'
  }
}

export const getUrlTypeInfo = (urlType: UrlType): UrlTypeInfo | null => {
  switch (urlType) {
    case 'video':
      return {
        icon: PlaySquare,
        label: 'Single Video',
        color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
      }
    case 'playlist':
      return {
        icon: ListVideo,
        label: 'Playlist',
        color:
          'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
      }
    case 'channel':
      return {
        icon: Youtube,
        label: 'Channel',
        color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      }
    case 'mixed':
      return {
        icon: Link,
        label: 'Multiple URLs',
        color:
          'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
      }
    default:
      return null
  }
}

export const getExportFormats = (): ExportFormat[] => [
  'TXT',
  'PDF',
  'DOCX',
  'JSON',
]

export const getBulkModePlaceholder = (bulkMode: boolean): string => {
  if (bulkMode) {
    return 'Paste multiple YouTube URLs (one per line):\n\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/playlist?list=...\nhttps://youtube.com/c/channelname'
  }
  return 'Paste a YouTube URL:\n\n• Single video: https://youtube.com/watch?v=...\n• Playlist: https://youtube.com/playlist?list=...\n• Channel: https://youtube.com/c/channelname'
}
