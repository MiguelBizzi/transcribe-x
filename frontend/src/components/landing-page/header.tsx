import { Button } from '@/components/ui/button'
import { Video } from 'lucide-react'
import Link from 'next/link'

export function Header() {
  return (
    <header className="bg-background/80 fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="from-primary to-secondary rounded-lg bg-linear-to-br p-2">
            <Video className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">TranscribeX</span>
        </div>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#features"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Features
          </a>
          <a
            href="#testimonials"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Reviews
          </a>
        </nav>

        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/auth">Sign In</Link>
          </Button>
          <Button variant="default" size="sm" asChild>
            <Link href="/auth">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
