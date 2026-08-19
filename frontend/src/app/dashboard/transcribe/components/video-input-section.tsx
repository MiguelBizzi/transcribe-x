'use client'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Sparkles, Upload, CheckCircle, PlaySquare } from 'lucide-react'
import type { UrlType } from '../data/types'
import { getUrlTypeInfo, getBulkModePlaceholder } from '../data/utils'
import {
  createTranscriptionAction,
  createPlaylistTranscriptionAction,
} from '../data/actions'
import { useState, useCallback } from 'react'
import { toast } from 'sonner'

export function VideoInputSection() {
  const [input, setInput] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [detectedUrls, setDetectedUrls] = useState<string[]>([])
  const [urlType, setUrlType] = useState<UrlType>(null)

  const detectUrls = useCallback((text: string): string[] => {
    const urlRegex =
      /(https?:\/\/(?:www\.)?(?:youtube\.com|youtu\.be)\/[^\s]+)/g
    return text.match(urlRegex) || []
  }, [])

  const getUrlType = useCallback((urls: string[]): UrlType => {
    if (urls.length === 0) return null

    if (urls.some((url) => url.includes('playlist'))) {
      return 'playlist'
    } else if (
      urls.some((url) => url.includes('/c/') || url.includes('/channel/'))
    ) {
      return 'channel'
    } else if (urls.length === 1) {
      return 'video'
    } else {
      return 'mixed'
    }
  }, [])

  const handleInputChange = useCallback(
    (value: string) => {
      setInput(value)
      const urls = detectUrls(value)
      setDetectedUrls(urls)
      setUrlType(getUrlType(urls))
    },
    [detectUrls, getUrlType],
  )

  const handleStartTranscription = useCallback(async () => {
    if (detectedUrls.length === 0) return

    setIsProcessing(true)

    try {
      if (urlType === 'playlist') {
        const playlistUrl = detectedUrls[0]
        const result = await createPlaylistTranscriptionAction({ playlistUrl })

        if (result.data?.success && result.data.playlist) {
          toast.success(
            `Transcrição da playlist iniciada: ${result.data.playlist.title}`,
          )
          if (result.data.result) {
            toast.info(
              `Processando ${result.data.result.totalVideos} vídeos.`,
            )
          }
        } else if (result.serverError) {
          toast.error(result.serverError)
        } else if (result.validationErrors) {
          toast.error('URL da playlist inválida')
        } else {
          toast.error('Não foi possível iniciar a transcrição da playlist')
        }
      } else {
        for (const url of detectedUrls) {
          const result = await createTranscriptionAction({ videoUrl: url })

          if (result.data?.success) {
            toast.success(`Transcrição iniciada para: ${url}`)
          } else if (result.serverError) {
            toast.error(result.serverError)
          } else if (result.validationErrors) {
            toast.error('Dados de entrada inválidos')
          } else {
            toast.error('Não foi possível iniciar a transcrição')
          }
        }
      }

      setInput('')
      setDetectedUrls([])
      setUrlType(null)
    } catch (error) {
      console.error('Error starting transcription:', error)
      toast.error('Não foi possível iniciar o processo de transcrição')
    } finally {
      setIsProcessing(false)
    }
  }, [detectedUrls, urlType])

  const typeInfo = getUrlTypeInfo(urlType)

  return (
    <div className="w-full space-y-6">
      <div className="flex items-center gap-2">
        <div className="bg-primary rounded-lg p-2">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <h2 className="text-xl font-semibold">Entrada de vídeo</h2>
      </div>

      <div className="w-full space-y-6">
        <div className="bg-muted/30 flex items-center justify-between rounded-lg p-4">
          <div>
            <h3 className="font-medium">Modo em lote</h3>
            <p className="text-muted-foreground text-sm">
              Processe várias URLs ao mesmo tempo
            </p>
          </div>
          <Switch checked={bulkMode} onCheckedChange={setBulkMode} />
        </div>

        <div className="w-full space-y-4">
          <Textarea
            placeholder={getBulkModePlaceholder(bulkMode)}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            className="focus:border-primary/50 min-h-[150px] w-full resize-none border-2 transition-colors"
          />

          {typeInfo && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge className={typeInfo.color}>
                  <typeInfo.icon className="mr-1 h-3 w-3" />
                  {typeInfo.label}
                </Badge>
                <span className="text-muted-foreground text-sm">
                  {urlType === 'playlist'
                    ? '1 playlist'
                    : `${detectedUrls.length} URL${detectedUrls.length !== 1 ? 's' : ''} detectada${detectedUrls.length !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          )}
        </div>

        {detectedUrls.length > 0 && (
          <div className="w-full space-y-2">
            <h4 className="text-sm font-medium">
              {urlType === 'playlist' ? 'URL da playlist:' : 'URLs detectadas:'}
            </h4>
            <div className="max-h-40 w-full space-y-2 overflow-y-auto">
              {detectedUrls.map((url, index) => (
                <div
                  key={index}
                  className="bg-muted/50 flex items-center gap-2 rounded-lg p-3 text-sm"
                >
                  {urlType === 'playlist' ? (
                    <PlaySquare className="h-4 w-4 flex-shrink-0 text-blue-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                  )}
                  <span className="truncate font-mono">{url}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <Button
          onClick={handleStartTranscription}
          disabled={detectedUrls.length === 0 || isProcessing}
          className="shadow-elegant h-12 w-full text-lg transition-all hover:shadow-lg"
          size="lg"
        >
          <Upload className="mr-2 h-5 w-5" />
          {isProcessing
            ? 'Processando...'
            : urlType === 'playlist'
              ? 'Iniciar transcrição da playlist'
              : 'Iniciar transcrição'}
        </Button>
      </div>
    </div>
  )
}
