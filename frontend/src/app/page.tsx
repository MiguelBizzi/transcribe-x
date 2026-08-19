import { Header } from '@/components/landing-page/header'
import { Hero } from '@/components/landing-page/hero'
import { Features } from '@/components/landing-page/features'
import { UseCases } from '@/components/landing-page/use-cases'
import { Testimonials } from '@/components/landing-page/testimonials'
import { Cta } from '@/components/landing-page/cta'
import { Footer } from '@/components/landing-page/footer'

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      <Hero />
      <Features />
      <UseCases />
      <Testimonials />
      <Cta />
      <Footer />
    </div>
  )
}
