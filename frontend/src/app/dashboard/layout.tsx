import { AppHeader } from '@/components/app-header'
import { getCurrentUser } from '@/server/validate-auth'
import { redirect } from 'next/navigation'

export default async function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth')
  }

  return (
    <div className="flex min-h-svh flex-col">
      <AppHeader user={user} />
      <main className="flex min-h-0 flex-1 flex-col">{children}</main>
    </div>
  )
}
