'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Video, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function RedirectComponents() {
  const router = useRouter()

  return (
    <div className="mb-8">
      <Card
        className="hover:shadow-elegant group cursor-pointer transition-all duration-300"
        onClick={() => router.push('/dashboard/transcribe')}
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <div className="bg-primary group-hover:shadow-glow rounded-lg p-3 transition-all duration-300">
              <Video className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-xl">Transcrever vídeos</div>
              <div className="text-muted-foreground text-sm font-normal">
                Serviço de transcrição em lote
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Transcreva vídeos avulsos, playlists ou canais inteiros em lote.
            Baixe em vários formatos (TXT, PDF, DOCX, JSON).
          </p>
          <Button className="w-full" variant="outline" size="lg">
            Começar a transcrever
            <Upload className="h-4 w-4 transition-transform group-hover:translate-y-[-2px]" />
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
