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
  const hasClean = transcription.isProcessed && Boolean(cleanText)
  const defaultTab = hasClean ? 'clean' : 'raw'

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-3">
        <CardTitle>Transcript</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="raw">Raw</TabsTrigger>
            <TabsTrigger value="clean" disabled={!hasClean}>
              Clean
            </TabsTrigger>
          </TabsList>
          <TabsContent value="raw">
            <pre className="bg-muted/40 mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">
              {rawText || 'No raw transcript content available.'}
            </pre>
          </TabsContent>
          <TabsContent value="clean">
            <pre className="bg-muted/40 mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-lg p-4 text-sm leading-relaxed">
              {cleanText ||
                'This transcription has not been post-processed yet.'}
            </pre>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
