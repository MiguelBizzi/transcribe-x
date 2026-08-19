import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  getLastTranscriptions,
  type Transcription,
} from '../data/recent-activity'
import { RecentTranscriptCard } from './recent-transcript-card'
import { RecentActivityHeader } from './recent-activity-header'
import { EmptyState, ErrorState } from './recent-activity-states'

export async function RecentTranscripts() {
  try {
    const data = await getLastTranscriptions()
    const transcriptions = data.transcriptions

    return (
      <Card className="hover:shadow-elegant transition-all duration-300">
        <RecentActivityHeader />

        {transcriptions.length === 0 ? (
          <EmptyState
            title="No recent transcriptions"
            description="Start by transcribing your first video!"
          />
        ) : (
          <CardContent>
            <div className="space-y-4">
              {transcriptions
                .slice(0, 5)
                .map((transcription: Transcription) => (
                  <RecentTranscriptCard
                    key={transcription.id}
                    transcription={transcription}
                  />
                ))}

              {transcriptions.length > 5 && (
                <div className="pt-4 text-center">
                  <Button variant="ghost" className="gap-2">
                    View All Transcriptions
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>
    )
  } catch (error) {
    return (
      <Card className="hover:shadow-elegant transition-all duration-300">
        <RecentActivityHeader />
        <ErrorState
          message={
            error instanceof Error ? error.message : 'Please try again later'
          }
        />
      </Card>
    )
  }
}
