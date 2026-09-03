'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { TranscriptionDetail } from '@/app/dashboard/transcribe/data/types'
import { resolveTranscriptText } from '@/app/dashboard/transcribe/data/export-transcript'

interface TranscriptContentProps {
  transcription: TranscriptionDetail
}

export function TranscriptContent({ transcription }: TranscriptContentProps) {
  const rawText = resolveTranscriptText(
    transcription.content,
    transcription.timestamps,
  )
  const cleanText = transcription.processedContent?.trim() || ''
  const rewrittenText = transcription.rewrittenContent?.trim() || ''
  const pairs = transcription.rewriteData?.pairs ?? []
  const hasClean = transcription.isProcessed && Boolean(cleanText)
  const hasRewritten = Boolean(rewrittenText)
  const defaultTab = hasRewritten ? 'rewritten' : hasClean ? 'clean' : 'raw'

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle>Transcrição</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="raw">Original</TabsTrigger>
            <TabsTrigger value="clean" disabled={!hasClean}>
              Processado
            </TabsTrigger>
            <TabsTrigger value="rewritten" disabled={!hasRewritten}>
              Reescrito
            </TabsTrigger>
          </TabsList>
          <TabsContent value="raw">
            <pre className="bg-muted/40 mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">
              {rawText || 'Nenhum conteúdo original disponível.'}
            </pre>
          </TabsContent>
          <TabsContent value="clean">
            <pre className="bg-muted/40 mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">
              {cleanText ||
                'Esta transcrição ainda não foi pós-processada.'}
            </pre>
          </TabsContent>
          <TabsContent value="rewritten">
            {transcription.rewriteMode === 'sft' && pairs.length > 0 ? (
              <div className="mt-3 max-h-[32rem] space-y-4 overflow-auto">
                {pairs.map((pair, index) => (
                  <div
                    key={`${index}-${pair.instruction.slice(0, 24)}`}
                    className="bg-muted/40 rounded-lg p-4"
                  >
                    <p className="text-sm font-medium">{pair.instruction}</p>
                    <p className="mt-2 text-sm leading-relaxed whitespace-pre-wrap">
                      {pair.output}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <pre className="bg-muted/40 mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">
                {rewrittenText ||
                  'Execute a reescrita WRAP após a curadoria para gerar este texto.'}
              </pre>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
