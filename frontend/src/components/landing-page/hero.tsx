import { Button } from '@/components/ui/button'
import { Play, ArrowRight, CheckCircle } from 'lucide-react'
import heroImage from '@/assets/hero-transcription.jpg'
import Image from 'next/image'
import Link from 'next/link'

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-20">
      {/* Background gradient */}
      <div className="bg-hero absolute inset-0" />

      <div className="relative container mx-auto px-4">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          {/* Left side - Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="bg-primary/10 text-primary inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
                <CheckCircle className="h-4 w-4" />
                Projeto de demonstração acadêmica
              </div>

              <h1 className="text-4xl leading-tight font-bold md:text-5xl lg:text-6xl">
                Transcreva vídeos do YouTube
                <span className="from-primary to-secondary bg-linear-to-br bg-clip-text text-transparent">
                  {' '}
                  em escala
                </span>
              </h1>

              <p className="text-muted-foreground text-xl leading-relaxed">
                Transforme canais inteiros, playlists ou vários vídeos do
                YouTube em transcrições precisas. Feito para pesquisa,
                aprendizado e demonstração de portfólio — sem cobrança
                comercial.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row">
              <Link href="/auth">
                <Button variant="hero" size="xl" className="group">
                  Começar
                  <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Button variant="outline-hero" size="xl" className="group">
                <Play className="h-5 w-5" />
                Ver demonstração
              </Button>
            </div>

            <div className="flex items-center gap-8 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold">50M+</div>
                <div className="text-muted-foreground text-sm">
                  Minutos transcritos
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">99,2%</div>
                <div className="text-muted-foreground text-sm">
                  Taxa de precisão
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold">15s</div>
                <div className="text-muted-foreground text-sm">
                  Processamento médio
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Hero image */}
          <div className="relative">
            <div className="shadow-hero relative overflow-hidden rounded-2xl">
              <Image
                src={heroImage}
                alt="Painel de transcrição de vídeos do YouTube"
                className="h-auto w-full"
              />
              <div className="from-primary/20 absolute inset-0 bg-gradient-to-t to-transparent" />
            </div>

            {/* Floating elements */}
            <div className="shadow-foreground absolute -top-4 -right-4 animate-bounce rounded-lg bg-green-100 p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
                <span className="text-sm font-medium">Processando...</span>
              </div>
            </div>

            <div className="shadow-foreground absolute -bottom-4 -left-4 rounded-lg bg-white p-4">
              <div className="text-muted-foreground text-xs">Pronto para exportar</div>
              <div className="font-medium">transcript.txt</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
