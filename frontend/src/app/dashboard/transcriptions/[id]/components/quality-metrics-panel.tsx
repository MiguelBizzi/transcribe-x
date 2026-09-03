'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Sparkles, CopyMinus, PenLine } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type {
  LlmCurationData,
  QualityMetrics,
  RewriteMode,
  TranscriptionDetail,
} from '@/app/dashboard/transcribe/data/types'
import {
  curateTranscriptionAction,
  deduplicateTranscriptionAction,
  reprocessTranscriptionAction,
  rewriteTranscriptionAction,
} from '@/app/dashboard/transcribe/data/actions'
import {
  formatPercent,
  formatQualityScore,
  getQualityTone,
} from '@/utils/format-duration'
import { cn } from '@/lib/utils'

interface QualityMetricsPanelProps {
  transcription: TranscriptionDetail
}

function toneClasses(score: number) {
  const tone = getQualityTone(score)
  if (tone === 'good') {
    return {
      text: 'text-green-600 dark:text-green-400',
      bar: '[&_[data-slot=progress-indicator]]:bg-green-500',
    }
  }
  if (tone === 'fair') {
    return {
      text: 'text-amber-600 dark:text-amber-400',
      bar: '[&_[data-slot=progress-indicator]]:bg-amber-500',
    }
  }
  return {
    text: 'text-red-600 dark:text-red-400',
    bar: '[&_[data-slot=progress-indicator]]:bg-red-500',
  }
}

function MetricRow({
  label,
  value,
}: {
  label: string
  value: string | number
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}

function dedupLabel(status: string) {
  if (status === 'duplicate') return 'Duplicata'
  if (status === 'kept') return 'Mantida'
  return 'Pendente'
}

function recommendationLabel(recommendation: LlmCurationData['recommendation']) {
  if (recommendation === 'sft_example') return 'SFT'
  if (recommendation === 'pretraining') return 'Pré-treino'
  return 'Descartar'
}

function QualitySnapshot({
  metrics,
  curation,
}: {
  metrics: QualityMetrics | null
  curation: LlmCurationData | null
}) {
  return (
    <div className="space-y-5">
      {metrics ? (
        <>
          <div className="space-y-2">
            <div className="flex items-end justify-between">
              <span className="text-muted-foreground text-sm">
                Pontuação de qualidade
              </span>
              <span
                className={cn(
                  'text-2xl font-bold',
                  toneClasses(metrics.qualityScore).text,
                )}
              >
                {formatQualityScore(metrics.qualityScore)}
              </span>
            </div>
            <Progress
              value={metrics.qualityScore * 100}
              className={cn('h-2', toneClasses(metrics.qualityScore).bar)}
            />
          </div>
          <MetricsList metrics={metrics} />
        </>
      ) : (
        <p className="text-muted-foreground text-sm">
          Ainda não há métricas de qualidade para esta versão.
        </p>
      )}

      {curation ? (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">Curadoria LLM</span>
            <Badge variant="secondary">
              {recommendationLabel(curation.recommendation)}
            </Badge>
          </div>
          <MetricRow
            label="Coerência"
            value={`${curation.coherence.toFixed(1)}/10`}
          />
          <MetricRow
            label="Riqueza"
            value={`${curation.richness.toFixed(1)}/10`}
          />
          <MetricRow
            label="Factualidade"
            value={`${curation.factuality.toFixed(1)}/10`}
          />
          {curation.rationale && (
            <p className="text-muted-foreground text-xs">{curation.rationale}</p>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">
          A curadoria semântica ainda não foi executada nesta versão.
        </p>
      )}
    </div>
  )
}

function MetricsList({ metrics }: { metrics: QualityMetrics }) {
  return (
    <div className="space-y-3">
      <MetricRow
        label="Ruído removido"
        value={formatPercent(metrics.noiseReductionRate)}
      />
      <MetricRow
        label="TTR (enviesado)"
        value={formatPercent(metrics.lexicalDiversity)}
      />
      {typeof metrics.mattrScore === 'number' && (
        <MetricRow label="MATTR" value={formatPercent(metrics.mattrScore)} />
      )}
      {typeof metrics.mtldScore === 'number' && (
        <MetricRow label="MTLD" value={metrics.mtldScore.toFixed(1)} />
      )}
      <MetricRow
        label="Tamanho médio das frases"
        value={`${metrics.avgSentenceLength} palavras`}
      />
      <MetricRow label="Hesitações removidas" value={metrics.hesitationCount} />
      <MetricRow label="Repetições removidas" value={metrics.repetitionCount} />
      <MetricRow
        label="Marcadores de tempo"
        value={metrics.timestampMarkersRemoved}
      />
      <MetricRow
        label="Idioma"
        value={metrics.detectedLanguage.toUpperCase()}
      />
      <MetricRow
        label="Palavras processadas"
        value={`${metrics.processedWordCount.toLocaleString('pt-BR')} / ${metrics.originalWordCount.toLocaleString('pt-BR')}`}
      />
    </div>
  )
}

export function QualityMetricsPanel({
  transcription,
}: QualityMetricsPanelProps) {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isCurating, setIsCurating] = useState(false)
  const [isDeduplicating, setIsDeduplicating] = useState(false)
  const [isRewriting, setIsRewriting] = useState(false)
  const metrics = transcription.qualityMetrics
  const curation = transcription.llmCurationData
  const hasContent = Boolean(transcription.content?.trim())
  const canRewrite =
    Boolean(curation) && curation?.recommendation !== 'discard'
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>(
    transcription.rewriteMode ||
      (curation?.recommendation === 'sft_example' ? 'sft' : 'pretraining'),
  )

  const handleReprocess = async () => {
    setIsProcessing(true)
    try {
      const result = await reprocessTranscriptionAction({
        id: transcription.id,
      })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (result.validationErrors) {
        throw new Error('ID da transcrição inválido')
      }

      if (!result.data?.success) {
        throw new Error(
          result.data?.message || 'Falha ao processar a transcrição',
        )
      }

      toast.success('Transcrição processada com sucesso')
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao processar a transcrição',
      )
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCurate = async () => {
    setIsCurating(true)
    try {
      const result = await curateTranscriptionAction({
        id: transcription.id,
      })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data?.success) {
        throw new Error(result.data?.message || 'Falha ao curar a transcrição')
      }

      toast.success('Curadoria concluída')
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao curar a transcrição',
      )
    } finally {
      setIsCurating(false)
    }
  }

  const handleDeduplicate = async () => {
    setIsDeduplicating(true)
    try {
      const result = await deduplicateTranscriptionAction({
        id: transcription.id,
      })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data?.success) {
        throw new Error(
          result.data?.message || 'Falha ao deduplicar a transcrição',
        )
      }

      const removed = result.data.sentencesRemoved ?? 0
      toast.success(
        removed > 0
          ? `${removed} segmentos duplicados removidos`
          : 'Nenhuma duplicata encontrada',
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao deduplicar a transcrição',
      )
    } finally {
      setIsDeduplicating(false)
    }
  }

  const handleRewrite = async () => {
    setIsRewriting(true)
    try {
      const result = await rewriteTranscriptionAction({
        id: transcription.id,
        mode: rewriteMode,
      })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data?.success) {
        throw new Error(
          result.data?.message || 'Falha ao reescrever a transcrição',
        )
      }

      toast.success(
        'Reescrita WRAP concluída. Compare as abas Antes e Depois no relatório.',
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao reescrever a transcrição',
      )
    } finally {
      setIsRewriting(false)
    }
  }

  const hasRewriteReport = Boolean(
    transcription.rewrittenQualityMetrics ||
      transcription.rewrittenLlmCurationData,
  )

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Relatório de qualidade</CardTitle>
          <Badge variant="outline">
            {dedupLabel(transcription.deduplicationStatus ?? 'pending')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {hasRewriteReport ? (
          <Tabs defaultValue="after">
            <TabsList className="w-full">
              <TabsTrigger value="before" className="flex-1">
                Antes
              </TabsTrigger>
              <TabsTrigger value="after" className="flex-1">
                Depois
              </TabsTrigger>
            </TabsList>
            <div className="mt-4">
              <TabsContent value="before">
                <QualitySnapshot metrics={metrics} curation={curation} />
              </TabsContent>
              <TabsContent value="after">
                <QualitySnapshot
                  metrics={transcription.rewrittenQualityMetrics}
                  curation={transcription.rewrittenLlmCurationData}
                />
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <QualitySnapshot metrics={metrics} curation={curation} />
        )}

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={handleReprocess}
            disabled={isProcessing || !hasContent}
          >
            <RefreshCw
              className={cn('h-4 w-4', isProcessing && 'animate-spin')}
            />
            {isProcessing ? 'Processando…' : 'Reprocessar'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleDeduplicate}
            disabled={isDeduplicating || !hasContent}
          >
            <CopyMinus
              className={cn('h-4 w-4', isDeduplicating && 'animate-spin')}
            />
            {isDeduplicating ? 'Deduplicando…' : 'Deduplicar segmentos'}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={handleCurate}
            disabled={isCurating || !hasContent}
          >
            <Sparkles className={cn('h-4 w-4', isCurating && 'animate-spin')} />
            {isCurating ? 'Curando…' : 'Curadoria LLM'}
          </Button>
          <div className="space-y-2">
            <Tabs
              value={rewriteMode}
              onValueChange={(value) => setRewriteMode(value as RewriteMode)}
            >
              <TabsList className="w-full">
                <TabsTrigger value="pretraining" className="flex-1">
                  Pré-treino
                </TabsTrigger>
                <TabsTrigger value="sft" className="flex-1">
                  SFT
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              className="w-full"
              onClick={handleRewrite}
              disabled={isRewriting || !canRewrite}
            >
              <PenLine
                className={cn('h-4 w-4', isRewriting && 'animate-spin')}
              />
              {isRewriting ? 'Reescrevendo…' : 'Reescrever (WRAP)'}
            </Button>
            {!canRewrite && (
              <p className="text-muted-foreground text-xs">
                Execute a curadoria LLM antes. Itens marcados como Descartar
                não podem ser reescritos.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
