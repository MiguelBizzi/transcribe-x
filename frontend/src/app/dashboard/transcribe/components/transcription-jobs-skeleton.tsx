import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

export function TranscriptionJobsSkeleton() {
  return (
    <Card className="hover:shadow-elegant transition-all duration-300">
      <CardContent className="pt-6">
        <div className="mb-6 flex w-full items-center justify-between">
          <div className="bg-muted/30 h-8 w-48 animate-pulse rounded" />
          <Badge variant="outline" className="text-sm">
            <div className="bg-muted/30 h-4 w-20 animate-pulse rounded" />
          </Badge>
        </div>

        <div className="grid w-full gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-muted/30 hover:bg-muted/50 w-full rounded-lg p-6 transition-colors"
            >
              <div className="flex w-full items-start gap-4">
                <div className="relative flex-shrink-0">
                  <div className="bg-muted/50 h-16 w-24 animate-pulse rounded-md" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-md">
                    <div className="bg-muted/50 h-4 w-4 animate-pulse rounded-full" />
                  </div>
                </div>

                <div className="w-full flex-1 space-y-3">
                  <div className="flex w-full items-start justify-between">
                    <div className="space-y-2">
                      <div className="bg-muted/30 h-5 w-64 animate-pulse rounded" />
                      <div className="bg-muted/30 h-4 w-32 animate-pulse rounded" />
                    </div>
                    <div className="bg-muted/30 h-6 w-20 animate-pulse rounded-full" />
                  </div>

                  <div className="w-full space-y-2">
                    <div className="flex justify-between text-sm">
                      <div className="bg-muted/30 h-4 w-20 animate-pulse rounded" />
                      <div className="bg-muted/30 h-4 w-8 animate-pulse rounded" />
                    </div>
                    <Progress value={0} className="h-2" />
                    <div className="bg-muted/30 h-3 w-32 animate-pulse rounded" />
                  </div>

                  <div className="flex w-full items-center gap-2 pt-2">
                    {['TXT', 'PDF', 'DOCX', 'JSON'].map((format) => (
                      <div
                        key={format}
                        className="bg-muted/30 h-7 w-12 animate-pulse rounded border"
                      />
                    ))}
                    <div className="bg-muted/30 h-7 w-16 animate-pulse rounded border" />
                    <div className="bg-muted/30 h-7 w-16 animate-pulse rounded border" />

                    <div className="ml-auto">
                      <div className="bg-muted/30 h-4 w-16 animate-pulse rounded" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
