'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { retryFailedPlaylistAction } from '../data/actions'

interface RetryFailedPlaylistButtonProps {
  playlistId: string
}

export function RetryFailedPlaylistButton({
  playlistId,
}: RetryFailedPlaylistButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleRetry = async () => {
    setPending(true)
    try {
      const result = await retryFailedPlaylistAction({ id: playlistId })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data?.success) {
        throw new Error(result.data?.message || 'Falha ao tentar novamente')
      }

      toast.success(
        result.data.retried
          ? `Nova tentativa iniciada para ${result.data.retried} vídeos`
          : 'Nova tentativa iniciada',
      )
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao tentar novamente os vídeos com erro',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="text-xs"
      onClick={handleRetry}
      disabled={pending}
    >
      {pending ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : (
        <RefreshCw className="mr-1 h-3 w-3" />
      )}
      Tentar novamente os que falharam
    </Button>
  )
}
