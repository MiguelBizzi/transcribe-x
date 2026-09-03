'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ExportFormat,
  TranscriptionDetail,
} from '@/app/dashboard/transcribe/data/types'
import { getExportFormats } from '@/app/dashboard/transcribe/data/utils'
import {
  downloadTranscript,
  transcriptionToPayload,
} from '@/app/dashboard/transcribe/data/export-transcript'

interface TranscriptionExportPanelProps {
  transcription: TranscriptionDetail
}

type ExportSource = 'raw' | 'clean' | 'rewritten'

export function TranscriptionExportPanel({
  transcription,
}: TranscriptionExportPanelProps) {
  const canExportClean = Boolean(transcription.processedContent?.trim())
  const canExportRewritten = Boolean(transcription.rewrittenContent?.trim())
  const [source, setSource] = useState<ExportSource>(
    canExportRewritten ? 'rewritten' : transcription.isProcessed ? 'clean' : 'raw',
  )
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null)

  const handleDownload = (format: ExportFormat) => {
    setPendingFormat(format)
    try {
      downloadTranscript(
        transcriptionToPayload(transcription, {
          useProcessed: source === 'clean',
          useRewritten: source === 'rewritten',
        }),
        format,
      )
      toast.success(`${format} baixado`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao baixar a transcrição',
      )
    } finally {
      setPendingFormat(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Exportar</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs
          value={source}
          onValueChange={(value) => setSource(value as ExportSource)}
        >
          <TabsList>
            <TabsTrigger value="raw">Original</TabsTrigger>
            <TabsTrigger value="clean" disabled={!canExportClean}>
              Processado
            </TabsTrigger>
            <TabsTrigger value="rewritten" disabled={!canExportRewritten}>
              Reescrito
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          {getExportFormats().map((format) => (
            <Button
              key={format}
              variant="outline"
              size="sm"
              onClick={() => handleDownload(format)}
              disabled={pendingFormat !== null}
            >
              {pendingFormat === format ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {format}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
