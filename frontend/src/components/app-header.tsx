'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { FileText, Home, Menu, Video } from 'lucide-react'

import { ModeToggle } from './mode-toggle'
import { NavUser } from './nav-user'
import { Button } from './ui/button'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './ui/sheet'
import { cn } from '@/lib/utils'
import type { User } from '@/services/auth-service'

const items = [
  {
    title: 'Início',
    url: '/dashboard',
    icon: Home,
  },
  {
    title: 'Transcrever',
    url: '/dashboard/transcribe',
    icon: FileText,
  },
]

type AppHeaderProps = {
  user: User
}

function isActivePath(pathname: string, url: string) {
  if (url === '/dashboard') {
    return pathname === '/dashboard'
  }

  return pathname === url || pathname.startsWith(`${url}/`)
}

function BrandMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="from-primary to-secondary rounded-lg bg-linear-to-br p-1.5">
        <Video className="h-4 w-4 text-white" />
      </div>
      <span className="text-lg font-semibold tracking-tight">TranscribeX</span>
    </div>
  )
}

export function AppHeader({ user }: AppHeaderProps) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const avatarUrl =
    user.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'Usuário')}&background=random`

  return (
    <header className="bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              aria-label="Abrir navegação"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b px-4 py-4 pr-12">
              <SheetTitle>
                <BrandMark />
              </SheetTitle>
              <SheetDescription className="sr-only">
                Navegar entre as páginas do painel
              </SheetDescription>
            </SheetHeader>
            <nav aria-label="Menu" className="flex flex-col gap-1 p-3">
              {items.map((item) => {
                const active = isActivePath(pathname, item.url)

                return (
                  <Link
                    key={item.url}
                    href={item.url}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.title}
                  </Link>
                )
              })}
            </nav>
          </SheetContent>
        </Sheet>

        <Link
          href="/dashboard"
          className="flex items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <BrandMark />
        </Link>

        <nav
          aria-label="Principal"
          className="ml-2 hidden items-center rounded-lg bg-muted/50 p-1 md:flex"
        >
          {items.map((item) => {
            const active = isActivePath(pathname, item.url)

            return (
              <Link
                key={item.url}
                href={item.url}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ModeToggle />
          <NavUser user={{ ...user, avatar: avatarUrl }} />
        </div>
      </div>
    </header>
  )
}
