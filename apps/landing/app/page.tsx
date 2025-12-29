import { Button } from "@repo/ui/components/ui/button";
import { Card } from "@repo/ui/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-white to-slate-100">
      {/* Navigation */}
      <nav className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-slate-900">Transcribe-X</div>
          <div className="flex items-center gap-4">
            <Button variant="ghost">Sign In</Button>
            <Button>Get Started</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="mb-6 text-5xl font-bold text-slate-900 md:text-6xl">
          Transform Audio & Video
          <br />
          <span className="bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Into Accurate Transcripts
          </span>
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-xl text-slate-600">
          Powered by advanced AI technology, Transcribe-X delivers fast,
          accurate, and reliable transcription for all your audio and video
          content.
        </p>
        <div className="flex justify-center gap-4">
          <Button size="lg" className="px-8 text-lg">
            Start Transcribing
          </Button>
          <Button size="lg" variant="outline" className="px-8 text-lg">
            Watch Demo
          </Button>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-4xl font-bold text-slate-900">
          Why Choose Transcribe-X?
        </h2>
        <div className="grid gap-8 md:grid-cols-3">
          <Card className="border-2 p-6 transition-colors hover:border-blue-500">
            <div className="mb-4 text-4xl">⚡</div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">
              Lightning Fast
            </h3>
            <p className="text-slate-600">
              Get your transcripts in minutes, not hours. Our AI processes audio
              at incredible speeds.
            </p>
          </Card>
          <Card className="border-2 p-6 transition-colors hover:border-blue-500">
            <div className="mb-4 text-4xl">🎯</div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">
              Highly Accurate
            </h3>
            <p className="text-slate-600">
              State-of-the-art AI models ensure 95%+ accuracy across multiple
              languages and accents.
            </p>
          </Card>
          <Card className="border-2 p-6 transition-colors hover:border-blue-500">
            <div className="mb-4 text-4xl">🔒</div>
            <h3 className="mb-2 text-xl font-semibold text-slate-900">
              Secure & Private
            </h3>
            <p className="text-slate-600">
              Your data is encrypted and secure. We never share your content
              with third parties.
            </p>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20">
        <Card className="bg-linear-to-r from-blue-600 to-purple-600 p-12 text-center text-white">
          <h2 className="mb-4 text-4xl font-bold">Ready to Get Started?</h2>
          <p className="mb-8 text-xl opacity-90">
            Join thousands of users who trust Transcribe-X for their
            transcription needs.
          </p>
          <Button size="lg" variant="secondary" className="px-8 text-lg">
            Start Your Free Trial
          </Button>
        </Card>
      </section>

      {/* Footer */}
      <footer className="container mx-auto border-t border-slate-200 px-4 py-12">
        <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="text-slate-600">
            © 2024 Transcribe-X. All rights reserved.
          </div>
          <div className="flex gap-6 text-slate-600">
            <a href="#" className="transition-colors hover:text-slate-900">
              Privacy
            </a>
            <a href="#" className="transition-colors hover:text-slate-900">
              Terms
            </a>
            <a href="#" className="transition-colors hover:text-slate-900">
              Contact
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
