'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyMinus, Download, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  DatasetFormat,
  PlaylistDetail,
} from '@/app/dashboard/transcribe/data/types'
import {
  curateTranscriptionAction,
  deduplicatePlaylistAction,
} from '@/app/dashboard/transcribe/data/actions'
import { getExportFormats } from '@/app/dashboard/transcribe/data/utils'
import {
  downloadFineTuningDataset,
  formatDatasetDownloadMessage,
} from '@/app/dashboard/transcribe/data/download-dataset'

interface PlaylistCurationPanelProps {
  playlist: PlaylistDetail
}

type Dataset = 'raw' | 'processed' | 'curated'

export function PlaylistCurationPanel({
  playlist,
}: PlaylistCurationPanelProps) {
  const router = useRouter()
  const videos = playlist.transcriptions
  const completed = videos.filter((video) => video.status === 'COMPLETED')
  const processedCount = videos.filter((video) => video.isProcessed).length
  const dedupedCount = videos.filter(
    (video) => video.deduplicationStatus !== 'pending',
  ).length
  const curatedCount = videos.filter(
    (video) => video.llmCurationScore != null,
  ).length
  const duplicateCount = videos.filter(
    (video) => video.deduplicationStatus === 'duplicate',
  ).length

  const [isDeduplicating, setIsDeduplicating] = useState(false)
  const [isCurating, setIsCurating] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [dataset, setDataset] = useState<Dataset>(
    curatedCount > 0 ? 'curated' : processedCount > 0 ? 'processed' : 'raw',
  )
  const [format, setFormat] = useState<DatasetFormat>('json')
  const [batchProgress, setBatchProgress] = useState<string | null>(null)
  const [lastExportCounts, setLastExportCounts] = useState<{
    recordCount: number
    skippedDuplicates: number
    skippedDiscarded: number
    skippedFailed: number
  } | null>(null)
  const discardedCount = videos.filter(
    (video) => video.llmCurationData?.recommendation === 'discard',
  ).length
  const previewSkippedFailed = videos.filter(
    (video) => video.status === 'ERROR',
  ).length
  const previewSkippedDiscarded = dataset === 'curated' ? discardedCount : 0
  const previewRecordCount = videos.filter((video) => {
    if (video.status !== 'COMPLETED') return false
    if (
      dataset === 'curated' &&
      video.llmCurationData?.recommendation === 'discard'
    ) {
      return false
    }
    if (dataset === 'curated' && video.llmCurationScore == null) return false
    const text =
      dataset === 'raw'
        ? video.content
        : video.processedContent || video.content
    return Boolean(text?.trim())
  }).length

  const handleDeduplicate = async () => {
    setIsDeduplicating(true)
    try {
      const result = await deduplicatePlaylistAction({ id: playlist.id })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data?.success) {
        throw new Error(result.data?.message || 'Falha ao marcar duplicatas')
      }

      toast.success(
        `${result.data.duplicateCount} duplicatas marcadas, ${result.data.keptCount} mantidas. Os vídeos continuam no banco e entram no dataset da playlist.`,
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha ao marcar duplicatas',
      )
    } finally {
      setIsDeduplicating(false)
    }
  }

  const handleCurate = async () => {
    const pending = videos.filter(
      (video) =>
        video.status === 'COMPLETED' &&
        video.deduplicationStatus !== 'pending' &&
        video.deduplicationStatus !== 'duplicate' &&
        video.llmCurationScore == null,
    )
    if (pending.length === 0) {
      toast.info('Nenhum vídeo pendente de curadoria.')
      return
    }

    setIsCurating(true)
    let curated = 0
    let failed = 0
    try {
      for (const [index, video] of pending.entries()) {
        setBatchProgress(`${index + 1}/${pending.length}`)
        const result = await curateTranscriptionAction({ id: video.id })
        if (result.serverError || !result.data?.success) {
          failed += 1
          continue
        }
        curated += 1
      }
      toast.success(
        `${curated} curados, ${videos.length - pending.length} ignorados, ${failed} falhas`,
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Falha ao curar a playlist',
      )
    } finally {
      setBatchProgress(null)
      setIsCurating(false)
    }
  }

  const handleDatasetExport = async () => {
    setIsExporting(true)
    try {
      const counts = await downloadFineTuningDataset({
        scope: 'playlist',
        playlistId: playlist.id,
        dataset,
        format,
        includeDuplicates: true,
      })
      setLastExportCounts(counts)
      toast.success(formatDatasetDownloadMessage(counts))
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
        <CardTitle>Curadoria e exportação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="grid grid-cols-3 gap-2 text-center text-xs lg:flex lg:w-fit lg:gap-3">
          <li className="rounded-md border p-2 lg:min-w-38 lg:px-4 lg:py-3">
            Processados
            <div className="mt-1 font-semibold">
              {processedCount}/{videos.length}
            </div>
          </li>
          <li className="rounded-md border p-2 lg:min-w-38 lg:px-4 lg:py-3">
            Deduplicados
            <div className="mt-1 font-semibold">
              {dedupedCount}/{videos.length}
            </div>
          </li>
          <li className="rounded-md border p-2 lg:min-w-38 lg:px-4 lg:py-3">
            Curados
            <div className="mt-1 font-semibold">
              {curatedCount}/{videos.length}
            </div>
          </li>
        </ol>

        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {duplicateCount > 0
              ? `${duplicateCount} vídeos marcados como duplicata. Eles permanecem no banco e entram no dataset consolidado, como no download de cada vídeo.`
              : 'Marque duplicatas da playlist antes de exportar o dataset.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeduplicate}
              disabled={isDeduplicating || completed.length < 2}
            >
              <CopyMinus
                className={
                  isDeduplicating ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'
                }
              />
              {isDeduplicating ? 'Marcando…' : 'Marcar duplicatas da playlist'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCurate}
              disabled={isCurating || dedupedCount === 0}
            >
              <Sparkles
                className={
                  isCurating ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'
                }
              />
              {isCurating
                ? `Curando ${batchProgress ?? '…'}`
                : 'Curar pendentes'}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={dataset}
              onValueChange={(value) => setDataset(value as Dataset)}
            >
              <TabsList className="h-9 max-w-full">
                <TabsTrigger value="raw" className="px-2.5 text-xs sm:text-sm">
                  Bruto
                </TabsTrigger>
                <TabsTrigger
                  value="processed"
                  className="px-2.5 text-xs sm:text-sm"
                >
                  Processado
                </TabsTrigger>
                <TabsTrigger
                  value="curated"
                  className="px-2.5 text-xs sm:text-sm"
                >
                  Curado
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs
              value={format}
              onValueChange={(value) => setFormat(value as DatasetFormat)}
            >
              <TabsList className="h-auto max-w-full flex-wrap">
                {getExportFormats().map((exportFormat) => (
                  <TabsTrigger
                    key={exportFormat.value}
                    value={exportFormat.value}
                    className="px-2.5 text-xs sm:text-sm"
                  >
                    {exportFormat.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <p className="text-muted-foreground text-xs">
            Antes do download: {previewRecordCount} registros,{' '}
            {previewSkippedFailed} vídeos com falha omitidos,{' '}
            {previewSkippedDiscarded} descartes omitidos.
          </p>
          {lastExportCounts && (
            <p className="text-muted-foreground text-xs">
              Último export: {lastExportCounts.recordCount} registros,{' '}
              {lastExportCounts.skippedFailed} vídeos com falha omitidos,{' '}
              {lastExportCounts.skippedDiscarded} descartes omitidos.
            </p>
          )}
          <Button
            variant="outline"
            className="w-full sm:w-fit"
            onClick={handleDatasetExport}
            disabled={isExporting}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Exportar dataset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
