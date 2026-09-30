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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
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

const PIPELINE_STEPS = [
  'extracted',
  'processed',
  'deduplicated',
  'curated',
  'rewritten',
] as const

type PipelineStep = (typeof PIPELINE_STEPS)[number]

const STEP_LABELS: Record<PipelineStep, string> = {
  extracted: 'Extraído',
  processed: 'Processado',
  deduplicated: 'Deduplicado',
  curated: 'Curado',
  rewritten: 'Reescrito',
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
  hint,
}: {
  label: string
  value: string | number
  hint?: string
}) {
  const content = (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground underline-offset-4">
        {hint ? <span className="decoration-dotted underline">{label}</span> : label}
      </span>
      <span className="font-medium">{value}</span>
    </div>
  )

  if (!hint) {
    return content
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="w-full text-left">
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  )
}

function dedupLabel(status: string) {
  if (status === 'duplicate') return 'Duplicata'
  if (status === 'kept') return 'Segmentos únicos'
  return 'Pendente'
}

function recommendationLabel(recommendation: LlmCurationData['recommendation']) {
  if (recommendation === 'sft_example') return 'SFT'
  if (recommendation === 'pretraining') return 'Pré-treino'
  return 'Descartar'
}

function pipelineState(transcription: TranscriptionDetail): {
  completed: PipelineStep[]
  current: PipelineStep
} {
  const extracted = Boolean(transcription.content?.trim())
  const processed = Boolean(transcription.isProcessed)
  const deduplicated = transcription.deduplicationStatus !== 'pending'
  const curated = Boolean(transcription.llmCurationData)
  const rewritten = Boolean(transcription.rewrittenContent?.trim())
  const completed: PipelineStep[] = []
  if (extracted) completed.push('extracted')
  if (processed) completed.push('processed')
  if (deduplicated) completed.push('deduplicated')
  if (curated) completed.push('curated')
  if (rewritten) completed.push('rewritten')

  const current =
    PIPELINE_STEPS.find((step) => !completed.includes(step)) ?? 'rewritten'
  return { completed, current }
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
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">MATTR</p>
              <p className="text-lg font-semibold">
                {typeof metrics.mattrScore === 'number'
                  ? formatPercent(metrics.mattrScore)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">MTLD</p>
              <p className="text-lg font-semibold">
                {typeof metrics.mtldScore === 'number'
                  ? metrics.mtldScore.toFixed(1)
                  : '—'}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Score interno</p>
              <p
                className={cn(
                  'text-lg font-semibold',
                  toneClasses(metrics.qualityScore).text,
                )}
              >
                {formatQualityScore(metrics.qualityScore)}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Progress
              value={metrics.qualityScore * 100}
              className={cn('h-2', toneClasses(metrics.qualityScore).bar)}
            />
            <p className="text-muted-foreground text-xs">
              Score interno heurístico (não calibrado). Use MATTR, MTLD e o
              juiz LLM como evidência.
            </p>
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
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Coerência</p>
              <p className="text-lg font-semibold">
                {curation.coherence.toFixed(1)}/10
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Riqueza</p>
              <p className="text-lg font-semibold">
                {curation.richness.toFixed(1)}/10
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground text-xs">Factualidade</p>
              <p className="text-lg font-semibold">
                {curation.factuality.toFixed(1)}/10
              </p>
            </div>
          </div>
          {typeof curation.chunkCount === 'number' && curation.chunkCount > 0 && (
            <p className="text-muted-foreground text-xs">
              Julgado em {curation.chunkCount} trecho
              {curation.chunkCount === 1 ? '' : 's'}
            </p>
          )}
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
        hint="Cai em textos longos mesmo com vocabulário rico. Não entra no score interno."
      />
      {typeof metrics.mattrScore === 'number' && (
        <MetricRow
          label="MATTR"
          value={formatPercent(metrics.mattrScore)}
          hint="Type-token em janela móvel de 50 palavras, menos sensível ao comprimento."
        />
      )}
      {typeof metrics.mtldScore === 'number' && (
        <MetricRow
          label="MTLD"
          value={metrics.mtldScore.toFixed(1)}
          hint="Diversidade lexical por fatores de TTR (limiar 0,72), média bidirecional."
        />
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
  const rawMetrics = transcription.rawQualityMetrics
  const curation = transcription.llmCurationData
  const hasContent = Boolean(transcription.content?.trim())
  const hasDedup = transcription.deduplicationStatus !== 'pending'
  const isDuplicate = transcription.deduplicationStatus === 'duplicate'
  const hasRewrite = Boolean(transcription.rewrittenContent?.trim())
  const canCurate = hasContent && hasDedup && !isDuplicate
  const canRewrite =
    Boolean(curation) &&
    curation?.recommendation !== 'discard' &&
    !isDuplicate
  const canDedup = hasContent && !hasRewrite
  const { completed, current } = pipelineState(transcription)
  const [rewriteMode, setRewriteMode] = useState<RewriteMode>(
    transcription.rewriteMode ||
      (curation?.recommendation === 'sft_example' ? 'sft' : 'pretraining'),
  )

  const handleReprocess = async () => {
    if (
      (hasRewrite || Boolean(curation) || hasDedup) &&
      !window.confirm(
        'Reprocessar apaga deduplicação, curadoria e reescrita desta transcrição. Continuar?',
      )
    ) {
      return
    }

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

      toast.success('Transcrição reprocessada. Etapas seguintes foram zeradas.')
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
          result.data?.message || 'Falha ao remover segmentos duplicados',
        )
      }

      const removed = result.data.sentencesRemoved ?? 0
      toast.success(
        removed > 0
          ? `${removed} sentenças duplicadas removidas do texto processado`
          : 'Nenhuma sentença duplicada encontrada',
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao remover segmentos duplicados',
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
        'Reescrita WRAP concluída. Compare as abas Bruto, Processado e Reescrito.',
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

  const defaultMetricsTab = hasRewrite
    ? 'rewritten'
    : metrics
      ? 'processed'
      : 'raw'

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
        <ol className="relative grid grid-cols-5 gap-1 lg:gap-0">
          <span
            aria-hidden
            className="bg-border absolute top-4 right-[10%] left-[10%] hidden h-px lg:block"
          />
          {PIPELINE_STEPS.map((step, index) => {
            const isDone = completed.includes(step)
            const isCurrent = current === step
            return (
              <li
                key={step}
                className={cn(
                  'rounded-md border px-1 py-2 text-center text-[10px] leading-tight',
                  'lg:relative lg:flex lg:flex-col lg:items-center lg:gap-2 lg:rounded-none lg:border-0 lg:bg-transparent lg:px-1 lg:py-0 lg:text-xs',
                  isDone && 'border-green-600/40 bg-green-500/10 lg:bg-transparent',
                  isCurrent &&
                    !isDone &&
                    'border-primary bg-primary/10 font-medium lg:bg-transparent',
                  !isDone && !isCurrent && 'text-muted-foreground',
                )}
              >
                <span
                  className={cn(
                    'relative z-10 hidden h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold lg:flex',
                    isDone &&
                      'border-green-600/50 bg-green-500/15 text-green-700 dark:text-green-400',
                    isCurrent &&
                      !isDone &&
                      'border-primary bg-primary text-primary-foreground',
                    !isDone && !isCurrent && 'border-border bg-background',
                  )}
                >
                  {isDone ? '✓' : index + 1}
                </span>
                <span className="lg:max-w-22 lg:leading-snug">
                  {STEP_LABELS[step]}
                </span>
              </li>
            )
          })}
        </ol>

        <Tabs defaultValue={defaultMetricsTab}>
          <TabsList className="grid h-9 w-full grid-cols-3">
            <TabsTrigger value="raw" className="px-1.5 text-xs sm:text-sm">
              Bruto
            </TabsTrigger>
            <TabsTrigger
              value="processed"
              className="px-1.5 text-xs sm:text-sm"
              disabled={!metrics}
            >
              Processado
            </TabsTrigger>
            <TabsTrigger
              value="rewritten"
              className="px-1.5 text-xs sm:text-sm"
              disabled={!hasRewrite}
            >
              Reescrito
            </TabsTrigger>
          </TabsList>
          <div className="mt-4">
            <TabsContent value="raw">
              <QualitySnapshot metrics={rawMetrics} curation={null} />
            </TabsContent>
            <TabsContent value="processed">
              <QualitySnapshot metrics={metrics} curation={curation} />
            </TabsContent>
            <TabsContent value="rewritten">
              <QualitySnapshot
                metrics={transcription.rewrittenQualityMetrics}
                curation={transcription.rewrittenLlmCurationData}
              />
            </TabsContent>
          </div>
        </Tabs>

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
            variant={current === 'deduplicated' ? 'default' : 'outline'}
            className="w-full"
            onClick={handleDeduplicate}
            disabled={isDeduplicating || !canDedup}
          >
            <CopyMinus
              className={cn('h-4 w-4', isDeduplicating && 'animate-spin')}
            />
            {isDeduplicating
              ? 'Removendo segmentos…'
              : 'Remover segmentos duplicados'}
          </Button>
          {!canDedup && hasRewrite && (
            <p className="text-muted-foreground text-xs">
              Reprocesse para invalidar a reescrita antes de remover segmentos.
            </p>
          )}
          <Button
            variant={current === 'curated' ? 'default' : 'outline'}
            className="w-full"
            onClick={handleCurate}
            disabled={isCurating || !canCurate}
          >
            <Sparkles className={cn('h-4 w-4', isCurating && 'animate-spin')} />
            {isCurating ? 'Curando…' : 'Curadoria LLM'}
          </Button>
          {!hasDedup && (
            <p className="text-muted-foreground text-xs">
              Remova segmentos duplicados antes da curadoria.
            </p>
          )}
          <div className="space-y-2">
            <Tabs
              value={rewriteMode}
              onValueChange={(value) => setRewriteMode(value as RewriteMode)}
            >
              <TabsList className="grid h-9 w-full grid-cols-2">
                <TabsTrigger value="pretraining" className="px-2 text-xs sm:text-sm">
                  Pré-treino
                </TabsTrigger>
                <TabsTrigger value="sft" className="px-2 text-xs sm:text-sm">
                  SFT
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Button
              variant={current === 'rewritten' ? 'default' : 'outline'}
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
                {isDuplicate
                  ? 'Vídeos marcados como duplicata não são reescritos.'
                  : 'Execute a curadoria LLM antes. Itens marcados como Descartar não podem ser reescritos.'}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
