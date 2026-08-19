'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { handleGoogleCallback } from '@/services/auth-service'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Loader2, CheckCircle, XCircle } from 'lucide-react'

export function GoogleCallbackContent() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  )
  const [errorMessage, setErrorMessage] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const processCallback = async () => {
      try {
        const code = searchParams.get('code')

        if (!code) {
          setStatus('error')
          setErrorMessage('No authorization code received from Google')
          return
        }

        // Process the Google OAuth callback using the auth service
        const response = await handleGoogleCallback(code)

        console.log('handleGoogleCallback', response)

        setStatus('success')

        // Redirect to dashboard after successful authentication
        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      } catch (error) {
        console.error('Google OAuth callback error:', error)
        setStatus('error')
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Failed to authenticate with Google',
        )
      }
    }

    processCallback()
  }, [searchParams, router])

  if (status === 'loading') {
    return (
      <div className="from-background to-background/80 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Authenticating with Google</CardTitle>
            <CardDescription>
              Please wait while we complete your authentication...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === 'success') {
    return (
      <div className="from-background to-background/80 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="flex items-center justify-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-600" />
              Authentication Successful
            </CardTitle>
            <CardDescription>
              You have been successfully authenticated with Google. Redirecting
              to dashboard...
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center">
              <Loader2 className="text-primary h-6 w-6 animate-spin" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="from-background to-background/80 flex min-h-screen items-center justify-center bg-gradient-to-br p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle className="flex items-center justify-center gap-2">
            <XCircle className="h-6 w-6 text-red-600" />
            Authentication Failed
          </CardTitle>
          <CardDescription>{errorMessage}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Please try again or contact support if the problem persists.
          </p>
          <button
            onClick={() => router.push('/auth')}
            className="text-primary hover:text-primary/80 text-sm underline"
          >
            Return to login page
          </button>
        </CardContent>
      </Card>
    </div>
  )
}
