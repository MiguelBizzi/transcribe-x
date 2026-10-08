'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  DatasetFormat,
  DatasetStage,
  TranscriptionDetail,
} from '@/app/dashboard/transcribe/data/types'
import { getExportFormats } from '@/app/dashboard/transcribe/data/utils'
import { downloadFineTuningDataset } from '@/app/dashboard/transcribe/data/download-dataset'

interface TranscriptionExportPanelProps {
  transcription: TranscriptionDetail
}

type ExportSource = 'raw' | 'clean'

const SOURCE_DATASET: Record<ExportSource, DatasetStage> = {
  raw: 'raw',
  clean: 'processed',
}

export function TranscriptionExportPanel({
  transcription,
}: TranscriptionExportPanelProps) {
  const canExportClean = Boolean(transcription.processedContent?.trim())
  const [source, setSource] = useState<ExportSource>(
    transcription.isProcessed ? 'clean' : 'raw',
  )
  const [pendingFormat, setPendingFormat] = useState<DatasetFormat | null>(null)

  const handleDownload = async (format: DatasetFormat) => {
    setPendingFormat(format)
    try {
      await downloadFineTuningDataset({
        scope: 'transcription',
        transcriptionId: transcription.id,
        dataset: SOURCE_DATASET[source],
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
      setPendingFormat(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Exportar dataset</CardTitle>
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
          </TabsList>
        </Tabs>

        <div className="flex flex-wrap gap-2">
          {getExportFormats().map((format) => (
            <Button
              key={format.value}
              variant="outline"
              size="sm"
              onClick={() => handleDownload(format.value)}
              disabled={pendingFormat !== null}
            >
              {pendingFormat === format.value ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              {format.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
