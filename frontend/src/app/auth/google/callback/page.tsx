'use client'

import { Suspense } from 'react'
import { GoogleCallbackContent } from './google-callback-content'

export default function GoogleCallback() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <GoogleCallbackContent />
    </Suspense>
  )
}
