import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle } from 'lucide-react'
import Link from 'next/link'

export function Cta() {
  return (
    <section className="relative overflow-hidden py-20">
      {/* Background gradient */}
      <div className="bg-hero absolute inset-0" />

      <div className="relative container mx-auto px-4">
        <div className="mx-auto max-w-4xl space-y-8 text-center">
          <div className="space-y-4">
            <h2 className="text-3xl leading-tight font-bold md:text-4xl lg:text-5xl">
              Pronto para transformar seu
              <span className="from-primary to-secondary bg-linear-to-br bg-clip-text text-transparent">
                {' '}
                conteúdo do YouTube?
              </span>
            </h2>
            <p className="text-muted-foreground mx-auto max-w-2xl text-xl">
              Explore o TranscribeX como uma demonstração educacional de
              transcrição em lote e fluxos de exportação — sem cobrança.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/auth">
              <Button variant="hero" size="xl" className="group">
                Começar
                <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>

          <div className="flex flex-col items-center justify-center gap-6 pt-8 sm:flex-row">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Demonstração acadêmica
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Sem pagamento
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Comece a transcrever agora
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
