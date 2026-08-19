'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ExportFormat, PlaylistJob } from '../data/types'
import { getExportFormats } from '../data/utils'
import { fetchPlaylistForExport } from '../data/actions'
import {
  downloadTranscript,
  playlistToPayload,
} from '../data/export-transcript'

interface PlaylistJobActionsProps {
  playlist: PlaylistJob
}

export function PlaylistJobActions({ playlist }: PlaylistJobActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const handleDownload = async (format: ExportFormat) => {
    setPendingAction(format)
    try {
      const detail = await fetchPlaylistForExport(playlist.id)
      downloadTranscript(playlistToPayload(detail), format)
      toast.success(`${format} baixado`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao baixar a transcrição da playlist',
      )
    } finally {
      setPendingAction(null)
    }
  }

  const handleCopyTranscript = async () => {
    setPendingAction('COPY')
    try {
      const detail = await fetchPlaylistForExport(playlist.id)
      const content = playlistToPayload(detail).content

      if (!content) {
        throw new Error('Nenhum conteúdo de transcrição disponível para copiar')
      }

      await navigator.clipboard.writeText(content)
      toast.success('Transcrição da playlist copiada para a área de transferência')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao copiar a transcrição da playlist',
      )
    } finally {
      setPendingAction(null)
    }
  }

  const isBusy = pendingAction !== null

  return (
    <>
      {getExportFormats().map((format) => (
        <Button
          key={format}
          variant="outline"
          size="sm"
          onClick={() => handleDownload(format)}
          disabled={isBusy}
          className="text-xs"
        >
          {pendingAction === format ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Download className="mr-1 h-3 w-3" />
          )}
          {format}
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={handleCopyTranscript}
        disabled={isBusy}
        className="text-xs"
      >
        {pendingAction === 'COPY' ? (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        ) : (
          <Copy className="mr-1 h-3 w-3" />
        )}
        Copiar
      </Button>
    </>
  )
}
