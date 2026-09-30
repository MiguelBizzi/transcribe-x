'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CopyMinus, Download, Loader2, Sparkles, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  ExportFormat,
  PlaylistDetail,
  RewriteMode,
} from '@/app/dashboard/transcribe/data/types'
import {
  curateTranscriptionAction,
  deduplicatePlaylistAction,
  exportFineTuningAction,
  rewriteTranscriptionAction,
} from '@/app/dashboard/transcribe/data/actions'
import { getExportFormats } from '@/app/dashboard/transcribe/data/utils'
import {
  downloadTranscript,
  playlistToPayload,
} from '@/app/dashboard/transcribe/data/export-transcript'

interface PlaylistCurationPanelProps {
  playlist: PlaylistDetail
}

type Dataset = 'raw' | 'processed' | 'curated' | 'rewritten'
type ExportKind = 'text' | 'dataset'
type TextSource = 'raw' | 'clean'

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
  const videos = playlist.transcriptions
  const completed = videos.filter((video) => video.status === 'COMPLETED')
  const processedCount = videos.filter((video) => video.isProcessed).length
  const dedupedCount = videos.filter(
    (video) => video.deduplicationStatus !== 'pending',
  ).length
  const curatedCount = videos.filter(
    (video) => video.llmCurationScore != null,
  ).length
  const rewrittenCount = videos.filter((video) =>
    Boolean(video.rewrittenContent?.trim()),
  ).length
  const duplicateCount = videos.filter(
    (video) => video.deduplicationStatus === 'duplicate',
  ).length

  const [isDeduplicating, setIsDeduplicating] = useState(false)
  const [isCurating, setIsCurating] = useState(false)
  const [isRewriting, setIsRewriting] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [pendingFormat, setPendingFormat] = useState<ExportFormat | null>(null)
  const [exportKind, setExportKind] = useState<ExportKind>('dataset')
  const [dataset, setDataset] = useState<Dataset>(
    rewrittenCount > 0
      ? 'rewritten'
      : curatedCount > 0
        ? 'curated'
        : processedCount > 0
          ? 'processed'
          : 'raw',
  )
  const [format, setFormat] = useState<'jsonl' | 'csv' | 'json'>('jsonl')
  const [textSource, setTextSource] = useState<TextSource>(
    processedCount > 0 ? 'clean' : 'raw',
  )
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>('pretraining')
  const [batchProgress, setBatchProgress] = useState<string | null>(null)
  const [lastExportCounts, setLastExportCounts] = useState<{
    recordCount: number
    skippedDuplicates: number
    skippedDiscarded: number
  } | null>(null)
  const discardedCount = videos.filter(
    (video) => video.llmCurationData?.recommendation === 'discard',
  ).length
  const previewSkippedDuplicates = duplicateCount
  const previewSkippedDiscarded =
    dataset === 'curated' || dataset === 'rewritten' ? discardedCount : 0
  const previewRecordCount = videos.filter((video) => {
    if (video.status !== 'COMPLETED') return false
    if (video.deduplicationStatus === 'duplicate') return false
    if (
      (dataset === 'curated' || dataset === 'rewritten') &&
      video.llmCurationData?.recommendation === 'discard'
    ) {
      return false
    }
    if (dataset === 'curated' && video.llmCurationScore == null) return false
    if (dataset === 'rewritten' && !video.rewrittenContent?.trim()) return false
    return true
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
        `${result.data.duplicateCount} duplicatas marcadas, ${result.data.keptCount} mantidas. Os vídeos continuam no banco e saem do export por padrão.`,
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

  const handleRewrite = async () => {
    const pending = videos.filter((video) => {
      if (video.status !== 'COMPLETED') return false
      if (video.deduplicationStatus === 'duplicate') return false
      if (!video.llmCurationData) return false
      if (video.llmCurationData.recommendation === 'discard') return false
      if (video.rewrittenContent?.trim()) return false
      return true
    })
    if (pending.length === 0) {
      toast.info('Nenhum vídeo aprovado pendente de reescrita.')
      return
    }

    setIsRewriting(true)
    let rewritten = 0
    let failed = 0
    try {
      for (const [index, video] of pending.entries()) {
        setBatchProgress(`${index + 1}/${pending.length}`)
        const result = await rewriteTranscriptionAction({
          id: video.id,
          mode: rewriteMode,
        })
        if (result.serverError || !result.data?.success) {
          failed += 1
          continue
        }
        rewritten += 1
      }
      toast.success(
        `${rewritten} reescritos, ${videos.length - pending.length} ignorados, ${failed} falhas`,
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao reescrever a playlist',
      )
    } finally {
      setBatchProgress(null)
      setIsRewriting(false)
    }
  }

  const handleDatasetExport = async () => {
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

      setLastExportCounts({
        recordCount: result.data.recordCount,
        skippedDuplicates: result.data.skippedDuplicates,
        skippedDiscarded: result.data.skippedDiscarded,
      })
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

  const handleTextExport = (exportFormat: ExportFormat) => {
    setPendingFormat(exportFormat)
    try {
      downloadTranscript(
        playlistToPayload(playlist, { useProcessed: textSource === 'clean' }),
        exportFormat,
      )
      toast.success(`${exportFormat} baixado`)
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao baixar a transcrição da playlist',
      )
    } finally {
      setPendingFormat(null)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Curadoria e exportação</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="grid grid-cols-4 gap-2 text-center text-xs lg:flex lg:w-fit lg:gap-3">
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
          <li className="rounded-md border p-2 lg:min-w-38 lg:px-4 lg:py-3">
            Reescritos
            <div className="mt-1 font-semibold">
              {rewrittenCount}/{videos.length}
            </div>
          </li>
        </ol>

        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-sm">
            {duplicateCount > 0
              ? `${duplicateCount} vídeos marcados como duplicata. Eles permanecem no banco e saem do dataset por padrão.`
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
                className={isDeduplicating ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
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
                className={isCurating ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              />
              {isCurating
                ? `Curando ${batchProgress ?? '…'}`
                : 'Curar pendentes'}
            </Button>
            <Tabs
              value={rewriteMode}
              onValueChange={(value) => setRewriteMode(value as RewriteMode)}
            >
              <TabsList>
                <TabsTrigger value="pretraining">Pré-treino</TabsTrigger>
                <TabsTrigger value="sft">SFT</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRewrite}
              disabled={isRewriting || curatedCount === 0}
            >
              <PenLine
                className={isRewriting ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'}
              />
              {isRewriting
                ? `Reescrevendo ${batchProgress ?? '…'}`
                : 'Reescrever aprovados'}
            </Button>
          </div>
        </div>

        <Tabs
          value={exportKind}
          onValueChange={(value) => setExportKind(value as ExportKind)}
        >
          <TabsList className="h-9 w-full max-w-md">
            <TabsTrigger value="text" className="px-3">
              Baixar texto
            </TabsTrigger>
            <TabsTrigger value="dataset" className="px-3">
              Dataset para treino
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {exportKind === 'text' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs
              value={textSource}
              onValueChange={(value) => setTextSource(value as TextSource)}
            >
              <TabsList>
                <TabsTrigger value="raw">Original</TabsTrigger>
                <TabsTrigger value="clean" disabled={processedCount === 0}>
                  Processado
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap gap-2">
              {getExportFormats().map((exportFormat) => (
                <Button
                  key={exportFormat}
                  variant="outline"
                  size="sm"
                  onClick={() => handleTextExport(exportFormat)}
                  disabled={pendingFormat !== null}
                >
                  {pendingFormat === exportFormat ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {exportFormat}
                </Button>
              ))}
            </div>
          </div>
        ) : (
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
                  <TabsTrigger
                    value="rewritten"
                    className="px-2.5 text-xs sm:text-sm"
                  >
                    Reescrito
                  </TabsTrigger>
                </TabsList>
              </Tabs>
              <Tabs
                value={format}
                onValueChange={(value) => setFormat(value as 'jsonl' | 'csv' | 'json')}
              >
                <TabsList>
                  <TabsTrigger value="jsonl">JSONL</TabsTrigger>
                  <TabsTrigger value="csv">CSV</TabsTrigger>
                  <TabsTrigger value="json">JSON</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <p className="text-muted-foreground text-xs">
              Antes do download: {previewRecordCount} registros,{' '}
              {previewSkippedDuplicates} duplicatas omitidas,{' '}
              {previewSkippedDiscarded} descartes omitidos.
            </p>
            {lastExportCounts && (
              <p className="text-muted-foreground text-xs">
                Último export: {lastExportCounts.recordCount} registros,{' '}
                {lastExportCounts.skippedDuplicates} duplicatas omitidas,{' '}
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
        )}
      </CardContent>
    </Card>
  )
}
