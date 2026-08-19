import { RecentTranscripts } from './components/recent-transcripts'
import { RecentTranscriptsLoading } from './components/recent-transcripts-loading'
import { RedirectComponents } from './components/redirect-components'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/server/validate-auth'
import { Suspense } from 'react'

export default async function Dashboard() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth')
  }

  return (
    <div className="flex flex-1 flex-col px-6 py-8">
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold">Welcome back</h1>
        <p className="text-muted-foreground">
          Transform YouTube content into searchable, actionable text
        </p>
      </div>

      <RedirectComponents />

      <Suspense fallback={<RecentTranscriptsLoading />}>
        <RecentTranscripts />
      </Suspense>
    </div>
  )
}
