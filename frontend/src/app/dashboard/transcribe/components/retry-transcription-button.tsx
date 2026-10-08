'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { retryTranscriptionAction } from '../data/actions'

interface RetryTranscriptionButtonProps {
  id: string
  label?: string
}

export function RetryTranscriptionButton({
  id,
  label = 'Tentar novamente',
}: RetryTranscriptionButtonProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleRetry = async () => {
    setPending(true)
    try {
      const result = await retryTranscriptionAction({ id })

      if (result.serverError) {
        throw new Error(result.serverError)
      }

      if (!result.data?.success) {
        throw new Error(result.data?.message || 'Falha ao tentar novamente')
      }

      toast.success('Nova tentativa iniciada')
      router.refresh()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Falha ao tentar novamente a transcrição',
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
      {label}
    </Button>
  )
}
