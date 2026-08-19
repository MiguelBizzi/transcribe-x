'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import type {
  QualityMetrics,
  TranscriptionDetail,
} from '@/app/dashboard/transcribe/data/types'
import { reprocessTranscriptionAction } from '@/app/dashboard/transcribe/data/actions'
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

function MetricsList({ metrics }: { metrics: QualityMetrics }) {
  return (
    <div className="space-y-3">
      <MetricRow
        label="Ruído removido"
        value={formatPercent(metrics.noiseReductionRate)}
      />
      <MetricRow
        label="Diversidade lexical"
        value={formatPercent(metrics.lexicalDiversity)}
      />
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
  const metrics = transcription.qualityMetrics
  const hasContent = Boolean(transcription.content?.trim())

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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Relatório de qualidade</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
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
            Ainda não há métricas de qualidade. Execute o pós-processamento
            para gerar o relatório.
          </p>
        )}

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
      </CardContent>
    </Card>
  )
}
