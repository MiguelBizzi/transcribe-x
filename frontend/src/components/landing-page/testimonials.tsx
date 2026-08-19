import { Card, CardContent } from '@/components/ui/card'
import { Star, Quote } from 'lucide-react'
import { testimonials } from '@/constants/testimonials'

export function Testimonials() {
  return (
    <section id="testimonials" className="bg-background-secondary py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 space-y-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Confiado por
            <span className="from-primary to-secondary bg-linear-to-br bg-clip-text text-transparent">
              {' '}
              profissionais no mundo todo
            </span>
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Junte-se a milhares de pesquisadores, criadores de conteúdo e
            profissionais de IA que confiam no TranscribeX
          </p>

          <div className="mt-6 flex items-center justify-center gap-2">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5 fill-current text-yellow-400"
                />
              ))}
            </div>
            <span className="text-muted-foreground ml-2 text-sm">
              4,9/5 em mais de 2.000 avaliações
            </span>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <Card
              key={index}
              className="group hover:shadow-hero transition-all duration-300 hover:-translate-y-1"
            >
              <CardContent className="flex h-full flex-col p-6 py-2">
                <div className="flex-grow space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="mb-2 flex items-center gap-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4 fill-current text-yellow-400"
                        />
                      ))}
                    </div>
                    <Quote className="text-primary/20 h-8 w-8" />
                  </div>
                  <div className="relative">
                    <p className="text-muted-foreground leading-relaxed italic">
                      &quot;{testimonial.content}&quot;
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 border-t pt-4">
                  <div className="from-primary to-secondary flex h-10 w-10 items-center justify-center rounded-full bg-linear-to-br text-sm font-semibold text-white">
                    {testimonial.avatar}
                  </div>
                  <div>
                    <div className="font-semibold">{testimonial.name}</div>
                    <div className="text-muted-foreground text-sm">
                      {testimonial.role} em {testimonial.company}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
