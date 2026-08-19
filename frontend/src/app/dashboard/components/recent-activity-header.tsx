import { CardHeader, CardTitle } from '@/components/ui/card'
import { Clock } from 'lucide-react'

export function RecentActivityHeader() {
  return (
    <CardHeader>
      <CardTitle className="flex items-center gap-2">
        <div className="bg-primary rounded-lg p-2">
          <Clock className="h-4 w-4 text-white" />
        </div>
        Atividade recente
      </CardTitle>
    </CardHeader>
  )
}
