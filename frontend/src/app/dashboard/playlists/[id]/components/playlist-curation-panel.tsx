'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyMinus, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { PlaylistDetail } from '@/app/dashboard/transcribe/data/types'
import {
  deduplicatePlaylistAction,
  exportFineTuningAction,
} from '@/app/dashboard/transcribe/data/actions'

interface PlaylistCurationPanelProps {
  playlist: PlaylistDetail
}

type Dataset = 'raw' | 'processed' | 'curated' | 'rewritten'
type ExportFormat = 'jsonl' | 'csv' | 'json'

function triggerDownload(filename: string, mimeType: string, content: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export function PlaylistCurationPanel({ playlist }: PlaylistCurationPanelProps) {
  const router = useRouter()
  const [isDeduplicating, setIsDeduplicating] = useState(false)
  const [dataset, setDataset] = useState<Dataset>(
    playlist.transcriptions.some((video) => video.rewrittenContent?.trim())
      ? 'rewritten'
      : playlist.transcriptions.some((video) => video.llmCurationScore != null)
        ? 'curated'
        : playlist.transcriptions.some((video) => video.isProcessed)
          ? 'processed'
          : 'raw',
  )
  const [format, setFormat] = useState<ExportFormat>('jsonl')
  const [isExporting, setIsExporting] = useState(false)

  const duplicateCount = playlist.transcriptions.filter(
    (video) => video.deduplicationStatus === 'duplicate',
  ).length

  const handleDeduplicate = async () => {
    setIsDeduplicating(true)
    try {
      const result = await deduplicatePlaylistAction({ id: playlist.id })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data?.success) {
        throw new Error(result.data?.message || 'Falha ao deduplicar')
      }

      toast.success(
        `${result.data.duplicateCount} duplicatas marcadas, ${result.data.keptCount} mantidas`,
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha ao deduplicar a playlist',
      )
    } finally {
      setIsDeduplicating(false)
    }
  }

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const result = await exportFineTuningAction({
        scope: 'playlist',
        playlistId: playlist.id,
        dataset,
        format,
        includeDuplicates: false,
      })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data || result.data.success !== true || !('content' in result.data)) {
        throw new Error(
          result.data && 'message' in result.data
            ? result.data.message
            : 'Falha ao exportar',
        )
      }

      triggerDownload(
        result.data.filename,
        result.data.mimeType,
        result.data.content,
      )
      toast.success(`${result.data.recordCount} exemplos exportados`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao exportar o dataset de fine-tuning',
      )
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Curadoria para fine-tuning</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm">
            {duplicateCount > 0
              ? `${duplicateCount} vídeos marcados como duplicata.`
              : 'Deduplique a playlist antes de exportar o dataset.'}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeduplicate}
            disabled={isDeduplicating || playlist.transcriptions.length < 2}
          >
            <CopyMinus
              className={isDeduplicating ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
            />
            {isDeduplicating ? 'Deduplicando…' : 'Deduplicar playlist'}
          </Button>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs
            value={dataset}
            onValueChange={(value) => setDataset(value as Dataset)}
          >
            <TabsList>
              <TabsTrigger value="raw">Bruto</TabsTrigger>
              <TabsTrigger value="processed">Processado</TabsTrigger>
              <TabsTrigger value="curated">Curado</TabsTrigger>
              <TabsTrigger value="rewritten">Reescrito</TabsTrigger>
            </TabsList>
          </Tabs>
          <Tabs
            value={format}
            onValueChange={(value) => setFormat(value as ExportFormat)}
          >
            <TabsList>
              <TabsTrigger value="jsonl">JSONL</TabsTrigger>
              <TabsTrigger value="csv">CSV</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <Button
          variant="outline"
          className="w-full sm:w-fit"
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar dataset
        </Button>
      </CardContent>
    </Card>
  )
}
