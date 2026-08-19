import { CardContent } from '@/components/ui/card'
import { Video, XCircle } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description: string
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <CardContent>
      <div className="py-8 text-center">
        <div className="bg-muted/50 mx-auto mb-4 w-fit rounded-full p-4">
          <Video className="text-muted-foreground h-8 w-8" />
        </div>
        <p className="text-muted-foreground">{title}</p>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
    </CardContent>
  )
}

interface ErrorStateProps {
  message: string
}

export function ErrorState({ message }: ErrorStateProps) {
  return (
    <CardContent>
      <div className="py-8 text-center">
        <div className="bg-muted/50 mx-auto mb-4 w-fit rounded-full p-4">
          <XCircle className="h-8 w-8 text-red-500" />
        </div>
        <p className="text-muted-foreground">Não foi possível carregar a atividade recente</p>
        <p className="text-muted-foreground text-sm">{message}</p>
      </div>
    </CardContent>
  )
}
