import { useCases } from '@/constants/use-cases'

export function UseCases() {
  return (
    <section className="bg-muted/30 py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="mb-6 text-3xl font-bold md:text-4xl">
            What You Can Do With It
          </h2>
          <p className="text-muted-foreground text-xl leading-relaxed">
            From AI training to content creation, our transcription tool
            empowers professionals across industries to unlock the value hidden
            in video content.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {useCases.map((useCase, index) => (
            <div
              key={index}
              className="group bg-background border-border hover:shadow-hero rounded-2xl border p-8 transition-all duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start gap-4">
                <div className="from-primary to-secondary group-hover:shadow-glow rounded-xl bg-linear-to-br p-3 transition-all duration-300">
                  <useCase.icon className="h-6 w-6 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="group-hover:text-primary mb-3 text-xl font-semibold transition-colors">
                    {useCase.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {useCase.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <div className="bg-primary/10 border-primary/20 inline-flex items-center gap-2 rounded-full border px-6 py-3">
            <span className="text-sm font-medium">💡 Pro Tip:</span>
            <span className="text-muted-foreground text-sm">
              Combine multiple export formats to maximize your content&apos;s
              potential across different platforms
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
