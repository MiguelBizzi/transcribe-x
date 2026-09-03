'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, PlaySquare } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PlaylistJobsAccordionProps {
  title: string
  thumbnail: string | null
  playlistHref: string
  videoCount: number
  completedCount: number
  children: React.ReactNode
}

export function PlaylistJobsAccordion({
  title,
  thumbnail,
  playlistHref,
  videoCount,
  completedCount,
  children,
}: PlaylistJobsAccordionProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className={cn(
        'bg-muted/30 w-full overflow-hidden rounded-lg transition-colors',
        open && 'ring-border ring-1',
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="hover:bg-muted/50 flex w-full items-start gap-4 p-6 text-left transition-colors"
        aria-expanded={open}
      >
        <div className="relative shrink-0">
          {thumbnail ? (
            <img
              src={thumbnail}
              alt={title}
              className="h-16 w-24 rounded-md object-cover"
            />
          ) : (
            <div className="flex h-16 w-24 items-center justify-center rounded-md bg-blue-100 dark:bg-blue-900">
              <PlaySquare className="h-8 w-8 text-blue-500" />
            </div>
          )}
          <div className="absolute -right-1 -bottom-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {videoCount}
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            Playlist
          </p>
          <h3 className="truncate font-semibold">{title}</h3>
          <p className="text-muted-foreground text-sm">
            {videoCount} {videoCount === 1 ? 'vídeo' : 'vídeos'}
          </p>
        </div>

        <Badge variant="outline" className="mt-1 shrink-0 text-xs">
          {completedCount} / {videoCount} concluídos
        </Badge>

        <ChevronDown
          className={cn(
            'text-muted-foreground mt-1 h-5 w-5 shrink-0 transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>

      {open && (
        <div className="space-y-3 border-t px-4 py-4">
          <div className="flex justify-end">
            <Link
              href={playlistHref}
              className="text-primary text-xs font-medium hover:underline"
            >
              Ver playlist
            </Link>
          </div>
          {children}
        </div>
      )}
    </div>
  )
}
