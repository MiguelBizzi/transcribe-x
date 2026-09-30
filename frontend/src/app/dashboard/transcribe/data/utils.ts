import { ExportFormat, UrlType, UrlTypeInfo } from './types'
import { PlaySquare, ListVideo, Youtube, Link } from 'lucide-react'

export const detectUrls = (text: string): string[] => {
  const urlRegex = /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/g
  return text.match(urlRegex) || []
}

function isChannelUrl(url: string): boolean {
  return (
    url.includes('/channel/') ||
    url.includes('/c/') ||
    url.includes('/user/') ||
    /youtube\.com\/@/i.test(url)
  )
}

export const getUrlType = (urls: string[]): UrlType => {
  if (urls.length === 0) return null

  if (urls.some((url) => url.includes('playlist'))) {
    return 'playlist'
  }
  if (urls.some(isChannelUrl)) {
    return 'channel'
  }
  if (urls.length === 1) {
    return 'video'
  }
  return 'mixed'
}

export const getUrlTypeInfo = (urlType: UrlType): UrlTypeInfo | null => {
  switch (urlType) {
    case 'video':
      return {
        icon: PlaySquare,
        label: 'Vídeo único',
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
        label: 'Canal',
        color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
      }
    case 'mixed':
      return {
        icon: Link,
        label: 'Várias URLs',
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

export const getBulkModePlaceholder = (): string => {
  return 'Cole uma ou mais URLs de vídeo ou playlist do YouTube (uma por linha):\n\nhttps://youtube.com/watch?v=...\nhttps://youtube.com/playlist?list=...'
}
