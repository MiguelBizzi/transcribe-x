'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Copy, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { type DatasetFormat, Transcription } from '../data/types'
import { furthestDatasetStage, getExportFormats } from '../data/utils'
import { fetchTranscriptionForExport } from '../data/actions'
import { resolveTranscriptText } from '../data/export-transcript'
import { downloadFineTuningDataset } from '../data/download-dataset'

interface TranscriptionJobActionsProps {
  transcription: Transcription
}

export function TranscriptionJobActions({
  transcription,
}: TranscriptionJobActionsProps) {
  const [pendingAction, setPendingAction] = useState<string | null>(null)

  const handleDownload = async (format: DatasetFormat) => {
    setPendingAction(format)
    try {
      const detail = await fetchTranscriptionForExport(transcription.id)
      await downloadFineTuningDataset({
        scope: 'transcription',
        transcriptionId: transcription.id,
        dataset: furthestDatasetStage({
          processedContent: detail.processedContent,
          isProcessed: detail.isProcessed,
          llmCurationScore: detail.llmCurationScore,
          recommendation: detail.llmCurationData?.recommendation,
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

  const handleCopyTranscript = async () => {
    setPendingAction('COPY')
    try {
      const detail = await fetchTranscriptionForExport(transcription.id)
      const content = resolveTranscriptText(detail.content, detail.timestamps)

      if (!content) {
        throw new Error('Nenhum conteúdo de transcrição disponível para copiar')
      }

      await navigator.clipboard.writeText(content)
      toast.success('Transcrição copiada para a área de transferência')
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao copiar a transcrição',
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
          key={format.value}
          variant="outline"
          size="sm"
          onClick={() => handleDownload(format.value)}
          disabled={isBusy}
          className="text-xs"
        >
          {pendingAction === format.value ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Download className="mr-1 h-3 w-3" />
          )}
          {format.label}
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
