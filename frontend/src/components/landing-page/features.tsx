import { Card, CardContent } from '@/components/ui/card'
import { features } from '@/constants/features'

export function Features() {
  return (
    <section id="features" className="bg-background-secondary py-20">
      <div className="container mx-auto px-4">
        <div className="mb-16 space-y-4 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Everything you need for
            <span className="from-primary to-secondary bg-linear-to-br bg-clip-text text-transparent">
              {' '}
              YouTube transcription
            </span>
          </h2>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Powerful features designed for AI trainers, researchers, content
            creators, and data professionals
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((feature, index) => (
            <Card
              key={index}
              className="group hover:shadow-hero relative transition-all duration-300 hover:-translate-y-1"
            >
              {feature.highlight && (
                <div className="from-primary to-secondary absolute -top-3 left-4 rounded-full bg-linear-to-br px-3 py-1 text-xs font-medium text-white">
                  {feature.highlight}
                </div>
              )}

              <CardContent className="space-y-4 p-6">
                <div className="bg-primary/10 w-fit rounded-lg p-3">
                  <feature.icon className="text-primary h-6 w-6" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
